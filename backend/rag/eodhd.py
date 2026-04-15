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

# 4h TTL matches the other avg-volume caches.
_vol_cache = TTLCache(maxsize=200, ttl=14_400)
_vol_lock  = Lock()


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
            return None
        payload = resp.json()
        if not isinstance(payload, list):
            logger.warning("EODHD avg-volume: unexpected payload type %s for %s",
                           type(payload).__name__, ticker)
            return None
        volumes = [
            float(r["volume"])
            for r in payload[-days:]
            if isinstance(r, dict) and r.get("volume")
        ]
        if not volumes:
            logger.info("EODHD avg-volume: empty series for %s", ticker)
            return None
        avg = sum(volumes) / len(volumes)
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("EODHD avg-volume failed for %s: %s", ticker, exc)
        return None

    with _vol_lock:
        _vol_cache[cache_key] = avg
    return avg
