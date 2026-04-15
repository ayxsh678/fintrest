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
        quote = {
            "price": float(price_raw),
            "previous_close": float(prev_raw) if prev_raw else None,
            "change_pct": float(pct_raw) if pct_raw else None,
        }
    except (requests.RequestException, ValueError, KeyError):
        return None

    with _av_lock:
        _av_cache[ticker] = quote
    return quote


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
    pct = quote.get("change_pct")
    prev = quote.get("previous_close")
    header = f"Stock: {ticker}{(' — ' + label) if label else ''}"
    return (
        f"{header}\n"
        f"Current Price: {symbol}{quote['price']}\n"
        f"Previous Close: {symbol}{prev if prev is not None else 'N/A'}\n"
        f"52W High: N/A\n"
        f"52W Low: N/A\n"
        f"P/E Ratio: N/A\n"
        f"Market Cap: N/A\n"
        f"EPS: N/A\n"
        f"5-Day Change: {pct:.2f}%\n"
        f"Latest Volume: N/A\n"
        f"30D Avg Volume: N/A\n"
        f"Relative Volume: N/A"
    ) if pct is not None else (
        f"{header}\n"
        f"Current Price: {symbol}{quote['price']}\n"
        f"Previous Close: {symbol}{prev if prev is not None else 'N/A'}\n"
        f"52W High: N/A\n52W Low: N/A\nP/E Ratio: N/A\nMarket Cap: N/A\nEPS: N/A\n"
        f"5-Day Change: N/A\nLatest Volume: N/A\n30D Avg Volume: N/A\nRelative Volume: N/A"
    )
