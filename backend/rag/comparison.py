import concurrent.futures
from rag.retriever import get_stock_data, get_earnings_data
from rag.retriever import COMPANY_MAP, KNOWN_TICKERS
import re


def get_comparison_data(ticker_a: str, ticker_b: str) -> dict:
    """Fetch full data for both tickers in parallel."""

    def fetch_one(ticker):
        return ticker, {
            "stock":    get_stock_data(ticker),
            "earnings": get_earnings_data(ticker),
        }

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(fetch_one, t): t for t in [ticker_a, ticker_b]}
        for future in concurrent.futures.as_completed(futures):
            try:
                ticker, data = future.result()
                results[ticker] = data
            except Exception as e:
                t = futures[future]
                results[t] = {
                    "stock":    f"Data unavailable for {t}: {str(e)}",
                    "earnings": "Earnings unavailable.",
                }
    return results


def build_comparison_context(ticker_a: str, ticker_b: str) -> str:
    """Assembles side-by-side context string for the LLM."""
    data = get_comparison_data(ticker_a, ticker_b)
    separator = "\n" + "=" * 30 + "\n"

    parts = []
    for ticker in [ticker_a, ticker_b]:
        section = (
            f"── {ticker} ──\n"
            f"{data.get(ticker, {}).get('stock', 'N/A')}\n"
            f"{data.get(ticker, {}).get('earnings', 'N/A')}"
        )
        parts.append(section)

    return separator.join(parts)


def extract_comparison_tickers(query: str) -> tuple[str, str] | None:
    """
    Extracts exactly two tickers from a comparison query.
    Handles: 'compare AAPL vs TSLA', 'AAPL or TSLA', 'AAPL versus TSLA'
    Returns (ticker_a, ticker_b) or None if fewer than 2 found.
    """
    query_lower = query.lower()
    found = []

    # Match company names first (longest first)
    for name in sorted(COMPANY_MAP, key=len, reverse=True):
        if name in query_lower:
            ticker = COMPANY_MAP[name]
            if ticker not in found:
                found.append(ticker)
            if len(found) == 2:
                break

    # Match raw ticker symbols
    if len(found) < 2:
        for word in query.upper().split():
            clean = re.sub(r"[^A-Z]", "", word)
            if clean in KNOWN_TICKERS and clean not in found:
                found.append(clean)
            if len(found) == 2:
                break

    if len(found) < 2:
        return None

    return found[0], found[1]