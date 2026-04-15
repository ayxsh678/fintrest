"""NSE public API fallback for Indian stocks when yfinance is blocked.

NSE's quote-equity endpoint needs a browser User-Agent and a cookie from
the main page before it responds. We prime the session once per process
and reuse it.
"""
import requests
from cachetools import TTLCache
from threading import Lock
from datetime import datetime, timedelta

_nse_cache = TTLCache(maxsize=100, ttl=300)
_nse_lock  = Lock()

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
    """Fetch ~30 trading days of history and return the average daily volume."""
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
        if resp.status_code != 200:
            return None
        records = (resp.json() or {}).get("data") or []
        volumes = [float(r["CH_TOT_TRADED_QTY"]) for r in records if r.get("CH_TOT_TRADED_QTY")]
        return sum(volumes) / len(volumes) if volumes else None
    except (requests.RequestException, ValueError, KeyError, ZeroDivisionError):
        return None


def _strip_suffix(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".NS") or t.endswith(".BO"):
        return t[:-3]
    return t


def get_nse_quote(ticker: str) -> dict | None:
    """Return {price, previous_close, change_pct, week_high, week_low} or None."""
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
        meta         = data.get("metadata")     or {}
        security     = data.get("securityInfo") or {}

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

        # Relative volume = today's volume ÷ 30-day average volume
        try:
            today_vol = float(price_info.get("totalTradedVolume"))
        except (TypeError, ValueError):
            today_vol = None

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
    def fmt_price(v): return f"₹{v:,}" if v is not None else "N/A"
    def fmt_val(v):   return f"{v:.2f}" if isinstance(v, float) else str(v) if v is not None else "N/A"

    pct       = quote.get("change_pct")
    mkt_cap   = quote.get("mkt_cap")
    today_vol = quote.get("today_vol")
    rel_vol   = quote.get("rel_vol")

    fmt_mktcap  = f"₹{mkt_cap:,}"          if mkt_cap   is not None else "N/A"
    fmt_pct     = f"{pct:.2f}%"            if pct       is not None else "N/A"
    fmt_vol     = f"{int(today_vol):,}"    if today_vol is not None else "N/A"
    fmt_relvol  = f"{rel_vol}x"            if rel_vol   is not None else "N/A"

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
        f"Latest Volume: {fmt_vol}\n"
        f"30D Avg Volume: N/A\n"
        f"Relative Volume: {fmt_relvol}"
    )
