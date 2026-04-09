import yfinance as yf
import requests
import os
import re
import logging
from datetime import datetime

# Setup logging for production debugging
logger = logging.getLogger(__name__)

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# --- Constants for Comparison Logic ---
# These are required by comparison.py to avoid the ImportError
COMPANY_MAP = {
    "apple": "AAPL",
    "tesla": "TSLA",
    "nvidia": "NVDA",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "amazon": "AMZN",
    "meta": "META",
    "netflix": "NFLX",
    "reliance": "RELIANCE"
}

KNOWN_TICKERS = list(COMPANY_MAP.values()) + ["JPM", "BAC", "WMT", "BRK-B", "V", "MA"]

# --- Stock Price Data ---
def get_stock_data(ticker: str) -> str:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period="5d")

        if not info or 'longName' not in info:
            return f"No specific data found for ticker: {ticker}"

        # Calculate 5-day change safely
        five_day_change = "N/A"
        if not hist.empty and len(hist) >= 2:
            change = ((hist['Close'].iloc[-1] - hist['Close'].iloc[0]) / hist['Close'].iloc[0] * 100)
            five_day_change = f"{change:.2f}%"

        return f"""
Stock: {info.get('longName', ticker)} ({ticker})
Current Price: ${info.get('currentPrice', 'N/A')}
Previous Close: ${info.get('previousClose', 'N/A')}
52W High: ${info.get('fiftyTwoWeekHigh', 'N/A')}
52W Low: ${info.get('fiftyTwoWeekLow', 'N/A')}
P/E Ratio: {info.get('trailingPE', 'N/A')}
Market Cap: ${info.get('marketCap', 0):,}
EPS: {info.get('trailingEps', 'N/A')}
Dividend Yield: {info.get('dividendYield', 'N/A')}
5-Day Change: {five_day_change}
"""
    except Exception as e:
        logger.error(f"Error in get_stock_data for {ticker}: {e}")
        return f"Stock data unavailable for {ticker}."

# --- Financial News ---
def get_financial_news(query: str, max_articles: int = 3) -> str:
    if not NEWS_API_KEY:
        return "News API key not configured."
    
    try:
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": f"{query} finance",
            "apiKey": NEWS_API_KEY,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": max_articles,
        }
        response = requests.get(url, params=params, timeout=10)
        articles = response.json().get("articles", [])

        if not articles:
            return "No recent news found."

        news_text = "Recent Financial News:\n"
        for i, article in enumerate(articles, 1):
            news_text += f"\n{i}. {article['title']}\n   Source: {article['source']['name']} | {article['publishedAt'][:10]}\n"
        return news_text
    except Exception as e:
        return f"News unavailable: {str(e)}"

# --- Earnings Data ---
def get_earnings_data(ticker: str) -> str:
    try:
        stock = yf.Ticker(ticker)
        earnings = stock.earnings_dates
        if earnings is not None and not earnings.empty:
            result = f"Recent Earnings for {ticker}:\n"
            for date, row in earnings.head(4).iterrows():
                result += f"Date: {str(date)[:10]} | EPS Est: {row.get('EPS Estimate', 'N/A')} | Reported: {row.get('Reported EPS', 'N/A')}\n"
            return result
        return "No upcoming/recent earnings dates found."
    except Exception as e:
        return "Earnings data currently unavailable."

# --- Context Builders ---
def extract_ticker(query: str) -> str | None:
    words = query.upper().split()
    tickers = [re.sub(r'[^A-Z]', '', w) for w in words if re.match(r'^[A-Z]{1,5}$', re.sub(r'[^A-Z]', '', w))]
    
    for t in tickers:
        if t in KNOWN_TICKERS:
            return t
    return tickers[0] if tickers else None

def build_context(query: str) -> str:
    context_parts = []
    
    # Get news context
    context_parts.append(get_financial_news(query))

    # Get stock-specific context
    ticker = extract_ticker(query)
    if ticker:
        context_parts.append(get_stock_data(ticker))
        context_parts.append(get_earnings_data(ticker))

    return "\n---\n".join(context_parts)