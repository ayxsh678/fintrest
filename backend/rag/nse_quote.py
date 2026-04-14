"""NSE public API fallback for Indian stocks when yfinance is blocked.

NSE's quote-equity endpoint needs a browser User-Agent and a cookie from
the main page before it responds. We prime the session once per process
and reuse it.
"""
import requests
from cachetools import TTLCache
from threading import Lock

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
        quote = {
            "price": price_info.get("lastPrice"),
            "previous_close": price_info.get("previousClose"),
            "change_pct": price_info.get("pChange"),
            "week_high": (price_info.get("weekHighLow") or {}).get("max"),
            "week_low":  (price_info.get("weekHighLow") or {}).get("min"),
            "long_name": (data.get("info") or {}).get("companyName", symbol),
        }
        if quote["price"] is None:
            return None
    except (requests.RequestException, ValueError):
        return None

    with _nse_lock:
        _nse_cache[ticker] = quote
    return quote


def format_as_stock_data(ticker: str, quote: dict) -> str:
    def fmt(v): return f"₹{v}" if v is not None else "N/A"
    return (
        f"Stock: {quote.get('long_name', ticker)} ({ticker}) — NSE (live)\n"
        f"Current Price: {fmt(quote.get('price'))}\n"
        f"Previous Close: {fmt(quote.get('previous_close'))}\n"
        f"52W High: {fmt(quote.get('week_high'))}\n"
        f"52W Low: {fmt(quote.get('week_low'))}\n"
        f"P/E Ratio: N/A\n"
        f"Market Cap: N/A\n"
        f"EPS: N/A\n"
        f"5-Day Change: {quote['change_pct']:.2f}%\n"
        if quote.get("change_pct") is not None else
        f"Stock: {quote.get('long_name', ticker)} ({ticker}) — NSE (live)\n"
        f"Current Price: {fmt(quote.get('price'))}\n"
        f"Previous Close: {fmt(quote.get('previous_close'))}\n"
        f"52W High: {fmt(quote.get('week_high'))}\n"
        f"52W Low: {fmt(quote.get('week_low'))}\n"
        f"P/E Ratio: N/A\nMarket Cap: N/A\nEPS: N/A\n5-Day Change: N/A\n"
    ) + "Latest Volume: N/A\n30D Avg Volume: N/A\nRelative Volume: N/A"
