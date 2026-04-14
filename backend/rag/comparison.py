import concurrent.futures
import re
import logging
from rag.retriever import get_stock_data, get_earnings_data
from rag.india_stocks import get_india_stock_data
try:
    from rag.retriever import COMPANY_MAP, KNOWN_TICKERS
except ImportError:
    COMPANY_MAP = {}
    KNOWN_TICKERS = []
try:
    from rag.india_stocks import INDIA_COMPANY_MAP
except ImportError:
    INDIA_COMPANY_MAP = {}

logger = logging.getLogger(__name__)

def get_comparison_data(ticker_a: str, ticker_b: str) -> dict:
    def fetch_one(ticker):
        try:
            is_india = ticker.upper().endswith(".NS") or ticker.upper().endswith(".BO")
            stock_data = get_india_stock_data(ticker) if is_india else get_stock_data(ticker)
            return ticker, {
                "stock": stock_data,
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

    # 1. Match company names — check both US and India maps
    for name, ticker in {**COMPANY_MAP, **INDIA_COMPANY_MAP}.items():
        if name in query_lower and ticker not in found:
            found.append(ticker)

    # 2. Match raw words — preserve .NS / .BO suffixes for Indian tickers
    if len(found) < 2:
        for word in query.upper().split():
            # Allow letters, digits, dots (for .NS/.BO)
            clean = re.sub(r"[^A-Z0-9.]", "", word).strip(".")
            if not clean:
                continue
            # Accept known plain tickers OR anything ending in .NS / .BO
            if (clean in KNOWN_TICKERS or clean.endswith(".NS") or clean.endswith(".BO")) \
                    and clean not in found:
                found.append(clean)

    return tuple(found[:2]) if len(found) >= 2 else None