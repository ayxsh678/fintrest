import logging
import os
import json
import random
import threading
import time
import requests
from datetime import datetime, timedelta
from cachetools import TTLCache

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"

MAX_RETRIES    = 3
BASE_BACKOFF   = 1.0
MAX_BACKOFF    = 6.0
RETRY_STATUSES = {429, 500, 502, 503, 504}


def _sleep_backoff(attempt: int, retry_after: str | None = None) -> None:
    if retry_after:
        try:
            time.sleep(min(float(retry_after), MAX_BACKOFF))
            return
        except ValueError:
            pass
    delay = min(BASE_BACKOFF * (2 ** attempt), MAX_BACKOFF)
    time.sleep(delay + random.uniform(0, 0.25 * delay))

# Bounded cache: max 200 tickers, 30 min TTL
_cache: TTLCache = TTLCache(maxsize=200, ttl=30 * 60)
_cache_lock = threading.Lock()


def _is_cached(ticker: str) -> bool:
    with _cache_lock:
        return ticker in _cache


def _fetch_headlines(ticker: str, company_name: str = "") -> list[str]:
    """Fetch recent headlines from NewsAPI for a given ticker."""
    api_key = os.getenv("NEWS_API_KEY", "")
    if not api_key:
        return []

    query     = f"{company_name} OR {ticker} stock" if company_name else f"{ticker} stock"
    from_date = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")

    try:
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q":        query,
                "from":     from_date,
                "sortBy":   "publishedAt",
                "language": "en",
                "pageSize": 20,
                "apiKey":   api_key,
            },
            timeout=8,
        )
        resp.raise_for_status()
        articles  = resp.json().get("articles", [])
        headlines = []
        for a in articles:
            title = (a.get("title") or "").strip()
            desc  = (a.get("description") or "").strip()
            if title and title != "[Removed]":
                headlines.append(f"{title}. {desc}" if desc else title)
        return headlines
    except requests.RequestException as e:
        logger.warning("Failed to fetch headlines for %s: %s", ticker, e)
        return []
    except (ValueError, KeyError) as e:
        logger.warning("Malformed NewsAPI response for %s: %s", ticker, e)
        return []


def _score_with_groq(ticker: str, headlines: list[str]) -> tuple[float, str]:
    """
    Ask Groq to score the sentiment of financial headlines.
    Returns (score 0-100, label).
    Falls back to Neutral (50) on any error.
    """
    if not headlines:
        return 50.0, "Neutral"

    if not GROQ_API_KEY:
        return 50.0, "Neutral"

    headlines_text = "\n".join(f"- {h}" for h in headlines[:15])

    prompt = f"""You are a financial sentiment analyst. Analyze the following news headlines about {ticker} and return a JSON object with exactly these fields:
- "score": a number from 0 to 100 (0 = extremely bearish, 50 = neutral, 100 = extremely bullish)
- "label": one of "Bearish", "Neutral", or "Bullish"
- "reason": one sentence explaining the dominant sentiment signal

Headlines:
{headlines_text}

Respond ONLY with the JSON object. No markdown, no explanation outside the JSON."""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json",
    }
    payload = {
        "model":       "llama-3.3-70b-versatile",
        "messages":    [{"role": "user", "content": prompt}],
        "max_tokens":  120,
        "temperature": 0.1,
    }

    resp = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=15)
        except requests.RequestException as e:
            logger.warning("Groq sentiment network error for %s (attempt %d/%d): %s",
                           ticker, attempt + 1, MAX_RETRIES, e)
            if attempt < MAX_RETRIES - 1:
                _sleep_backoff(attempt)
                continue
            return 50.0, "Neutral"

        if resp.status_code == 200:
            break
        if resp.status_code in RETRY_STATUSES and attempt < MAX_RETRIES - 1:
            logger.warning("Groq sentiment returned %d for %s (attempt %d/%d) — retrying",
                           resp.status_code, ticker, attempt + 1, MAX_RETRIES)
            _sleep_backoff(attempt, resp.headers.get("Retry-After"))
            continue
        logger.warning("Groq sentiment failed for %s with status %d", ticker, resp.status_code)
        return 50.0, "Neutral"

    try:
        resp.raise_for_status()
        raw  = resp.json()["choices"][0]["message"]["content"].strip()
        raw  = raw.replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)

        score = float(data.get("score", 50))
        score = max(0.0, min(100.0, round(score, 1)))

        label = data.get("label", "Neutral")
        if label not in ("Bearish", "Neutral", "Bullish"):
            label = "Bullish" if score >= 66 else ("Bearish" if score <= 34 else "Neutral")

        return score, label

    except requests.RequestException as e:
        logger.warning("Groq sentiment request failed for %s: %s", ticker, e)
        return 50.0, "Neutral"
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        logger.warning("Malformed Groq sentiment response for %s: %s", ticker, e)
        return 50.0, "Neutral"


def get_sentiment(ticker: str, company_name: str = "") -> dict:
    """
    Returns:
    {
        ticker:          str,
        score:           float,       # 0-100
        label:           str,         # Bearish | Neutral | Bullish
        headline_count:  int,
        headlines:       list[str]    # top 5 headlines used
    }
    """
    ticker = ticker.upper().strip()

    with _cache_lock:
        if ticker in _cache:
            return dict(_cache[ticker])

    headlines    = _fetch_headlines(ticker, company_name)
    score, label = _score_with_groq(ticker, headlines)

    result = {
        "ticker":         ticker,
        "score":          score,
        "label":          label,
        "headline_count": len(headlines),
        "headlines":      headlines[:5],
    }

    with _cache_lock:
        _cache[ticker] = dict(result)
    return result


# ── News with per-article impact analysis ─────────────────────────────

_impact_cache: TTLCache = TTLCache(maxsize=200, ttl=30 * 60)
_impact_lock = threading.Lock()


def _fetch_articles_detailed(ticker: str, company_name: str = "", days: int = 7) -> list[dict]:
    """Fetch recent news articles with full metadata (title, source, url, etc.)."""
    api_key = os.getenv("NEWS_API_KEY", "")
    if not api_key:
        return []

    query     = f"{company_name} OR {ticker} stock" if company_name else f"{ticker} stock"
    from_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q":        query,
                "from":     from_date,
                "sortBy":   "relevancy",
                "language": "en",
                "pageSize": 12,
                "apiKey":   api_key,
            },
            timeout=8,
        )
        resp.raise_for_status()
        out = []
        for a in resp.json().get("articles", []):
            title = (a.get("title") or "").strip()
            if not title or title == "[Removed]":
                continue
            out.append({
                "title":        title,
                "description":  (a.get("description") or "").strip(),
                "source":       (a.get("source") or {}).get("name", "Unknown"),
                "published_at": a.get("publishedAt", ""),
                "url":          a.get("url", ""),
            })
        return out[:8]
    except requests.RequestException as e:
        logger.warning("Failed to fetch detailed articles for %s: %s", ticker, e)
        return []
    except (ValueError, KeyError) as e:
        logger.warning("Malformed NewsAPI response for %s: %s", ticker, e)
        return []


def _analyze_impact_with_groq(company: str, ticker: str, articles: list[dict]) -> dict:
    """Ask Groq to score per-article impact + explain in plain English."""
    if not GROQ_API_KEY or not articles:
        return {}

    articles_text = "\n".join(
        f"[Article {i+1}]\nTitle: {a['title']}\nSource: {a['source']}\nSummary: {a.get('description') or 'N/A'}"
        for i, a in enumerate(articles[:6])
    )

    prompt = f"""You are a financial news analyst explaining things to a beginner investor.
Analyze these news articles about {company} ({ticker}).

For EACH article, return:
- index: article number (1-based)
- sentiment: "positive" | "negative" | "neutral"
- impact_score: integer 1-10 (how much this could move the stock)
- impact_explanation: 1-2 simple sentences starting with "This news may..." or "This could..." explaining WHY it matters
- price_direction: "may increase" | "may decrease" | "likely neutral"

Also return overall_sentiment and a 2-sentence sentiment_summary.

Articles:
{articles_text}

Respond ONLY with this JSON (no markdown):
{{
  "articles": [
    {{"index": 1, "sentiment": "positive", "impact_score": 7, "impact_explanation": "...", "price_direction": "may increase"}}
  ],
  "overall_sentiment": "positive",
  "sentiment_summary": "..."
}}"""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model":       "llama-3.3-70b-versatile",
        "messages":    [{"role": "user", "content": prompt}],
        "max_tokens":  1500,
        "temperature": 0.3,
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        except requests.RequestException as e:
            logger.warning("Groq impact network error for %s (attempt %d): %s", ticker, attempt + 1, e)
            if attempt < MAX_RETRIES - 1:
                _sleep_backoff(attempt)
                continue
            return {}
        if resp.status_code == 200:
            try:
                raw = resp.json()["choices"][0]["message"]["content"].strip()
                raw = raw.replace("```json", "").replace("```", "").strip()
                return json.loads(raw)
            except (ValueError, KeyError, json.JSONDecodeError) as e:
                logger.warning("Malformed Groq impact response for %s: %s", ticker, e)
                return {}
        if resp.status_code in RETRY_STATUSES and attempt < MAX_RETRIES - 1:
            _sleep_backoff(attempt, resp.headers.get("Retry-After"))
            continue
        logger.warning("Groq impact failed for %s with status %d", ticker, resp.status_code)
        return {}
    return {}


def get_news_impact(ticker: str, company_name: str = "", days: int = 7) -> dict:
    """
    Returns news with per-article impact analysis:
    {
      ticker, company_name, overall_sentiment, sentiment_summary,
      news: [{title, source, url, published_at, sentiment, impact_score, impact_explanation, price_direction}]
    }
    """
    ticker = ticker.upper().strip()
    cache_key = f"{ticker}:{days}"

    with _impact_lock:
        if cache_key in _impact_cache:
            return dict(_impact_cache[cache_key])

    articles = _fetch_articles_detailed(ticker, company_name, days=days)
    if not articles:
        result = {
            "ticker":            ticker,
            "company_name":      company_name or ticker,
            "overall_sentiment": "neutral",
            "sentiment_summary": f"No recent news found for {company_name or ticker}.",
            "news":              [],
        }
        with _impact_lock:
            _impact_cache[cache_key] = dict(result)
        return result

    analysis = _analyze_impact_with_groq(company_name or ticker, ticker, articles)
    analyzed = {a.get("index"): a for a in analysis.get("articles", []) if isinstance(a, dict)}

    news_items = []
    for i, art in enumerate(articles[:6], start=1):
        match = analyzed.get(i, {})
        news_items.append({
            "title":              art["title"],
            "source":             art["source"],
            "published_at":       art["published_at"],
            "url":                art["url"],
            "sentiment":          match.get("sentiment", "neutral"),
            "impact_score":       int(match.get("impact_score", 3) or 3),
            "impact_explanation": match.get("impact_explanation", "Unable to analyze impact."),
            "price_direction":    match.get("price_direction", "likely neutral"),
        })

    result = {
        "ticker":            ticker,
        "company_name":      company_name or ticker,
        "overall_sentiment": analysis.get("overall_sentiment", "neutral"),
        "sentiment_summary": analysis.get("sentiment_summary", f"Mixed signals for {company_name or ticker}."),
        "news":              news_items,
    }
    with _impact_lock:
        _impact_cache[cache_key] = dict(result)
    return result
