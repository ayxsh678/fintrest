import yfinance as yf
import requests
import os
import re

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY")

# ── Company name to ticker mapping ─────────────────────
COMPANY_MAP = {
    "apple": "AAPL", "tesla": "TSLA", "google": "GOOGL",
    "alphabet": "GOOGL", "microsoft": "MSFT", "amazon": "AMZN",
    "meta": "META", "facebook": "META", "nvidia": "NVDA",
    "netflix": "NFLX", "jpmorgan": "JPM", "jp morgan": "JPM",
    "bank of america": "BAC", "walmart": "WMT", "visa": "V",
    "mastercard": "MA", "reliance": "RELIANCE.NS",
    "berkshire": "BRK-B", "tata": "TCS.NS", "infosys": "INFY",
}

KNOWN_TICKERS = set(COMPANY_MAP.values()) | {
    "AAPL","TSLA","GOOGL","MSFT","AMZN","META","NVDA",
    "NFLX","JPM","BAC","WMT","V","MA","INFY","TCS"
}

# ── Stock Price Data ────────────────────────────────────
def get_stock_data(ticker: str) -> str:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period="5d")
        return f"""
Stock: {info.get('longName', ticker)} ({ticker})
Current Price: ${info.get('currentPrice', 'N/A')}
Previous Close: ${info.get('previousClose', 'N/A')}
52W High: ${info.get('fiftyTwoWeekHigh', 'N/A')}
52W Low: ${info.get('fiftyTwoWeekLow', 'N/A')}
P/E Ratio: {info.get('trailingPE', 'N/A')}
Market Cap: ${info.get('marketCap', 'N/A'):,}
EPS: {info.get('trailingEps', 'N/A')}
Dividend Yield: {info.get('dividendYield', 'N/A')}
5-Day Change: {((hist['Close'].iloc[-1] - hist['Close'].iloc[0]) / hist['Close'].iloc[0] * 100):.2f}%
"""
    except Exception as e:
        return f"Stock data unavailable for {ticker}: {str(e)}"

# ── Financial News ──────────────────────────────────────
def get_financial_news(query: str, max_articles: int = 3) -> str:
    try:
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": f"{query} finance",
            "apiKey": NEWS_API_KEY,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": max_articles,
        }
        response = requests.get(url, params=params)
        articles = response.json().get("articles", [])
        if not articles:
            return "No recent news found."
        news_text = "Recent Financial News:\n"
        for i, article in enumerate(articles, 1):
            news_text += f"""
{i}. {article['title']}
   Source: {article['source']['name']}
   Date: {article['publishedAt'][:10]}
   Summary: {article.get('description', 'N/A')}
"""
        return news_text
    except Exception as e:
        return f"News unavailable: {str(e)}"

# ── Earnings Data ───────────────────────────────────────
def get_earnings_data(ticker: str) -> str:
    try:
        stock = yf.Ticker(ticker)
        earnings = stock.earnings_dates
        if earnings is not None and not earnings.empty:
            result = f"Recent Earnings for {ticker}:\n"
            for date, row in earnings.head(4).iterrows():
                result += f"""
Date: {str(date)[:10]}
EPS Estimate: {row.get('EPS Estimate', 'N/A')}
Reported EPS: {row.get('Reported EPS', 'N/A')}
Surprise(%): {row.get('Surprise(%)', 'N/A')}
"""
            return result
        return "Earnings data unavailable."
    except Exception as e:
        return f"Earnings data unavailable: {str(e)}"

# ── Smart Ticker Extractor ──────────────────────────────
def extract_ticker(query: str) -> str | None:
    query_lower = query.lower()

    # 1. Check company name mapping first
    for name, ticker in COMPANY_MAP.items():
        if name in query_lower:
            return ticker

    # 2. Look for explicit known tickers in uppercase (e.g. "AAPL")
    words = query.upper().split()
    for word in words:
        clean = re.sub(r'[^A-Z]', '', word)
        if clean in KNOWN_TICKERS:
            return clean

    return None

# ── Smart Context Builder ───────────────────────────────
def build_context(query: str) -> str:
    context_parts = []

    news = get_financial_news(query)
    context_parts.append(news)

    ticker = extract_ticker(query)
    if ticker:
        stock = get_stock_data(ticker)
        earnings = get_earnings_data(ticker)
        context_parts.append(f"Stock: {stock}")
        context_parts.append(f"Earnings: {earnings}")

    return "\n---\n".join(context_parts)
