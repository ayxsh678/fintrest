import re
import concurrent.futures
from rag.retriever import get_stock_data, get_earnings_data

KNOWN_TICKERS = {
    "AAPL","TSLA","NVDA","MSFT","GOOGL","GOOG","AMZN","META","NFLX","AMD",
    "INTC","ORCL","CRM","ADBE","PYPL","UBER","LYFT","SNAP","TWTR","SHOP",
    "SQ","COIN","HOOD","PLTR","RBLX","DKNG","ABNB","DASH","RIVN","LCID",
    "NIO","BABA","JD","PDD","BIDU","TSM","ASML","ARM","QCOM","TXN","MU",
    "WMT","TGT","COST","HD","LOW","MCD","SBUX","NKE","DIS","NFLX","V","MA",
    "JPM","BAC","WFC","GS","MS","BRK","XOM","CVX","PFE","JNJ","UNH","LLY"
}

COMPANY_MAP = {
    "apple": "AAPL", "tesla": "TSLA", "nvidia": "NVDA", "microsoft": "MSFT",
    "google": "GOOGL", "alphabet": "GOOGL", "amazon": "AMZN", "meta": "META",
    "facebook": "META", "netflix": "NFLX", "amd": "AMD", "intel": "INTC",
    "oracle": "ORCL", "salesforce": "CRM", "adobe": "ADBE", "paypal": "PYPL",
    "uber": "UBER", "shopify": "SHOP", "coinbase": "COIN", "palantir": "PLTR",
    "roblox": "RBLX", "airbnb": "ABNB", "rivian": "RIVN", "walmart": "WMT",
    "disney": "DIS", "visa": "V", "mastercard": "MA", "jpmorgan": "JPM",
    "nike": "NKE", "starbucks": "SBUX",
}

def get_portfolio_data(tickers: list[str]) -> dict:
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
    found = []
    query_lower = query.lower()

    for name in sorted(COMPANY_MAP, key=len, reverse=True):
        if name in query_lower:
            ticker = COMPANY_MAP[name]
            if ticker not in found:
                found.append(ticker)

    for word in query.upper().split():
        clean = re.sub(r"[^A-Z]", "", word)
        if clean in KNOWN_TICKERS and clean not in found:
            found.append(clean)

    return found
