"""Alpha Vantage fallback when yfinance is blocked (e.g. Render IPs).

Only provides price + change — not a full replacement for yfinance, just
enough to keep the app functional when Yahoo Finance refuses connections.
"""
import logging
import os
import requests
from cachetools import TTLCache
from threading import Lock

logger = logging.getLogger(__name__)

AV_KEY = os.getenv("ALPHA_VANTAGE_KEY")
AV_URL = "https://www.alphavantage.co/query"

_av_cache = TTLCache(maxsize=100, ttl=300)
_av_lock  = Lock()

# Fundamentals change slowly; cache for 24h to stay well inside AV's free-tier
# daily quota (500 requests/day) when many tickers are compared repeatedly.
_ov_cache = TTLCache(maxsize=200, ttl=86_400)
_ov_lock  = Lock()


def _av_symbol(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".NS") or t.endswith(".BO"):
        return t[:-3] + ".BSE"
    return t


def get_quote(ticker: str) -> dict | None:
    """Return {price, previous_close, change_pct} or None."""
    if not AV_KEY:
        return None

    with _av_lock:
        if ticker in _av_cache:
            return _av_cache[ticker]

    try:
        resp = requests.get(
            AV_URL,
            params={"function": "GLOBAL_QUOTE", "symbol": _av_symbol(ticker), "apikey": AV_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        data = (resp.json() or {}).get("Global Quote") or {}
        price_raw = data.get("05. price")
        prev_raw  = data.get("08. previous close")
        pct_raw   = (data.get("10. change percent") or "").rstrip("%")
        if not price_raw:
            return None
        price_val = float(price_raw)
        vol_raw = data.get("06. volume")
        quote = {
            "price": price_val,
            "previous_close": float(prev_raw) if prev_raw else None,
            "change_pct": float(pct_raw) if pct_raw else None,
            "today_vol": _to_float(vol_raw),
        }
    except (requests.RequestException, ValueError, KeyError):
        return None

    # Enrich with fundamentals + rel vol. Each helper is independently cached
    # and returns None on failure, so quote stays usable even if either fails.
    overview = get_overview(ticker) or {}
    quote.update({
        "pe":        overview.get("pe"),
        "eps":       overview.get("eps"),
        "mkt_cap":   overview.get("mkt_cap"),
        "week_high": overview.get("week_high"),
        "week_low":  overview.get("week_low"),
        "long_name": overview.get("long_name") or ticker,
    })
    avg_vol = get_avg_volume(ticker)
    quote["avg_vol"] = avg_vol
    if avg_vol and avg_vol > 0 and quote.get("today_vol") is not None:
        quote["rel_vol"] = round(quote["today_vol"] / avg_vol, 2)
    else:
        quote["rel_vol"] = None

    with _av_lock:
        _av_cache[ticker] = quote
    return quote


def _to_float(x):
    try:
        if x in (None, "", "None", "-"):
            return None
        return float(x)
    except (TypeError, ValueError):
        return None


def get_overview(ticker: str) -> dict | None:
    """Return fundamentals {pe, eps, mkt_cap, week_high, week_low, long_name} or None.

    Uses AV's OVERVIEW endpoint. Cached for 24h since these values move slowly.
    """
    if not AV_KEY:
        return None
    with _ov_lock:
        if ticker in _ov_cache:
            return _ov_cache[ticker]
    try:
        resp = requests.get(
            AV_URL,
            params={"function": "OVERVIEW", "symbol": _av_symbol(ticker), "apikey": AV_KEY},
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        if not isinstance(payload, dict) or not payload:
            logger.info("AV overview: empty/unexpected payload for %s", ticker)
            return None
        if "Note" in payload or "Error Message" in payload:
            logger.warning("AV overview: API message for %s: %s", ticker,
                           payload.get("Note") or payload.get("Error Message"))
            return None
        overview = {
            "pe":         _to_float(payload.get("PERatio")),
            "eps":        _to_float(payload.get("EPS")),
            "mkt_cap":    _to_float(payload.get("MarketCapitalization")),
            "week_high":  _to_float(payload.get("52WeekHigh")),
            "week_low":   _to_float(payload.get("52WeekLow")),
            "long_name":  payload.get("Name") or ticker,
        }
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("AV overview failed for %s: %s", ticker, exc)
        return None

    with _ov_lock:
        _ov_cache[ticker] = overview
    return overview


def get_avg_volume(ticker: str, days: int = 30) -> float | None:
    """Return mean daily volume over the last `days` trading sessions, or None."""
    if not AV_KEY:
        return None
    try:
        resp = requests.get(
            AV_URL,
            params={
                "function": "TIME_SERIES_DAILY",
                "symbol": _av_symbol(ticker),
                "outputsize": "compact",
                "apikey": AV_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        if not isinstance(payload, dict):
            logger.warning("AV avg-volume: unexpected payload type %s for %s", type(payload).__name__, ticker)
            return None
        # AV returns {"Note": ...} (rate-limited) or {"Error Message": ...} on failure.
        if "Note" in payload or "Error Message" in payload:
            logger.warning("AV avg-volume: API message for %s: %s", ticker,
                           payload.get("Note") or payload.get("Error Message"))
            return None
        series = payload.get("Time Series (Daily)") or {}
        if not isinstance(series, dict):
            logger.warning("AV avg-volume: series not a dict for %s", ticker)
            return None
        volumes = [
            float(v["5. volume"])
            for _, v in sorted(series.items(), reverse=True)[:days]
            if isinstance(v, dict) and v.get("5. volume")
        ]
        if not volumes:
            logger.info("AV avg-volume: empty series for %s", ticker)
            return None
        return sum(volumes) / len(volumes)
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("AV avg-volume failed for %s: %s", ticker, exc)
        return None


def format_as_stock_data(ticker: str, quote: dict, symbol: str = "$",
                        label: str = "") -> str:
    def fmt_price(v):  return f"{symbol}{v:,.2f}" if isinstance(v, (int, float)) else "N/A"
    def fmt_val(v):    return f"{v:.2f}" if isinstance(v, float) else (str(v) if v is not None else "N/A")
    def fmt_volume(v): return f"{int(v):,}" if v is not None else "N/A"

    pct     = quote.get("change_pct")
    mkt_cap = quote.get("mkt_cap")
    rel_vol = quote.get("rel_vol")
    name    = quote.get("long_name") or ticker

    fmt_mktcap = f"{symbol}{int(mkt_cap):,}" if mkt_cap is not None else "N/A"
    fmt_pct    = f"{pct:.2f}%" if pct is not None else "N/A"
    fmt_relvol = f"{rel_vol}x" if rel_vol is not None else "N/A"
    header     = f"Stock: {name} ({ticker}){(' — ' + label) if label else ''}"

    return (
        f"{header}\n"
        f"Current Price: {fmt_price(quote.get('price'))}\n"
        f"Previous Close: {fmt_price(quote.get('previous_close'))}\n"
        f"52W High: {fmt_price(quote.get('week_high'))}\n"
        f"52W Low: {fmt_price(quote.get('week_low'))}\n"
        f"P/E Ratio: {fmt_val(quote.get('pe'))}\n"
        f"Market Cap: {fmt_mktcap}\n"
        f"EPS: {fmt_val(quote.get('eps'))}\n"
        f"5-Day Change: {fmt_pct}\n"
        f"Latest Volume: {fmt_volume(quote.get('today_vol'))}\n"
        f"30D Avg Volume: {fmt_volume(quote.get('avg_vol'))}\n"
        f"Relative Volume: {fmt_relvol}"
    )
