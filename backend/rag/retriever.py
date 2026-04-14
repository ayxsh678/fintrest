import time
import os
import re
import requests
import feedparser
import yfinance as yf
import pandas as pd

# Fix Yahoo Finance 401 crumb errors on cloud servers
yf.set_tz_cache_location("/tmp/yfinance_cache")
_yf_session = requests.Session()
_yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
})
from datetime import datetime, timedelta
from cachetools import TTLCache
from threading import Lock
from rag.crypto import get_coin_id, get_crypto_data, get_crypto_news, KNOWN_COINS
from rag.india_stocks import extract_india_ticker, get_india_stock_data, INDIA_COMPANY_MAP
from rag.forex import detect_forex_query, get_forex_data, get_all_forex_snapshot

NEWS_API_KEY     = os.getenv("NEWS_API_KEY")
TAKETODAY_FEED   = "https://taketoday.co/feed"
TAKETODAY_WP_API = "https://taketoday.co/wp-json/wp/v2/posts"

# ── Cache setup ────────────────────────────────────────
stock_cache     = TTLCache(maxsize=50,  ttl=300)
news_cache      = TTLCache(maxsize=100, ttl=300)
earnings_cache  = TTLCache(maxsize=50,  ttl=3600)
taketoday_cache = TTLCache(maxsize=50,  ttl=600)

stock_lock     = Lock()
news_lock      = Lock()
earnings_lock  = Lock()
taketoday_lock = Lock()

TIME_RANGE_MAP = {
    "24h": 1, "3d": 3, "7d": 7, "30d": 30, "1y": 365
}

# ── US company map ─────────────────────────────────────
COMPANY_MAP = {
    "apple": "AAPL", "tesla": "TSLA", "google": "GOOGL",
    "alphabet": "GOOGL", "microsoft": "MSFT", "amazon": "AMZN",
    "meta": "META", "facebook": "META", "nvidia": "NVDA",
    "netflix": "NFLX", "jpmorgan": "JPM", "jp morgan": "JPM",
    "j.p. morgan": "JPM", "bank of america": "BAC", "walmart": "WMT",
    "visa": "V", "mastercard": "MA", "berkshire": "BRK-B",
    "amd": "AMD", "intel": "INTC", "qualcomm": "QCOM",
    "salesforce": "CRM", "oracle": "ORCL", "adobe": "ADBE",
    "paypal": "PYPL", "shopify": "SHOP", "uber": "UBER",
    "airbnb": "ABNB", "spotify": "SPOT", "snap": "SNAP",
    "twitter": "X", "coinbase": "COIN", "robinhood": "HOOD",
}

KNOWN_TICKERS = set(COMPANY_MAP.values()) | {
    "AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "META", "NVDA",
    "NFLX", "JPM", "BAC", "WMT", "V", "MA", "AMD", "INTC",
    "QCOM", "CRM", "ORCL", "ADBE", "PYPL", "SHOP", "UBER",
    "ABNB", "SPOT", "SNAP", "COIN", "HOOD",
}


# ── Asset type detection ───────────────────────────────

def detect_asset_type(query: str) -> dict:
    query_lower = query.lower()

    # Forex first
    forex_pair = detect_forex_query(query)
    if forex_pair:
        return {"type": "forex", "identifier": forex_pair}

    # Crypto keywords
    crypto_keywords = ["crypto", "bitcoin", "ethereum", "coin", "token",
                       "blockchain", "defi", "nft", "web3", "binance",
                       "coindcx", "wazirx"]
    if any(kw in query_lower for kw in crypto_keywords):
        coin_id = get_coin_id(query_lower)
        if coin_id:
            return {"type": "crypto", "identifier": coin_id}

    for word in query_lower.split():
        coin_id = get_coin_id(word)
        if coin_id:
            return {"type": "crypto", "identifier": coin_id}

    # India stock keywords
    india_keywords = ["nse", "bse", "nifty", "sensex", "rupee", "inr",
                      "india", "indian", ".ns", ".bo"]
    if any(kw in query_lower for kw in india_keywords):
        ticker = extract_india_ticker(query)
        if ticker:
            return {"type": "india_stock", "identifier": ticker}

    india_ticker = extract_india_ticker(query)
    if india_ticker:
        return {"type": "india_stock", "identifier": india_ticker}

    us_ticker = extract_us_ticker(query)
    if us_ticker:
        return {"type": "us_stock", "identifier": us_ticker}

    return {"type": "unknown", "identifier": None}


def extract_us_ticker(query: str) -> str | None:
    query_lower = query.lower()
    for name in sorted(COMPANY_MAP, key=len, reverse=True):
        if name in query_lower:
            return COMPANY_MAP[name]
    for word in query.upper().split():
        clean = re.sub(r"[^A-Z]", "", word)
        if clean in KNOWN_TICKERS:
            return clean
    return None


def extract_ticker(query: str) -> str | None:
    return extract_us_ticker(query)


# ── Stock data (US) ────────────────────────────────────

def get_stock_data(ticker: str) -> str:
    with stock_lock:
        if ticker in stock_cache:
            return stock_cache[ticker]
    try:
        time.sleep(0.5)  # prevent Yahoo Finance rate limiting
        stock = yf.Ticker(ticker)

        # fast_info is lighter and less rate-limited than stock.info
        fi   = stock.fast_info
        hist     = stock.history(period="5d")
        hist_30d = stock.history(period="30d")

        if hist.empty:
            return f"No price history found for {ticker}."

        first_close = hist["Close"].iloc[0]
        change_pct = (
            (hist["Close"].iloc[-1] - first_close) / first_close * 100
            if first_close else 0.0
        )
        avg_volume_30d = hist_30d["Volume"].mean() if not hist_30d.empty else 0
        latest_volume  = hist["Volume"].iloc[-1]
        rel_volume = (
            f"{latest_volume / avg_volume_30d:.2f}x"
            if avg_volume_30d > 0 else "N/A"
        )

        # fast_info doesn't have longName — fall back to ticker
        try:
            long_name = stock.info.get("longName", ticker)
        except Exception:
            long_name = ticker

        price      = fi.last_price      or "N/A"
        prev_close = fi.previous_close  or "N/A"
        week_high  = fi.fifty_two_week_high or "N/A"
        week_low   = fi.fifty_two_week_low  or "N/A"
        market_cap = int(fi.market_cap or 0)

        # PE and EPS not in fast_info — attempt quietly, skip if rate limited
        try:
            info = stock.info
            pe   = info.get("trailingPE",  "N/A")
            eps  = info.get("trailingEps", "N/A")
        except Exception:
            pe  = "N/A"
            eps = "N/A"

        result = (
            f"Stock: {long_name} ({ticker})\n"
            f"Current Price: ${price}\n"
            f"Previous Close: ${prev_close}\n"
            f"52W High: ${week_high}\n"
            f"52W Low: ${week_low}\n"
            f"P/E Ratio: {pe}\n"
            f"Market Cap: ${market_cap:,}\n"
            f"EPS: {eps}\n"
            f"5-Day Change: {change_pct:.2f}%\n"
            f"Latest Volume: {int(latest_volume):,}\n"
            f"30D Avg Volume: {int(avg_volume_30d):,}\n"
            f"Relative Volume: {rel_volume}"
        )
    except Exception as e:
        result = f"Stock data unavailable: {str(e)}"

    with stock_lock:
        stock_cache[ticker] = result
    return result

# ── NewsAPI ────────────────────────────────────────────

def get_financial_news(query: str, ticker: str = None,
                        time_range: str = "7d") -> str:
    cache_key = f"{ticker or query}_{time_range}"
    with news_lock:
        if cache_key in news_cache:
            return news_cache[cache_key]

    if not NEWS_API_KEY:
        return "News unavailable: NEWS_API_KEY not set."

    days      = TIME_RANGE_MAP.get(time_range, 7)
    from_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        response = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": ticker or query,
                "apiKey": NEWS_API_KEY,
                "language": "en",
                "sortBy": "relevancy",
                "pageSize": 5,
                "from": from_date,
            },
            headers={"User-Agent": "FinanceAI/1.0"},
            timeout=10
        )
        response.raise_for_status()
        data     = response.json()
        articles = data.get("articles", [])

        if not articles:
            return f"No news found for '{ticker or query}' in last {time_range}."

        lines = [f"Recent Financial News (last {time_range}):"]
        for i, article in enumerate(articles, 1):
            try:
                pub   = datetime.strptime(article["publishedAt"][:19], "%Y-%m-%dT%H:%M:%S")
                delta = datetime.utcnow() - pub
                age   = f"{delta.seconds // 3600}h ago" if delta.days == 0 else f"{delta.days}d ago"
            except Exception:
                age = article["publishedAt"][:10]
            lines.append(
                f"{i}. {article['title']}\n"
                f"   {article['source']['name']} | {age}"
            )
        result = "\n".join(lines)

    except requests.exceptions.Timeout:
        result = "News unavailable: request timed out."
    except requests.exceptions.HTTPError as e:
        result = f"News unavailable: HTTP {e.response.status_code}"
    except Exception as e:
        result = f"News unavailable: {str(e)}"

    with news_lock:
        news_cache[cache_key] = result
    return result


# ── TakeToday ──────────────────────────────────────────

def get_taketoday_news(query: str) -> str:
    cache_key = query.lower().strip()
    with taketoday_lock:
        if cache_key in taketoday_cache:
            return taketoday_cache[cache_key]

    result = _fetch_taketoday_wp(query) or _fetch_taketoday_rss(query) or ""

    with taketoday_lock:
        taketoday_cache[cache_key] = result
    return result


def _fetch_taketoday_wp(query: str) -> str:
    try:
        response = requests.get(
            TAKETODAY_WP_API,
            params={"search": query, "per_page": 3,
                    "_fields": "title,excerpt,date,link"},
            timeout=8
        )
        response.raise_for_status()
        articles = response.json()
        if not articles:
            return ""
        lines = ["TakeToday (verified source):"]
        for article in articles:
            title   = re.sub(r"<[^>]+>", "", article["title"]["rendered"]).strip()
            excerpt = re.sub(r"<[^>]+>", "", article["excerpt"]["rendered"]).strip()[:120]
            date    = article["date"][:10]
            lines.append(f"- {title} ({date})\n  {excerpt}...")
        return "\n".join(lines)
    except Exception:
        return ""


def _fetch_taketoday_rss(query: str) -> str:
    try:
        feed        = feedparser.parse(TAKETODAY_FEED)
        query_words = [w for w in query.lower().split() if len(w) > 3]
        relevant    = [
            entry for entry in feed.entries
            if any(
                word in entry.get("title", "").lower() or
                word in entry.get("summary", "").lower()
                for word in query_words
            )
        ][:3]
        if not relevant:
            return ""
        lines = ["TakeToday (verified source):"]
        for entry in relevant:
            summary   = re.sub(r"<[^>]+>", "", entry.get("summary", "")).strip()[:120]
            published = entry.get("published", "")[:10]
            lines.append(f"- {entry.title} ({published})\n  {summary}...")
        return "\n".join(lines)
    except Exception:
        return ""


# ── Earnings ───────────────────────────────────────────

def get_earnings_data(ticker: str) -> str:
    with earnings_lock:
        if ticker in earnings_cache:
            return earnings_cache[ticker]

    try:
        stock    = yf.Ticker(ticker)
        calendar = stock.calendar

        if calendar is None:
            return "No upcoming earnings schedule."

        if isinstance(calendar, dict):
            if not calendar:
                return "No upcoming earnings schedule."
            lines = [f"Earnings Schedule for {ticker}:"]
            for key, value in calendar.items():
                lines.append(f"- {key}: {value}")
            result = "\n".join(lines)
        elif isinstance(calendar, pd.DataFrame):
            if calendar.empty:
                return "No upcoming earnings schedule."
            lines = [f"Earnings Schedule for {ticker}:"]
            for index, row in calendar.iterrows():
                lines.append(f"- {index}: {row.values[0]}")
            result = "\n".join(lines)
        else:
            result = "Earnings data format unrecognized."

    except Exception:
        result = "Earnings data currently unavailable."

    with earnings_lock:
        earnings_cache[ticker] = result
    return result


# ── Context assembly ───────────────────────────────────

def build_context(query: str, time_range: str = "7d") -> str:
    asset      = detect_asset_type(query)
    asset_type = asset["type"]
    identifier = asset["identifier"]

    taketoday     = get_taketoday_news(query)
    news          = get_financial_news(query, identifier, time_range=time_range)
    context_parts = []

    if taketoday:
        context_parts.append(taketoday)
    if news:
        context_parts.append(news)

    if asset_type == "forex":
        if identifier == "ALL":
            context_parts.append(get_all_forex_snapshot())
        else:
            context_parts.append(get_forex_data(identifier))

    elif asset_type == "crypto" and identifier:
        context_parts.append(get_crypto_data(identifier))
        trending = get_crypto_news(identifier)
        if trending:
            context_parts.append(trending)

    elif asset_type == "india_stock" and identifier:
        context_parts.append(get_india_stock_data(identifier))
        context_parts.append(get_earnings_data(identifier))

    elif asset_type == "us_stock" and identifier:
        context_parts.append(get_stock_data(identifier))
        context_parts.append(get_earnings_data(identifier))

    separator = "\n" + "=" * 30 + "\n"
    return separator.join(context_parts)