"""NSE public API fallback for Indian stocks when yfinance is blocked.

NSE's quote-equity endpoint needs a browser User-Agent and a cookie from
the main page before it responds. We prime the session once per process
and reuse it.
"""
import logging
import requests
from cachetools import TTLCache
from threading import Lock
from datetime import datetime, timedelta

from rag.alpha_vantage import get_avg_volume as av_get_avg_volume
from rag.eodhd import get_avg_volume as eodhd_get_avg_volume, get_ohlc as eodhd_get_ohlc

logger = logging.getLogger(__name__)

_nse_cache = TTLCache(maxsize=100, ttl=300)
_nse_lock  = Lock()

# Separate cache for 30-day average volume: changes slowly, so a 4-hour
# TTL avoids hammering the NSE history endpoint on every quote request.
_vol_cache = TTLCache(maxsize=100, ttl=14_400)
_vol_lock  = Lock()

_session: requests.Session | None = None
_session_lock = Lock()

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}


def _get_session() -> requests.Session | None:
    global _session
    with _session_lock:
        if _session is not None:
            return _session
        s = requests.Session()
        s.headers.update(_HEADERS)
        try:
            s.get("https://www.nseindia.com/", timeout=10)
            _session = s
            return s
        except requests.RequestException:
            return None


def _get_avg_volume(session: requests.Session, symbol: str) -> float | None:
    """Return the mean daily volume over ~30 trading days, with per-symbol caching.

    Tries NSE's historical endpoint first; falls back to Alpha Vantage's
    TIME_SERIES_DAILY when NSE is unreachable (e.g. Render egress IPs blocked).
    """
    with _vol_lock:
        if symbol in _vol_cache:
            return _vol_cache[symbol]

    avg: float | None = None
    to_dt   = datetime.now()
    from_dt = to_dt - timedelta(days=45)  # 45 calendar days ≈ 30 trading days
    try:
        resp = session.get(
            "https://www.nseindia.com/api/historical/cm/equity",
            params={
                "symbol": symbol,
                "series": '["EQ"]',
                "from": from_dt.strftime("%d-%m-%Y"),
                "to":   to_dt.strftime("%d-%m-%Y"),
            },
            timeout=10,
        )
        if resp.status_code == 200:
            payload = resp.json()
            records = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(records, list):
                logger.info("NSE history: unexpected shape for %s; will try Alpha Vantage", symbol)
                records = []
            volumes = [
                float(r["CH_TOT_TRADED_QTY"])
                for r in records
                if isinstance(r, dict) and r.get("CH_TOT_TRADED_QTY")
            ]
            if volumes:
                avg = sum(volumes) / len(volumes)
            else:
                logger.info("NSE history: empty volume series for %s; will try Alpha Vantage", symbol)
        else:
            logger.info("NSE history status %s for %s; will try Alpha Vantage", resp.status_code, symbol)
    except requests.RequestException as exc:
        logger.warning("NSE history request failed for %s: %s", symbol, exc)
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.warning("NSE history parse error for %s: %s", symbol, exc)

    if avg is None:
        try:
            # Re-append .NS so alpha_vantage._av_symbol maps it to the .BSE form
            # it expects; passing the bare NSE symbol would bypass that mapping.
            avg = av_get_avg_volume(symbol + ".NS")
            if avg is not None:
                logger.info("Using Alpha Vantage avg volume for %s: %.0f", symbol, avg)
        except Exception as exc:  # noqa: BLE001 — defensive, never let fallback crash quote path
            logger.warning("Alpha Vantage avg volume failed for %s: %s", symbol, exc)

    if avg is None:
        # Second fallback: EODHD covers NSE/BSE daily history where AV's free
        # tier doesn't. Gated behind EODHD_API_KEY so it's a no-op when unset.
        try:
            avg = eodhd_get_avg_volume(symbol + ".NS")
            if avg is not None:
                logger.info("Using EODHD avg volume for %s: %.0f", symbol, avg)
        except Exception as exc:  # noqa: BLE001
            logger.warning("EODHD avg volume failed for %s: %s", symbol, exc)

    with _vol_lock:
        if avg is not None:
            _vol_cache[symbol] = avg
    return avg


def _strip_suffix(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".NS") or t.endswith(".BO"):
        return t[:-3]
    return t


def get_nse_quote(ticker: str) -> dict | None:
    """Return quote dict or None on failure."""
    with _nse_lock:
        if ticker in _nse_cache:
            return _nse_cache[ticker]

    session = _get_session()
    if session is None:
        return None

    symbol = _strip_suffix(ticker)
    try:
        resp = session.get(
            "https://www.nseindia.com/api/quote-equity",
            params={"symbol": symbol},
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        data = resp.json() or {}
        price_info = data.get("priceInfo") or {}
        if not price_info:
            return None
        meta     = data.get("metadata")     or {}
        security = data.get("securityInfo") or {}

        try:
            price = float(price_info.get("lastPrice"))
        except (TypeError, ValueError):
            price = None

        pe_raw = meta.get("pdSymbolPe")
        try:
            pe = float(pe_raw) if pe_raw not in (None, "-", "") else None
        except (TypeError, ValueError):
            pe = None

        try:
            eps = round(price / pe, 2) if price is not None and pe is not None and pe != 0 else None
        except (TypeError, ZeroDivisionError):
            eps = None

        # Market cap = price × issued shares; issuedSize lives in securityInfo
        try:
            issued = float(security["issuedSize"]) if security.get("issuedSize") is not None else None
            mkt_cap = int(price * issued) if price is not None and issued is not None else None
        except (TypeError, ValueError):
            mkt_cap = None

        # Relative volume = today's volume ÷ 30-day average volume.
        # totalTradedVolume lives in marketDeptOrderBook.tradeInfo, not priceInfo.
        # Strip thousands separators before conversion in case the API returns "1,234,567".
        trade_info = (data.get("marketDeptOrderBook") or {}).get("tradeInfo") or {}
        try:
            raw_vol = trade_info.get("totalTradedVolume")
            today_vol = float(str(raw_vol).replace(",", "")) if raw_vol is not None else None
        except (TypeError, ValueError):
            today_vol = None

        # NSE's quote-equity sometimes omits marketDeptOrderBook on Render
        # egress IPs (different content than the browser receives). Without
        # today_vol we can't compute rel_vol — so as a last resort, fall back
        # to the latest daily volume from EODHD's OHLC series. Not live, but
        # a close-enough proxy to keep the Rel Vol cell populated.
        if today_vol is None:
            try:
                ohlc = eodhd_get_ohlc(symbol + ".NS", days=5)
                if ohlc:
                    # Walk backwards to find the most recent row with a
                    # positive volume — today's EOD data may not yet be
                    # pushed by EODHD so the last row can have volume=0.
                    for row in reversed(ohlc):
                        v = float(row.get("volume") or 0)
                        if v > 0:
                            today_vol = v
                            break
            except Exception as exc:  # noqa: BLE001
                logger.warning("EODHD latest-volume fallback failed for %s: %s", symbol, exc)

        # Only pay the avg-volume cost once we have a today_vol to divide
        # by — otherwise rel_vol is unreachable regardless and the lookup
        # would waste an upstream call per compare.
        avg_vol = None
        rel_vol = None
        if today_vol is not None:
            avg_vol = _get_avg_volume(session, symbol)
            if avg_vol is not None and avg_vol > 0:
                rel_vol = round(today_vol / avg_vol, 2)

        quote = {
            "price": price,
            "previous_close": price_info.get("previousClose"),
            "change_pct": price_info.get("pChange"),
            "week_high": (price_info.get("weekHighLow") or {}).get("max"),
            "week_low":  (price_info.get("weekHighLow") or {}).get("min"),
            "long_name": (data.get("info") or {}).get("companyName", symbol),
            "pe": pe,
            "eps": eps,
            "mkt_cap": mkt_cap,
            "today_vol": today_vol,
            "avg_vol": avg_vol,
            "rel_vol": rel_vol,
        }
        if quote["price"] is None:
            return None
    except (requests.RequestException, ValueError):
        return None

    with _nse_lock:
        _nse_cache[ticker] = quote
    return quote


def format_as_stock_data(ticker: str, quote: dict) -> str:
    # Volume-derived fields use "—" (em dash) when no upstream source could
    # supply the data; other fields stay "N/A" to preserve existing semantics
    # for fundamentals that genuinely aren't reported.
    def fmt_price(v): return f"₹{v:,}" if v is not None else "N/A"
    def fmt_val(v):   return f"{v:.2f}" if isinstance(v, float) else str(v) if v is not None else "N/A"
    def fmt_volume(v): return f"{int(v):,}" if v is not None else "—"

    pct       = quote.get("change_pct")
    mkt_cap   = quote.get("mkt_cap")
    avg_vol   = quote.get("avg_vol")
    rel_vol   = quote.get("rel_vol")

    fmt_mktcap  = f"₹{mkt_cap:,}" if mkt_cap is not None else "N/A"
    fmt_pct     = f"{pct:.2f}%"   if pct     is not None else "N/A"
    fmt_relvol  = f"{rel_vol}x"   if rel_vol is not None else "—"

    return (
        f"Stock: {quote.get('long_name', ticker)} ({ticker}) — NSE (live)\n"
        f"Current Price: {fmt_price(quote.get('price'))}\n"
        f"Previous Close: {fmt_price(quote.get('previous_close'))}\n"
        f"52W High: {fmt_price(quote.get('week_high'))}\n"
        f"52W Low: {fmt_price(quote.get('week_low'))}\n"
        f"P/E Ratio: {fmt_val(quote.get('pe'))}\n"
        f"Market Cap: {fmt_mktcap}\n"
        f"EPS: {fmt_val(quote.get('eps'))}\n"
        f"5-Day Change: {fmt_pct}\n"
        f"Latest Volume: {fmt_volume(quote.get('today_vol'))}\n"
        f"30D Avg Volume: {fmt_volume(avg_vol)}\n"
        f"Relative Volume: {fmt_relvol}"
    )
