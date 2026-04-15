"""EODHD (EOD Historical Data) fallback for volume/price history.

Covers NSE and BSE on the free tier (20 calls/day on the demo plan, more
on paid). Used when both NSE's own history endpoint and Alpha Vantage
fail — typically because of Render IP blocks on NSE and AV's free tier
not covering Indian daily series.
"""
import logging
import os
from datetime import datetime, timedelta

import requests
from cachetools import TTLCache
from threading import Lock

logger = logging.getLogger(__name__)

EODHD_KEY = os.getenv("EODHD_API_KEY")
EODHD_URL = "https://eodhd.com/api/eod/{symbol}"

# 4h TTL matches the other avg-volume caches. Negative results (None) are
# cached with a shorter 1h TTL so consistently-failing tickers don't burn
# through the free-tier quota, but recover faster than genuine hits if the
# upstream issue clears.
_vol_cache = TTLCache(maxsize=200, ttl=14_400)
_neg_cache = TTLCache(maxsize=400, ttl=3_600)
_vol_lock  = Lock()

# OHLC series is the new hot path (chart endpoint hit once per compare
# render); 30-min TTL keeps intra-day charts reasonably fresh without
# burning through the free-tier daily quota on repeat views.
_ohlc_cache = TTLCache(maxsize=200, ttl=1_800)
_ohlc_neg   = TTLCache(maxsize=400, ttl=600)
_ohlc_lock  = Lock()

# Sentinel used to distinguish "cached miss" from "not in cache yet".
_MISS = object()


def _eodhd_symbol(ticker: str) -> str:
    """Map our internal ticker to EODHD's SYMBOL.EXCHANGE form.

    EODHD uses `.NSE` (not `.NS`) for the Indian National Stock Exchange,
    and `.BSE` for Bombay. Bare US tickers go to `.US`.
    """
    t = ticker.upper()
    if t.endswith(".NS"): return f"{t[:-3]}.NSE"
    if t.endswith(".BO"): return f"{t[:-3]}.BSE"
    if "." in t:          return t  # already exchange-qualified
    return f"{t}.US"


def get_avg_volume(ticker: str, days: int = 30) -> float | None:
    """Return mean daily volume over the last `days` sessions, or None."""
    if not EODHD_KEY:
        return None

    cache_key = f"{_eodhd_symbol(ticker)}:{days}"
    with _vol_lock:
        if cache_key in _vol_cache:
            return _vol_cache[cache_key]
        if _neg_cache.get(cache_key, _MISS) is not _MISS:
            return None  # recently-failed; don't re-hit the API

    def _remember_miss():
        with _vol_lock:
            _neg_cache[cache_key] = None

    to_dt   = datetime.now()
    from_dt = to_dt - timedelta(days=days * 2)  # 2x to absorb weekends/holidays
    try:
        resp = requests.get(
            EODHD_URL.format(symbol=_eodhd_symbol(ticker)),
            params={
                "api_token": EODHD_KEY,
                "fmt":       "json",
                "from":      from_dt.strftime("%Y-%m-%d"),
                "to":        to_dt.strftime("%Y-%m-%d"),
            },
            timeout=15,
        )
        if resp.status_code != 200:
            logger.info("EODHD avg-volume: status %s for %s", resp.status_code, ticker)
            _remember_miss()
            return None
        payload = resp.json()
        if not isinstance(payload, list):
            logger.warning("EODHD avg-volume: unexpected payload type %s for %s",
                           type(payload).__name__, ticker)
            _remember_miss()
            return None
        # Defensive sort by date so we don't rely on EODHD's ordering; slice
        # the most-recent `days` rows from the end.
        rows = [r for r in payload if isinstance(r, dict) and r.get("volume")]
        rows.sort(key=lambda r: r.get("date") or "")
        volumes = [float(r["volume"]) for r in rows[-days:]]
        if not volumes:
            logger.info("EODHD avg-volume: empty series for %s", ticker)
            _remember_miss()
            return None
        avg = sum(volumes) / len(volumes)
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("EODHD avg-volume failed for %s: %s", ticker, exc)
        _remember_miss()
        return None

    with _vol_lock:
        _vol_cache[cache_key] = avg
    return avg


def get_ohlc(ticker: str, days: int = 180) -> list[dict] | None:
    """Return a list of {time, open, high, low, close, volume} rows, newest last.

    `time` is an epoch-seconds integer so lightweight-charts can consume it
    directly via `chart.setData()`. None is returned (and negatively cached)
    on any upstream error so charts can render a graceful fallback without
    retrying EODHD on every paint.
    """
    if not EODHD_KEY:
        return None

    cache_key = f"{_eodhd_symbol(ticker)}:ohlc:{days}"
    with _ohlc_lock:
        if cache_key in _ohlc_cache:
            return _ohlc_cache[cache_key]
        if _ohlc_neg.get(cache_key, _MISS) is not _MISS:
            return None

    def _remember_miss():
        with _ohlc_lock:
            _ohlc_neg[cache_key] = None

    to_dt   = datetime.now()
    from_dt = to_dt - timedelta(days=days + 10)  # buffer for weekends/holidays
    try:
        resp = requests.get(
            EODHD_URL.format(symbol=_eodhd_symbol(ticker)),
            params={
                "api_token": EODHD_KEY,
                "fmt":       "json",
                "from":      from_dt.strftime("%Y-%m-%d"),
                "to":        to_dt.strftime("%Y-%m-%d"),
            },
            timeout=15,
        )
        if resp.status_code != 200:
            logger.info("EODHD ohlc: status %s for %s", resp.status_code, ticker)
            _remember_miss()
            return None
        payload = resp.json()
        if not isinstance(payload, list) or not payload:
            logger.info("EODHD ohlc: empty/unexpected payload for %s", ticker)
            _remember_miss()
            return None

        rows: list[dict] = []
        for r in payload:
            if not isinstance(r, dict):
                continue
            date = r.get("date")
            close = r.get("close")
            if not date or close is None:
                continue
            try:
                ts = int(datetime.strptime(date, "%Y-%m-%d").timestamp())
                rows.append({
                    "time":   ts,
                    "open":   float(r.get("open", close) or close),
                    "high":   float(r.get("high", close) or close),
                    "low":    float(r.get("low",  close) or close),
                    "close":  float(close),
                    "volume": float(r.get("volume") or 0),
                })
            except (TypeError, ValueError):
                continue
        rows.sort(key=lambda r: r["time"])
        rows = rows[-days:]
        if not rows:
            _remember_miss()
            return None
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("EODHD ohlc failed for %s: %s", ticker, exc)
        _remember_miss()
        return None

    with _ohlc_lock:
        _ohlc_cache[cache_key] = rows
    return rows
