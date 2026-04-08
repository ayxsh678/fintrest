import os
import concurrent.futures
from rag.retriever import get_stock_data, get_earnings_data, extract_ticker

def get_portfolio_data(tickers: list[str]) -> dict:
    """
    Fetch full breakdown for multiple tickers in parallel.
    Returns a dict of ticker -> {stock_data, earnings_data}
    """
    results = {}

    def fetch_one(ticker):
        return ticker, {
            "stock":    get_stock_data(ticker),
            "earnings": get_earnings_data(ticker),
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_one, t): t for t in tickers}
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


def build_portfolio_context(tickers: list[str]) -> str:
    """
    Assembles full context string for all tickers — passed to LLM.
    """
    data = get_portfolio_data(tickers)
    separator = "\n" + "=" * 30 + "\n"
    parts = []

    for ticker in tickers:
        if ticker not in data:
            continue
        section = (
            f"── {ticker} ──\n"
            f"{data[ticker]['stock']}\n"
            f"{data[ticker]['earnings']}"
        )
        parts.append(section)

    return separator.join(parts)


def extract_tickers_from_query(query: str) -> list[str]:
    """
    Extracts multiple tickers from a single query string.
    e.g. 'track AAPL TSLA NVDA' → ['AAPL', 'TSLA', 'NVDA']
    """
    import re
    from rag.retriever import KNOWN_TICKERS, COMPANY_MAP

    found = []
    query_lower = query.lower()

    # Match company names first (longest first)
    for name in sorted(COMPANY_MAP, key=len, reverse=True):
        if name in query_lower:
            ticker = COMPANY_MAP[name]
            if ticker not in found:
                found.append(ticker)

    # Match raw ticker symbols
    for word in query.upper().split():
        clean = re.sub(r"[^A-Z]", "", word)
        if clean in KNOWN_TICKERS and clean not in found:
            found.append(clean)

    return found