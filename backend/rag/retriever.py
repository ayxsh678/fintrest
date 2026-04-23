import os
import requests
from datetime import datetime, timedelta
import yfinance as yf

FINNHUB_KEY = os.getenv("FINNHUB_API_KEY")
NEWSAPI_KEY  = os.getenv("NEWS_API_KEY")

# ── News ───────────────────────────────────────────────

def get_news_for_ticker(
    ticker: str,
    days: int = 7,
    company_name: str = ""
) -> list[dict]:
    """
    Fetch real financial headlines for a ticker.
    Tries Finnhub first (finance-native), falls back to NewsAPI.
    Filters out non-financial articles (deals, gadget reviews, etc.)
    """
    articles = []
    end_date   = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    # Strip exchange suffix: RELIANCE.NS → RELIANCE
    base_ticker = ticker.split(".")[0]

    # ── Source 1: Finnhub (purpose-built for stocks, free tier) ──
    if FINNHUB_KEY:
        try:
            resp = requests.get(
                "https://finnhub.io/api/v1/company-news",
                params={
                    "symbol": base_ticker,
                    "from":   start_date,
                    "to":     end_date,
                    "token":  FINNHUB_KEY
                },
                timeout=10
            )
            data = resp.json()
            if isinstance(data, list):
                for item in data[:15]:
                    articles.append({
                        "title":        item.get("headline", ""),
                        "summary":      item.get("summary", ""),
                        "source":       item.get("source", ""),
                        "url":          item.get("url", ""),
                        "published_at": datetime.fromtimestamp(
                            item.get("datetime", 0)
                        ).strftime("%Y-%m-%d")
                    })
        except Exception as e:
            print(f"[Finnhub] error for {ticker}: {e}")

    # ── Source 2: NewsAPI fallback ─────────────────────
    if not articles and NEWSAPI_KEY:
        search_term = company_name if company_name else base_ticker
        try:
            resp = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q":        f'"{search_term}" (stock OR earnings OR revenue OR shares OR NSE OR BSE)',
                    "sortBy":   "publishedAt",
                    "language": "en",
                    "pageSize": 15,
                    "from":     start_date,
                    "apiKey":   NEWSAPI_KEY
                },
                timeout=10
            )
            data = resp.json()
            for item in data.get("articles", []):
                articles.append({
                    "title":        item.get("title", ""),
                    "summary":      item.get("description", "") or "",
                    "source":       item.get("source", {}).get("name", ""),
                    "url":          item.get("url", ""),
                    "published_at": (item.get("publishedAt", "") or "")[:10]
                })
        except Exception as e:
            print(f"[NewsAPI] error for {ticker}: {e}")

    # ── Filter: keep only financially relevant articles ──
    FINANCIAL_SIGNALS = [
        "earnings", "revenue", "profit", "loss", "quarterly", "annual",
        "dividend", "buyback", "guidance", "analyst", "upgrade", "downgrade",
        "target price", "ipo", "results", "margin", "outlook", "forecast",
        "merger", "acquisition", "stake", "shares", "market cap",
        # Indian market specific
        "nse", "bse", "sensex", "nifty", "crore", "lakh", "sebi",
        "promoter", "roe", "ebitda", "pat", "q1", "q2", "q3", "q4",
    ]

    # Explicit noise patterns to drop
    NOISE_PATTERNS = [
        "deals of the week", "best deals", "% off", "discount",
        "review:", "hands-on", "how to use", "tips and tricks",
    ]

    filtered = []
    for a in articles:
        text = (a["title"] + " " + a["summary"]).lower()

        # Drop clear noise
        if any(noise in text for noise in NOISE_PATTERNS):
            continue

        # Keep if contains financial signal
        if any(signal in text for signal in FINANCIAL_SIGNALS):
            filtered.append(a)

    # Fallback: if filter is too aggressive, return top 5 unfiltered
    return filtered[:10] if filtered else articles[:5]


# ── Stock ──────────────────────────────────────────────

def get_stock_data(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        return {
            "ticker":   ticker,
            "name":     info.get("longName", ticker),
            "price":    info.get("currentPrice") or info.get("regularMarketPrice"),
            "change":   info.get("regularMarketChangePercent"),
            "market":   "NSE/BSE" if "." in ticker else "US",
            "currency": info.get("currency", "USD"),
        }
    except Exception as e:
        print(f"[yfinance] error for {ticker}: {e}")
        return {"ticker": ticker, "error": "Stock data unavailable"}


# ── Context builder (used by /ask) ─────────────────────

def build_context(question: str, time_range: str = "7d") -> str:
    """
    Assembles RAG context string for the /ask endpoint.
    Existing logic — keep as-is.
    """
    context_parts = []

    # Extract ticker from question if present
    import re
    tickers = re.findall(r'\b[A-Z]{2,5}(?:\.[A-Z]{2})?\b', question)

    for ticker in tickers[:2]:  # cap at 2 tickers per query
        stock = get_stock_data(ticker)
        if "error" not in stock:
            context_parts.append(
                f"Stock: {ticker} | Price: {stock.get('price')} | "
                f"Change: {stock.get('change', 0):.2f}%"
            )

        news = get_news_for_ticker(ticker, days=7)
        if news:
            context_parts.append("News: " + " | ".join(
                a["title"] for a in news[:3]
            ))

    return "\n".join(context_parts) if context_parts else "No real-time context available."