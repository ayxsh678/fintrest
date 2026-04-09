import os
import requests
from datetime import datetime, timedelta

# VADER is part of nltk — install with: pip install nltk vaderSentiment
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()

# Simple in-memory cache: { ticker: { score, label, headlines, cached_at } }
_cache: dict[str, dict] = {}
_CACHE_TTL_MINUTES = 30


def _is_cached(ticker: str) -> bool:
    entry = _cache.get(ticker)
    if not entry:
        return False
    age = (datetime.utcnow() - entry["cached_at"]).total_seconds() / 60
    return age < _CACHE_TTL_MINUTES


def _fetch_headlines(ticker: str, company_name: str = "") -> list[str]:
    """Fetch recent headlines from NewsAPI for a given ticker."""
    api_key = os.getenv("NEWSAPI_KEY", "")
    if not api_key:
        return []

    query = f"{ticker} stock" if not company_name else f"{company_name} OR {ticker} stock"
    from_date = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")

    try:
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "from": from_date,
                "sortBy": "publishedAt",
                "language": "en",
                "pageSize": 20,
                "apiKey": api_key,
            },
            timeout=8,
        )
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        headlines = []
        for a in articles:
            title = (a.get("title") or "").strip()
            desc  = (a.get("description") or "").strip()
            if title and title != "[Removed]":
                headlines.append(f"{title}. {desc}" if desc else title)
        return headlines
    except Exception:
        return []


def _score_headlines(headlines: list[str]) -> tuple[float, str]:
    """
    Run VADER on each headline, average the compound scores.
    Returns (score_0_to_100, label).
    """
    if not headlines:
        return 50.0, "Neutral"

    compounds = [_analyzer.polarity_scores(h)["compound"] for h in headlines]
    avg = sum(compounds) / len(compounds)

    # Normalize compound (-1..1) → (0..100)
    score = round((avg + 1) / 2 * 100, 1)

    if score >= 62:
        label = "Bullish"
    elif score <= 38:
        label = "Bearish"
    else:
        label = "Neutral"

    return score, label


def get_sentiment(ticker: str, company_name: str = "") -> dict:
    """
    Returns:
    {
        ticker: str,
        score: float,        # 0–100
        label: str,          # Bearish | Neutral | Bullish
        headline_count: int,
        headlines: list[str] # top 5 headlines used
    }
    """
    ticker = ticker.upper().strip()

    if _is_cached(ticker):
        entry = _cache[ticker].copy()
        entry.pop("cached_at", None)
        return entry

    headlines = _fetch_headlines(ticker, company_name)
    score, label = _score_headlines(headlines)

    result = {
        "ticker": ticker,
        "score": score,
        "label": label,
        "headline_count": len(headlines),
        "headlines": headlines[:5],
    }

    _cache[ticker] = {**result, "cached_at": datetime.utcnow()}
    return result