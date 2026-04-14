import logging
import os
import json
import threading
import requests
from datetime import datetime, timedelta
from cachetools import TTLCache

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"

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

    try:
        resp = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type":  "application/json",
            },
            json={
                "model":       "llama-3.3-70b-versatile",
                "messages":    [{"role": "user", "content": prompt}],
                "max_tokens":  120,
                "temperature": 0.1,
            },
            timeout=15,
        )
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
