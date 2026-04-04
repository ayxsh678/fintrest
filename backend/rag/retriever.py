import yfinance as yf
import requests
import os
from datetime import datetime, timedelta

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY")

# ── Stock Price Data ───────────────────────────────────
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

# ── Financial News ─────────────────────────────────────
def get_financial_news(query: str, max_articles: int = 3) -> str:
    try:
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": f"{query} finance",
            "apiKey": NEWS_API_KEY,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": max_articles,
            # ✅ Removed 'from' date filter
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

# ── Smart Context Builder ──────────────────────────────
def extract_ticker(query: str) -> str | None:
    """Detect stock tickers in query (e.g. AAPL, TSLA)"""
    import re
    words = query.upper().split()
    # Common tickers are 1-5 uppercase letters
    tickers = [w for w in words if re.match(r'^[A-Z]{1,5}$', w)]
    known = ["AAPL","TSLA","GOOGL","MSFT","AMZN","META","NVDA",
             "NFLX","JPM","BAC","WMT","BRK","V","MA","RELIANCE"]
    for t in tickers:
        if t in known:
            return t
    return tickers[0] if tickers else None

def build_context(query: str) -> str:
    """Build rich context from all data sources"""
    context_parts = []

    # Always get news
    news = get_financial_news(query)
    context_parts.append(news)

    # Get stock data if ticker detected
    ticker = extract_ticker(query)
    if ticker:
        stock = get_stock_data(ticker)
        earnings = get_earnings_data(ticker)
        context_parts.append(stock)
        context_parts.append(earnings)

    return "\n---\n".join(context_parts)