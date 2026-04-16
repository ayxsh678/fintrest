"""NSE/BSE OHLC fallbacks that work from Render-class egress IPs.

Provider cascade (cheapest & most-reliable first):
  1. Yahoo chart v8 direct — same data yfinance fetches, but without the
     /v7 crumb handshake that 401s on cloud IPs. Covers .NS/.BO/US/crypto.
  2. NSE historical/cm/equity — needs the cookie-primed session from
     rag.nse_quote. NSE rate-limits hard, so we cache aggressively.
  3. Stooq — no key, no cookies. Works for major NSE/US/crypto tickers
     under their `.in` / `.us` namespaces. Last-resort because daily
     updates lag ~1 day.
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timedelta
from threading import Lock

import requests
from cachetools import TTLCache

from rag.nse_quote import _get_session  # reuses primed cookies + UA

logger = logging.getLogger(__name__)

_cache = TTLCache(maxsize=300, ttl=1800)  # 30-min TTL — daily bars
_neg   = TTLCache(maxsize=300, ttl=600)   # 10-min negative cache
_lock  = Lock()

_YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
_STOOQ_CSV   = "https://stooq.com/q/d/l/"

_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def _yf_range_for(days: int) -> str:
    for d, r in [(7, "7d"), (30, "1mo"), (90, "3mo"),
                 (180, "6mo"), (365, "1y"), (730, "2y")]:
        if days <= d:
            return r
    return "5y"


def _yahoo_chart(ticker: str, days: int) -> list[dict] | None:
    """Hit Yahoo's chart v8 endpoint directly. No crumb required."""
    try:
        r = requests.get(
            _YAHOO_CHART.format(sym=ticker),
            params={"range": _yf_range_for(days), "interval": "1d",
                    "includePrePost": "false", "events": "div,splits"},
            headers={"User-Agent": _BROWSER_UA, "Accept": "application/json"},
            timeout=8,
        )
        if r.status_code != 200:
            logger.info("yahoo chart: status %s for %s", r.status_code, ticker)
            return None
        payload = r.json() or {}
        result = (payload.get("chart") or {}).get("result") or []
        if not result:
            return None
        res0 = result[0]
        ts = res0.get("timestamp") or []
        ind = (res0.get("indicators") or {}).get("quote") or [{}]
        q0 = ind[0] if ind else {}
        opens  = q0.get("open")   or []
        highs  = q0.get("high")   or []
        lows   = q0.get("low")    or []
        closes = q0.get("close")  or []
        vols   = q0.get("volume") or []
        rows: list[dict] = []
        for i, t in enumerate(ts):
            c = closes[i] if i < len(closes) else None
            if c is None:
                continue
            rows.append({
                "time":   int(t),
                "open":   float(opens[i]  if i < len(opens)  and opens[i]  is not None else c),
                "high":   float(highs[i]  if i < len(highs)  and highs[i]  is not None else c),
                "low":    float(lows[i]   if i < len(lows)   and lows[i]   is not None else c),
                "close":  float(c),
                "volume": float(vols[i]   if i < len(vols)   and vols[i]   is not None else 0),
            })
        return rows[-days:] if rows else None
    except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
        logger.warning("yahoo chart failed for %s: %s", ticker, exc)
        return None


def _nse_history(ticker: str, days: int) -> list[dict] | None:
    """Use NSE's own historical/cm/equity endpoint. Needs primed cookies."""
    if not (ticker.endswith(".NS") or ticker.endswith(".BO")):
        return None
    symbol = ticker.rsplit(".", 1)[0]
    sess = _get_session()
    if sess is None:
        return None
    to_dt   = datetime.now()
    from_dt = to_dt - timedelta(days=days + 10)
    try:
        resp = sess.get(
            "https://www.nseindia.com/api/historical/cm/equity",
            params={
                "symbol": symbol,
                "series": '["EQ"]',
                "from": from_dt.strftime("%d-%m-%Y"),
                "to":   to_dt.strftime("%d-%m-%Y"),
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        data = (resp.json() or {}).get("data") or []
        rows: list[dict] = []
        for r in data:
            try:
                ts = int(datetime.strptime(r["CH_TIMESTAMP"], "%Y-%m-%d").timestamp())
                rows.append({
                    "time":   ts,
                    "open":   float(r["CH_OPENING_PRICE"]),
                    "high":   float(r["CH_TRADE_HIGH_PRICE"]),
                    "low":    float(r["CH_TRADE_LOW_PRICE"]),
                    "close":  float(r["CH_CLOSING_PRICE"]),
                    "volume": float(r.get("CH_TOT_TRADED_QTY") or 0),
                })
            except (KeyError, ValueError, TypeError):
                continue
        rows.sort(key=lambda r: r["time"])
        return rows[-days:] if len(rows) >= 2 else None
    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning("nse history failed for %s: %s", ticker, exc)
        return None


def _stooq_symbol(ticker: str) -> str | None:
    t = ticker.upper().strip()
    if t.endswith(".NS"): return f"{t[:-3]}.IN".lower()
    if t.endswith(".BO"): return None
    if t.isalpha():       return f"{t}.US".lower()
    return None


def _stooq(ticker: str, days: int) -> list[dict] | None:
    sym = _stooq_symbol(ticker)
    if not sym:
        return None
    to_dt   = datetime.now()
    from_dt = to_dt - timedelta(days=days + 10)
    try:
        resp = requests.get(
            _STOOQ_CSV,
            params={"s": sym, "i": "d",
                    "d1": from_dt.strftime("%Y%m%d"),
                    "d2": to_dt.strftime("%Y%m%d")},
            headers={"User-Agent": _BROWSER_UA},
            timeout=8,
        )
        if resp.status_code != 200 or not resp.text:
            return None
        if resp.text.strip().lower().startswith("no data"):
            return None
        rows: list[dict] = []
        for r in csv.DictReader(io.StringIO(resp.text)):
            try:
                ts = int(datetime.strptime(r["Date"], "%Y-%m-%d").timestamp())
                rows.append({
                    "time":   ts,
                    "open":   float(r["Open"]),
                    "high":   float(r["High"]),
                    "low":    float(r["Low"]),
                    "close":  float(r["Close"]),
                    "volume": float(r.get("Volume") or 0),
                })
            except (KeyError, ValueError, TypeError):
                continue
        return rows[-days:] if len(rows) >= 2 else None
    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning("stooq failed for %s: %s", ticker, exc)
        return None


def get_india_ohlc(ticker: str, days: int = 180) -> tuple[list[dict] | None, str | None]:
    """Return (rows, source_name). Source is None on total failure."""
    cache_key = f"{ticker}:{days}"
    with _lock:
        if cache_key in _cache:
            return _cache[cache_key], "cache"
        if cache_key in _neg:
            return None, None

    for name, fn in (("yahoo_v8", _yahoo_chart),
                     ("nse",      _nse_history),
                     ("stooq",    _stooq)):
        rows = fn(ticker, days)
        if rows:
            with _lock:
                _cache[cache_key] = rows
            return rows, name

    with _lock:
        _neg[cache_key] = True
    return None, None
