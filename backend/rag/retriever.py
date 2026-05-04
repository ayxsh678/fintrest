import logging
import os
import re
import requests
from datetime import datetime, timedelta
import yfinance as yf

logger = logging.getLogger(__name__)

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
            logger.warning("[Finnhub] error for %s: %s", ticker, e)

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
            logger.warning("[NewsAPI] error for %s: %s", ticker, e)

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
    # Route NSE/BSE symbols through the India pipeline first.
    # That path already includes NSE + Alpha Vantage fallbacks when yfinance
    # is flaky for Indian tickers on some network/IP setups.
    t_upper = ticker.upper()
    if t_upper.endswith(".NS") or t_upper.endswith(".BO"):
        try:
            from rag.india_stocks import get_india_stock_data

            india_data = get_india_stock_data(ticker, as_dict=True)
            if isinstance(india_data, dict) and "error" not in india_data:
                return india_data
        except Exception as e:
            logger.warning("[india_stock_data] error for %s: %s", ticker, e)

    try:
        t    = yf.Ticker(ticker)
        info = t.info

        # Fail fast if yfinance returns empty info (common on Render cold start)
        if not info or not isinstance(info, dict):
            return {"ticker": ticker, "error": "Stock data unavailable"}

        # Get volume ratios from info directly — no extra HTTP call
        avg_vol = info.get("averageVolume") or 1
        cur_vol = info.get("regularMarketVolume") or 0
        rel_vol = round(cur_vol / avg_vol, 2) if avg_vol else None

        # 5-day change — wrap separately so timeout doesn't kill price data
        five_day_change = None
        try:
            hist = t.history(period="5d", interval="1d", timeout=8)
            if len(hist) >= 2:
                old = hist["Close"].iloc[0]
                new = hist["Close"].iloc[-1]
                five_day_change = round(((new - old) / old) * 100, 2) if old else None
        except Exception:
            pass  # five_day_change stays None — price data still returns fine

        return {
            "ticker":          ticker,
            "name":            info.get("longName", ticker),
            "price":           info.get("currentPrice") or info.get("regularMarketPrice"),
            "change":          info.get("regularMarketChangePercent"),
            "five_day_change": five_day_change,
            "market":          "NSE/BSE" if (ticker.upper().endswith(".NS") or ticker.upper().endswith(".BO")) else "US",
            "currency":        info.get("currency", "USD"),
            "market_cap":      info.get("marketCap"),
            "pe_ratio":        info.get("trailingPE"),
            "week52_high":     info.get("fiftyTwoWeekHigh"),
            "week52_low":      info.get("fiftyTwoWeekLow"),
            "rel_volume":      rel_vol,
        }
    except Exception as e:
        logger.warning("[yfinance] error for %s: %s", ticker, e)
        return {"ticker": ticker, "error": "Stock data unavailable"}


# ── Context builder (used by /ask) ─────────────────────

def _extract_tickers(question: str) -> list[str]:
    """Extract tickers from question via centralized alias maps + uppercase regex fallback."""
    # Import here to avoid circular imports; india_stocks does not import retriever
    from rag.india_stocks import INDIA_COMPANY_MAP

    # Merge: INDIA_COMPANY_MAP (comprehensive India) + COMPANY_MAP (India + US/crypto)
    # COMPANY_MAP entries win on conflict (US/crypto overrides where keys overlap)
    alias_map = {**INDIA_COMPANY_MAP, **COMPANY_MAP}

    q_lower = question.lower()
    found: list[str] = []
    seen: set[str] = set()

    # Longest-match first to avoid "hdfc" matching before "hdfc bank"
    for alias in sorted(alias_map, key=len, reverse=True):
        if re.search(r'\b' + re.escape(alias) + r'\b', q_lower):
            ticker = alias_map[alias]
            if ticker not in seen:
                found.append(ticker)
                seen.add(ticker)

    # Fallback: explicit uppercase tickers in the question (e.g. "RELIANCE.NS")
    # Skip if it's a prefix of an already-resolved ticker (e.g. "HDFC" when HDFCBANK.NS found)
    for t in re.findall(r'\b[A-Z]{2,10}(?:[.\-][A-Z]{2,3})?\b', question):
        if t not in seen and not any(s.startswith(t) for s in seen):
            found.append(t)
            seen.add(t)

    return found[:3]


def build_context(question: str, time_range: str = "7d") -> str:
    """Assembles RAG context string for the /ask endpoint."""
    _days_map = {"24h": 1, "3d": 3, "7d": 7, "30d": 30, "1y": 90}
    days = _days_map.get(time_range, 7)

    context_parts = []

    tickers = _extract_tickers(question)

    for ticker in tickers[:2]:
        stock = get_stock_data(ticker)
        if "error" not in stock:
            change = stock.get('change') or 0
            context_parts.append(
                f"Stock: {ticker} | Price: {stock.get('price')} | "
                f"Change: {change:.2f}% | "
                f"Market: {stock.get('market', 'Unknown')}"
            )

        news = get_news_for_ticker(ticker, days=days)
        if news:
            context_parts.append("News: " + " | ".join(
                a["title"] for a in news[:3]
            ))

    return "\n".join(context_parts) if context_parts else "No real-time context available."

# ── Aliases & stubs for backward compatibility ─────────

# Constants expected by portfolio.py and comparison.py.
# India entries are a subset kept for backward compat; INDIA_COMPANY_MAP (india_stocks.py)
# is the authoritative India source. US/crypto entries live here only.
COMPANY_MAP: dict[str, str] = {
    # India (subset — full list in INDIA_COMPANY_MAP)
    "reliance": "RELIANCE.NS", "tcs": "TCS.NS", "infosys": "INFY.NS",
    "wipro": "WIPRO.NS", "hdfc": "HDFCBANK.NS", "icici": "ICICIBANK.NS",
    "sbi": "SBIN.NS", "bajaj": "BAJFINANCE.NS", "adani": "ADANIENT.NS",
    "kotak": "KOTAKBANK.NS", "axis": "AXISBANK.NS", "itc": "ITC.NS",
    "hindustan unilever": "HINDUNILVR.NS", "hul": "HINDUNILVR.NS",
    "maruti": "MARUTI.NS", "tatamotors": "TATAMOTORS.NS", "tata motors": "TATAMOTORS.NS",
    "tatasteel": "TATASTEEL.NS", "tata steel": "TATASTEEL.NS",
    "sunpharma": "SUNPHARMA.NS", "sun pharma": "SUNPHARMA.NS",
    "ongc": "ONGC.NS", "ntpc": "NTPC.NS", "powergrid": "POWERGRID.NS",
    # US / global
    "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL",
    "alphabet": "GOOGL", "amazon": "AMZN", "meta": "META",
    "nvidia": "NVDA", "tesla": "TSLA", "netflix": "NFLX",
    # Crypto
    "bitcoin": "BTC-USD", "btc": "BTC-USD",
    "ethereum": "ETH-USD", "eth": "ETH-USD",
    "solana": "SOL-USD", "sol": "SOL-USD",
}

KNOWN_TICKERS: list[str] = list(COMPANY_MAP.values())


def get_financial_news(
    ticker: str,
    company_name: str = "",
    days: int = 7
) -> list[dict]:
    """Alias for get_news_for_ticker — keeps main.py import working."""
    return get_news_for_ticker(ticker, days=days, company_name=company_name)


def get_earnings_data(ticker: str) -> dict:
    """Fetch upcoming and historical earnings via yfinance."""
    try:
        t       = yf.Ticker(ticker)
        cal     = t.calendar
        info    = t.info

        next_date = None
        if cal is not None and not cal.empty:
            try:
                next_date = str(cal.iloc[0, 0].date())
            except Exception:
                pass

        return {
            "ticker":              ticker,
            "next_earnings_date":  next_date,
            "eps_estimate":        info.get("forwardEps"),
            "eps_actual":          info.get("trailingEps"),
            "revenue_estimate":    info.get("revenueEstimate"),
            "pe_ratio":            info.get("trailingPE"),
            "forward_pe":          info.get("forwardPE"),
        }
    except Exception as e:
        logger.warning("[get_earnings_data] error for %s: %s", ticker, e)
        return {"ticker": ticker, "error": "Earnings data unavailable"}


def detect_asset_type(ticker: str) -> str:
    """
    Detect whether a ticker is a US stock, Indian stock, or crypto.
    Returns: 'india' or 'crypto' (defaults to india for India-focused app)
    """
    ticker = ticker.upper()
    if ticker.endswith(".NS") or ticker.endswith(".BO"):
        return "india"
    crypto_symbols = {
        "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE",
        "MATIC", "DOT", "AVAX", "SHIB", "LTC", "UNI", "LINK"
    }
    if ticker in crypto_symbols:
        return "crypto"
    # Default to India — this app is India-focused
    return "india"


def get_ohlc_yf(ticker: str, days: int = 180) -> dict:
    """OHLC candlestick data from yfinance."""
    try:
        t    = yf.Ticker(ticker)
        hist = t.history(period=f"{days}d", interval="1d")

        if hist.empty:
            return {"ticker": ticker, "ok": False, "rows": [], "source": None}

        rows = []
        for date, row in hist.iterrows():
            rows.append({
                "time":   date.strftime("%Y-%m-%d"),
                "open":   round(float(row["Open"]),  2),
                "high":   round(float(row["High"]),  2),
                "low":    round(float(row["Low"]),   2),
                "close":  round(float(row["Close"]), 2),
                "volume": int(row["Volume"])
            })

        return {"ticker": ticker, "ok": True, "rows": rows, "source": "Yahoo Finance"}

    except Exception as e:
        logger.warning("[get_ohlc_yf] error for %s: %s", ticker, e)
        return {"ticker": ticker, "ok": False, "rows": [], "source": None}
