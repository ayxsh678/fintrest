import concurrent.futures
import re
import logging
from rag.retriever import get_stock_data, get_earnings_data
try:
    from rag.retriever import COMPANY_MAP, KNOWN_TICKERS
except ImportError:
    COMPANY_MAP = {}
    KNOWN_TICKERS = []

logger = logging.getLogger(__name__)

def get_comparison_data(ticker_a: str, ticker_b: str) -> dict:
    def fetch_one(ticker):
        try:
            return ticker, {
                "stock": get_stock_data(ticker),
                "earnings": get_earnings_data(ticker),
            }
        except Exception as e:
            logger.error(f"Error fetching {ticker}: {e}")
            return ticker, {"stock": "Unavailable", "earnings": "Unavailable"}

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(fetch_one, t): t for t in [ticker_a, ticker_b]}
        for future in concurrent.futures.as_completed(futures):
            ticker, data = future.result()
            results[ticker] = data
    return results

def build_comparison_context(ticker_a: str, ticker_b: str) -> str:
    data = get_comparison_data(ticker_a, ticker_b)
    parts = []
    for ticker in [ticker_a, ticker_b]:
        t_data = data.get(ticker, {})
        parts.append(f"── {ticker} ──\n{t_data.get('stock')}\n{t_data.get('earnings')}")
    return "\n" + "="*30 + "\n" + "\n".join(parts)

def extract_comparison_tickers(query: str) -> tuple[str, str] | None:
    query_lower = query.lower()
    found = []
    for name, ticker in COMPANY_MAP.items():
        if name in query_lower and ticker not in found:
            found.append(ticker)
    if len(found) < 2:
        for word in query.upper().split():
            clean = re.sub(r"[^A-Z]", "", word)
            if clean in KNOWN_TICKERS and clean not in found:
                found.append(clean)
    return tuple(found[:2]) if len(found) >= 2 else None