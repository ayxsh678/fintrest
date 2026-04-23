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

GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions"
MAX_RETRIES    = 3
BASE_BACKOFF   = 1.0
MAX_BACKOFF    = 6.0
RETRY_STATUSES = {429, 500, 502, 503, 504}

NOISE_PATTERNS = [
    "deals of the week", "best deals", "% off", "discount",
    "review:", "hands-on", "how to use", "tips and tricks",
    "gift guide", "buying guide", "unboxing",
]

FINANCIAL_SIGNALS = [
    "earnings", "revenue", "profit", "loss", "quarterly", "annual",
    "dividend", "buyback", "guidance", "analyst", "upgrade", "downgrade",
    "target price", "ipo", "results", "margin", "outlook", "forecast",
    "merger", "acquisition", "stake", "shares", "market cap", "q1", "q2",
    "q3", "q4", "nse", "bse", "sensex", "nifty", "crore", "sebi",
    "ebitda", "pat", "sales", "valuation", "debt", "cash flow", "growth",
    "stock", "share price", "investor", "fund", "rally", "decline", "fell",
    "surged", "dropped", "gained", "slipped", "beat", "missed", "raised",
]

# ── Caches ─────────────────────────────────────────────
_cache: TTLCache        = TTLCache(maxsize=200, ttl=30 * 60)
_cache_lock             = threading.Lock()
_impact_cache: TTLCache = TTLCache(maxsize=200, ttl=30 * 60)
_impact_lock            = threading.Lock()


# ── Helpers ────────────────────────────────────────────

def _sleep_backoff(attempt: int, retry_after: str | None = None) -> None:
    if retry_after:
        try:
            time.sleep(min(float(retry_after), MAX_BACKOFF))
            return
        except ValueError:
            pass
    delay = min(BASE_BACKOFF * (2 ** attempt), MAX_BACKOFF)
    time.sleep(delay + random.uniform(0, 0.25 * delay))


def _is_financial(title: str, description: str) -> bool:
    text = (title + " " + description).lower()
    if any(noise in text for noise in NOISE_PATTERNS):
        return False
    return any(signal in text for signal in FINANCIAL_SIGNALS)


def _groq_post(payload: dict) -> dict | None:
    """Shared Groq HTTP call with retry logic. Returns parsed JSON or None."""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json",
    }
    resp = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        except requests.RequestException as e:
            logger.warning("[Groq] network error (attempt %d): %s", attempt + 1, e)
            if attempt < MAX_RETRIES - 1:
                _sleep_backoff(attempt)
                continue
            return None

        if resp.status_code == 200:
            try:
                raw = resp.json()["choices"][0]["message"]["content"].strip()
                raw = raw.replace("```json", "").replace("```", "").strip()
                return json.loads(raw)
            except Exception as e:
                logger.warning("[Groq] parse error: %s", e)
                return None

        if resp.status_code in RETRY_STATUSES and attempt < MAX_RETRIES - 1:
            _sleep_backoff(attempt, resp.headers.get("Retry-After"))
            continue

        logger.warning("[Groq] status %d", resp.status_code)
        return None

    return None


# ── News fetching ──────────────────────────────────────

def _fetch_articles_detailed(
    ticker: str,
    company_name: str = "",
    days: int = 7
) -> list[dict]:
    articles    = []
    base_ticker = ticker.split(".")[0]
    is_indian   = ticker.endswith(".NS") or ticker.endswith(".BO")
    end_date    = datetime.utcnow().strftime("%Y-%m-%d")
    start_date  = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    search_term = company_name if company_name else base_ticker

    # ── Source 1: Finnhub ──────────────────────────────
    finnhub_key = os.getenv("FINNHUB_API_KEY", "")
    if finnhub_key:
        try:
            resp = requests.get(
                "https://finnhub.io/api/v1/company-news",
                params={
                    "symbol": base_ticker,
                    "from":   start_date,
                    "to":     end_date,
                    "token":  finnhub_key,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                for item in data[:15]:
                    title = (item.get("headline") or "").strip()
                    desc  = (item.get("summary") or "").strip()
                    if not title or title == "[Removed]":
                        continue
                    # Must mention company name or ticker
                    combined = (title + " " + desc).lower()
                    if (search_term.lower() not in combined and
                            base_ticker.lower() not in combined):
                        continue
                    articles.append({
                        "title":        title,
                        "description":  desc,
                        "source":       item.get("source", "Finnhub"),
                        "published_at": datetime.fromtimestamp(
                            item.get("datetime", 0)
                        ).strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "url":          item.get("url", ""),
                    })
        except Exception as e:
            logger.warning("[Finnhub] error for %s: %s", ticker, e)

    # ── Source 2: NewsAPI fallback ─────────────────────
    if not articles:
        api_key = os.getenv("NEWS_API_KEY", "")
        if api_key:
            # Tighter query for Indian stocks — avoids generic "reliance" matches
            if is_indian:
                query = (
                    f'"{search_term}" '
                    f'(NSE OR BSE OR "quarterly results" OR earnings OR revenue OR '
                    f'profit OR crore OR "share price" OR Sensex OR Nifty OR PAT)'
                )
            else:
                query = (
                    f'"{search_term}" '
                    f'(earnings OR revenue OR profit OR stock OR shares OR '
                    f'quarterly OR results OR analyst OR guidance OR dividend)'
                )
            try:
                resp = requests.get(
                    "https://newsapi.org/v2/everything",
                    params={
                        "q":        query,
                        "from":     start_date,
                        "sortBy":   "publishedAt",
                        "language": "en",
                        "pageSize": 15,
                        "apiKey":   api_key,
                    },
                    timeout=8,
                )
                resp.raise_for_status()
                for a in resp.json().get("articles", []):
                    title = (a.get("title") or "").strip()
                    desc  = (a.get("description") or "").strip()
                    if not title or title == "[Removed]":
                        continue
                    # Must actually mention the company — prevents generic matches
                    combined = (title + " " + desc).lower()
                    if (search_term.lower() not in combined and
                            base_ticker.lower() not in combined):
                        continue
                    articles.append({
                        "title":        title,
                        "description":  desc,
                        "source":       (a.get("source") or {}).get("name", "Unknown"),
                        "published_at": a.get("publishedAt", ""),
                        "url":          a.get("url", ""),
                    })
            except Exception as e:
                logger.warning("[NewsAPI] error for %s: %s", ticker, e)

    # ── Filter: keep only financial articles ───────────
    filtered = [
        a for a in articles
        if _is_financial(a["title"], a.get("description", ""))
    ]

    return filtered[:8] if filtered else articles[:5]


def _fetch_headlines(ticker: str, company_name: str = "") -> list[str]:
    articles = _fetch_articles_detailed(ticker, company_name, days=3)
    headlines = []
    for a in articles:
        title = a.get("title", "")
        desc  = a.get("description", "")
        headlines.append(f"{title}. {desc}" if desc else title)
    return headlines


# ── Aggregate sentiment scoring ────────────────────────

def _score_with_groq(ticker: str, headlines: list[str]) -> tuple[float, str]:
    if not headlines or not GROQ_API_KEY:
        return 50.0, "Neutral"

    headlines_text = "\n".join(f"- {h}" for h in headlines[:15])

    prompt = f"""You are a financial sentiment analyst. Analyze these news headlines about {ticker}.

Headlines:
{headlines_text}

Score the OVERALL sentiment and return JSON with exactly these fields:
- "score": number 0-100 (0=extremely bearish, 50=neutral, 100=extremely bullish)
- "label": "Bearish" | "Neutral" | "Bullish"
- "reason": one sentence explaining the dominant sentiment signal

CALIBRATION:
- Multiple earnings misses, revenue declines → score 10-25
- Minor negative news, soft guidance → score 30-40
- Mixed or non-financial news → score 45-55
- Earnings beats, analyst upgrades → score 65-80
- Major beats, blockbuster deals, dividend hikes → score 80-95

Respond ONLY with the JSON object. No markdown."""

    data = _groq_post({
        "model":       "llama-3.3-70b-versatile",
        "messages":    [{"role": "user", "content": prompt}],
        "max_tokens":  150,
        "temperature": 0.1,
    })

    if not data:
        return 50.0, "Neutral"

    try:
        score = max(0.0, min(100.0, float(data.get("score", 50))))
        label = data.get("label", "Neutral")
        if label not in ("Bearish", "Neutral", "Bullish"):
            label = "Bullish" if score >= 66 else ("Bearish" if score <= 34 else "Neutral")
        return score, label
    except Exception as e:
        logger.warning("[Groq sentiment] parse error for %s: %s", ticker, e)
        return 50.0, "Neutral"


# ── Per-article impact scoring ─────────────────────────

def _analyze_impact_with_groq(
    company: str,
    ticker: str,
    articles: list[dict]
) -> dict:
    if not GROQ_API_KEY or not articles:
        return {}

    articles_text = "\n".join(
        f"[Article {i+1}]\nTitle: {a['title']}\n"
        f"Source: {a['source']}\n"
        f"Summary: {a.get('description') or 'N/A'}"
        for i, a in enumerate(articles[:6])
    )

    prompt = f"""You are a senior equity analyst scoring news articles for {company} ({ticker}).

SCORING RULES — you MUST use the full 1-10 range across articles:
1-2 = Earnings miss, revenue decline, fraud, credit downgrade, major loss
3-4 = Soft guidance, cost pressures, leadership uncertainty, minor negative
5-6 = Product launches, general industry news, no clear P&L impact
7-8 = Earnings beat, new contract, analyst upgrade, margin expansion
9-10 = Major earnings beat, blockbuster deal, dividend hike, massive buyback

CALIBRATION EXAMPLES:
- "Reliance Q3 PAT up 18% YoY" → impact_score: 8, positive
- "Apple misses earnings, revenue down 8%" → impact_score: 2, negative
- "Company wins major government contract" → impact_score: 8, positive
- "CEO succession uncertainty" → impact_score: 4, negative
- "New product launch announced" → impact_score: 5, neutral

CRITICAL: Each article MUST get a DIFFERENT score based on its actual content.
CRITICAL: Do not cluster scores around 3. Use the full range.

Articles:
{articles_text}

Return ONLY this JSON (no markdown):
{{
  "articles": [
    {{
      "index": 1,
      "sentiment": "positive"|"negative"|"neutral",
      "impact_score": <integer 1-10>,
      "impact_explanation": "This news may... [1-2 sentences for a beginner investor]",
      "price_direction": "may increase"|"may decrease"|"likely neutral"
    }}
  ],
  "overall_sentiment": "positive"|"negative"|"neutral",
  "sentiment_summary": "<2 sentences summarizing what this means for the stock>"
}}"""

    data = _groq_post({
        "model":       "llama-3.3-70b-versatile",
        "messages":    [{"role": "user", "content": prompt}],
        "max_tokens":  1500,
        "temperature": 0.2,
    })

    return data if data else {}


# ── Public API ─────────────────────────────────────────

def get_sentiment(ticker: str, company_name: str = "") -> dict:
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


def get_news_impact(ticker: str, company_name: str = "", days: int = 7) -> dict:
    ticker    = ticker.upper().strip()
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
            "sentiment_summary": f"No recent financial news found for {company_name or ticker}.",
            "news":              [],
        }
        with _impact_lock:
            _impact_cache[cache_key] = dict(result)
        return result

    analysis = _analyze_impact_with_groq(company_name or ticker, ticker, articles)
    analyzed  = {
        a.get("index"): a
        for a in analysis.get("articles", [])
        if isinstance(a, dict)
    }

    news_items = []
    for i, art in enumerate(articles[:6], start=1):
        match = analyzed.get(i, {})
        news_items.append({
            "title":              art["title"],
            "source":             art["source"],
            "published_at":       art["published_at"],
            "url":                art["url"],
            "sentiment":          match.get("sentiment", "neutral"),
            "impact_score":       max(1, min(10, int(match.get("impact_score", 3) or 3))),
            "impact_explanation": match.get("impact_explanation", "Unable to analyze impact."),
            "price_direction":    match.get("price_direction", "likely neutral"),
        })

    result = {
        "ticker":            ticker,
        "company_name":      company_name or ticker,
        "overall_sentiment": analysis.get("overall_sentiment", "neutral"),
        "sentiment_summary": analysis.get(
            "sentiment_summary",
            f"Mixed signals for {company_name or ticker}."
        ),
        "news": news_items,
    }

    with _impact_lock:
        _impact_cache[cache_key] = dict(result)
    return result