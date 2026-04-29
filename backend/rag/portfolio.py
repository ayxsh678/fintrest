import re
import concurrent.futures
from rag.retriever import (
    get_stock_data, get_earnings_data, detect_asset_type, COMPANY_MAP, KNOWN_TICKERS
)
from rag.india_stocks import get_india_stock_data, INDIA_COMPANY_MAP


# ── Data fetcher ───────────────────────────────────────

def get_portfolio_data(tickers: list[str]) -> dict:
    """Fetch data for each ticker — NSE/BSE stocks only."""

    def fetch_one(ticker):
        asset = detect_asset_type(ticker)

        if asset["type"] == "india_stock" and asset["identifier"]:
            return ticker, {
                "stock":      get_india_stock_data(asset["identifier"]),
                "earnings":   get_earnings_data(asset["identifier"]),
                "asset_type": "india_stock",
            }
        else:
            # Treat any bare ticker (e.g. RELIANCE without suffix) as NSE
            nse_ticker = ticker if ticker.endswith((".NS", ".BO")) else f"{ticker}.NS"
            return ticker, {
                "stock":      get_stock_data(nse_ticker),
                "earnings":   get_earnings_data(nse_ticker),
                "asset_type": "india_stock",
            }

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_one, t): t for t in tickers}
        for future in concurrent.futures.as_completed(futures):
            try:
                ticker, data = future.result()
                results[ticker] = data
            except Exception as e:
                t = futures[future]
                results[t] = {
                    "stock":      f"Data unavailable for {t}: {str(e)}",
                    "earnings":   "Unavailable.",
                    "asset_type": "unknown",
                }
    return results


# ── Context builder ────────────────────────────────────

def build_portfolio_context(tickers: list[str]) -> str:
    data      = get_portfolio_data(tickers)
    separator = "\n" + "=" * 30 + "\n"
    parts     = []

    ASSET_LABELS = {
        "india_stock": "NSE/BSE",
    }

    for ticker in tickers:
        if ticker not in data:
            continue
        label   = ASSET_LABELS.get(data[ticker].get("asset_type", ""), "")
        header  = f"── {ticker}{f' ({label})' if label else ''} ──"
        section = f"{header}\n{data[ticker]['stock']}\n{data[ticker]['earnings']}"
        parts.append(section)

    return separator.join(parts)


# ── Ticker extractor ───────────────────────────────────

def extract_tickers_from_query(query: str) -> list[str]:
    """
    Extract all recognizable tickers from a natural language query.
    Checks crypto → India stocks → US stocks → raw symbols, in that order.
    """
    found       = []
    query_lower = query.lower()

    # Crypto — check by name/symbol
    for name in sorted(COIN_MAP, key=len, reverse=True):
        if name in query_lower and name.upper() not in found:
            found.append(name.upper())

    # India stocks — check by company name
    for name in sorted(INDIA_COMPANY_MAP, key=len, reverse=True):
        if name in query_lower:
            ticker = INDIA_COMPANY_MAP[name]
            if ticker not in found:
                found.append(ticker)

    # US stocks — check by company name
    for name in sorted(COMPANY_MAP, key=len, reverse=True):
        if name in query_lower:
            ticker = COMPANY_MAP[name]
            if ticker not in found:
                found.append(ticker)

    # Raw ticker symbols (e.g. "AAPL", "RELIANCE.NS")
    for word in query.upper().split():
        clean = re.sub(r"[^A-Z0-9.&-]", "", word)
        if clean in KNOWN_TICKERS and clean not in found:
            found.append(clean)

    return found