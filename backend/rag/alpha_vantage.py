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
# Negative cache for failures / rate-limits: without this, every compare
# retries the same throttled ticker on the next request and burns more
# quota. 5 min is short enough to recover after AV's per-minute window
# but long enough to dampen rapid re-renders.
#
# Value is a small dict {"kind": "throttle"|"empty"|"error", "msg": str} so
# callers (and future log/metric plumbing) can tell a transient rate-limit
# from a hard failure without re-parsing the upstream response.
_ov_neg   = TTLCache(maxsize=400, ttl=300)
_ov_lock  = Lock()
_OV_MISS  = object()

# Avg-volume cache shared for both direct callers (US tickers via get_quote)
# and indirect ones (NSE tickers falling back through nse_quote._get_avg_volume).
_vol_cache = TTLCache(maxsize=200, ttl=14_400)
_vol_lock  = Lock()


def _av_symbol(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".NS") or t.endswith(".BO"):
        return t[:-3] + ".BSE"
    return t


def _to_float(x):
    """Parse AV's stringly-typed numeric fields (handles None, '', 'None', '-')."""
    try:
        if x in (None, "", "None", "-"):
            return None
        return float(x)
    except (TypeError, ValueError):
        return None


def get_quote(ticker: str) -> dict | None:
    """Return {price, previous_close, change_pct, ...} or None."""
    if not AV_KEY:
        return None

    cache_key = _av_symbol(ticker)
    with _av_lock:
        if cache_key in _av_cache:
            return _av_cache[cache_key]

    try:
        resp = requests.get(
            AV_URL,
            params={"function": "GLOBAL_QUOTE", "symbol": cache_key, "apikey": AV_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        data = (resp.json() or {}).get("Global Quote") or {}
        price_val = _to_float(data.get("05. price"))
        if price_val is None:
            return None
        pct_raw = (data.get("10. change percent") or "").rstrip("%")
        quote = {
            "price": price_val,
            "previous_close": _to_float(data.get("08. previous close")),
            "change_pct":     _to_float(pct_raw),
            "today_vol":      _to_float(data.get("06. volume")),
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
        _av_cache[cache_key] = quote
    return quote


def get_overview(ticker: str) -> dict | None:
    """Return fundamentals {pe, eps, mkt_cap, week_high, week_low, long_name} or None.

    Uses AV's OVERVIEW endpoint. Cached for 24h since these values move slowly.
    """
    if not AV_KEY:
        return None
    cache_key = _av_symbol(ticker)
    with _ov_lock:
        if cache_key in _ov_cache:
            return _ov_cache[cache_key]
        if _ov_neg.get(cache_key, _OV_MISS) is not _OV_MISS:
            return None  # recent failure; stay off AV to preserve quota

    def _remember_miss(kind: str, msg: str = "") -> None:
        with _ov_lock:
            _ov_neg[cache_key] = {"kind": kind, "msg": msg}

    try:
        resp = requests.get(
            AV_URL,
            params={"function": "OVERVIEW", "symbol": cache_key, "apikey": AV_KEY},
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        if not isinstance(payload, dict) or not payload:
            logger.info("AV overview: empty/unexpected payload for %s", ticker)
            _remember_miss("empty")
            return None
        # "Note"/"Information" = rate-limit throttle (transient); "Error Message"
        # = hard failure (bad symbol, not covered). Tag them separately so the
        # neg-cache entry reflects why we gave up, not just that we did.
        throttle_msg = payload.get("Note") or payload.get("Information")
        if throttle_msg:
            logger.warning("AV overview throttled for %s: %s", ticker, throttle_msg)
            _remember_miss("throttle", throttle_msg)
            return None
        if "Error Message" in payload:
            logger.warning("AV overview error for %s: %s", ticker, payload["Error Message"])
            _remember_miss("error", payload["Error Message"])
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
        _remember_miss("error", str(exc))
        return None

    with _ov_lock:
        _ov_cache[cache_key] = overview
    return overview


def get_avg_volume(ticker: str, days: int = 30) -> float | None:
    """Return mean daily volume over the last `days` trading sessions, or None."""
    if not AV_KEY:
        return None
    cache_key = f"{_av_symbol(ticker)}:{days}"
    with _vol_lock:
        if cache_key in _vol_cache:
            return _vol_cache[cache_key]
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
            v_parsed
            for _, v in sorted(series.items(), reverse=True)[:days]
            if isinstance(v, dict)
            for v_parsed in [_to_float(v.get("5. volume"))]
            if v_parsed is not None
        ]
        if not volumes:
            logger.info("AV avg-volume: empty series for %s", ticker)
            return None
        avg = sum(volumes) / len(volumes)
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("AV avg-volume failed for %s: %s", ticker, exc)
        return None

    with _vol_lock:
        _vol_cache[cache_key] = avg
    return avg


def format_as_stock_data(ticker: str, quote: dict, symbol: str = "$",
                        label: str = "") -> str:
    def fmt_price(v):  return f"{symbol}{v:,.2f}" if isinstance(v, (int, float)) else "N/A"
    def fmt_val(v):    return f"{v:.2f}" if isinstance(v, float) else (str(v) if v is not None else "N/A")
    # Volume/rel-vol use "—" to distinguish "no upstream source has the data"
    # from generic "N/A" on fundamentals.
    def fmt_volume(v): return f"{int(v):,}" if v is not None else "—"

    pct     = quote.get("change_pct")
    mkt_cap = quote.get("mkt_cap")
    rel_vol = quote.get("rel_vol")
    name    = quote.get("long_name") or ticker

    fmt_mktcap = f"{symbol}{int(mkt_cap):,}" if mkt_cap is not None and mkt_cap == mkt_cap else "N/A"
    fmt_pct    = f"{pct:.2f}%" if pct is not None else "N/A"
    fmt_relvol = f"{rel_vol}x" if rel_vol is not None else "—"
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
