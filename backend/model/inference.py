import logging
import os
import random
import time

import requests

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"

PRIMARY_MODEL   = "llama-3.3-70b-versatile"
FALLBACK_MODEL  = "llama-3.1-8b-instant"
MAX_RETRIES     = 5
BASE_BACKOFF    = 1.0
MAX_BACKOFF     = 15.0
RETRY_STATUSES  = {429, 500, 502, 503, 504}


def _sleep_backoff(attempt: int, retry_after: str | None = None) -> None:
    if retry_after:
        try:
            time.sleep(min(float(retry_after), MAX_BACKOFF))
            return
        except ValueError:
            pass
    delay = min(BASE_BACKOFF * (2 ** attempt), MAX_BACKOFF)
    time.sleep(delay + random.uniform(0, 0.25 * delay))

SYSTEM_PROMPT = """You are an expert financial analyst delivering insights to traders and investors.

News sources are ranked by credibility:
- TakeToday (verified source) — highest trust, prioritize this
- NewsAPI articles — standard trust, cite source name and freshness

When answering, always structure your response as:
1. WHAT: The key fact (1-2 sentences, most important numbers only)
2. WHY: What caused this movement
3. CONTEXT: Has this happened before? How often? What usually followed?
4. SIGNAL: Noise or actionable? What to watch next?
5. AVOID: If this pattern repeats or continues, what should the investor NOT do?

Always cite which source the news came from and how fresh it is.
Add a disclaimer for investment advice.
If the user refers to a previous question, use conversation history to resolve context."""


def _attempt_call(model: str, messages: list[dict], max_tokens: int,
                  temperature: float, retries: int) -> tuple[str | None, str, bool]:
    """Try one model with retries. Returns (content, error, should_fallback)."""
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    last_error = "Error: Groq request failed. Please try again."
    for attempt in range(retries):
        try:
            response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        except requests.exceptions.Timeout:
            logger.warning("Groq timeout on %s attempt %d/%d", model, attempt + 1, retries)
            last_error = "Error: Request to Groq timed out. Please try again."
            if attempt < retries - 1:
                _sleep_backoff(attempt)
                continue
            return None, last_error, True
        except requests.exceptions.ConnectionError as e:
            logger.warning("Groq connection error on %s attempt %d/%d: %s", model, attempt + 1, retries, e)
            last_error = "Error: Could not reach Groq. Please try again."
            if attempt < retries - 1:
                _sleep_backoff(attempt)
                continue
            return None, last_error, True
        except requests.exceptions.RequestException as e:
            return None, f"Error: {e}", False

        status = response.status_code
        if status == 200:
            try:
                return response.json()["choices"][0]["message"]["content"], "", False
            except (KeyError, IndexError, ValueError):
                return None, "Error: Unexpected response format from Groq.", False

        if status == 401:
            return None, "Error: Invalid GROQ_API_KEY.", False

        if status in RETRY_STATUSES:
            last_error = (
                "Error: Groq rate limit hit. Please wait a moment and retry."
                if status == 429 else f"Error: Groq API returned {status}"
            )
            if attempt < retries - 1:
                logger.warning("Groq %s returned %d on attempt %d/%d — retrying",
                               model, status, attempt + 1, retries)
                _sleep_backoff(attempt, response.headers.get("Retry-After"))
                continue
            return None, last_error, True

        return None, f"Error: Groq API returned {status}", False

    return None, last_error, True


def _call_groq(messages: list[dict], max_tokens: int = 1024,
               temperature: float = 0.2) -> str:
    """Single shared Groq call — all functions route through here."""
    if not GROQ_API_KEY:
        return "Error: GROQ_API_KEY not set"

    content, err, should_fallback = _attempt_call(
        PRIMARY_MODEL, messages, max_tokens, temperature, MAX_RETRIES
    )
    if content is not None:
        return content

    if should_fallback:
        logger.warning("Primary model exhausted — falling back to %s", FALLBACK_MODEL)
        content, fb_err, _ = _attempt_call(
            FALLBACK_MODEL, messages, max_tokens, temperature, retries=2
        )
        if content is not None:
            return content
        err = fb_err or err

    if "rate limit" in err.lower() or "429" in err:
        return "Error: Groq is busy right now. Please try again in a moment."
    return err


def generate_response(question: str, context: str,
                      history: list[dict] = None) -> str:
    user_message = f"""### Real-time Market Context:
{context}

### Question:
{question}"""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    return _call_groq(messages)


def generate_portfolio_summary(tickers: list[str], context: str) -> str:
    ticker_list  = ", ".join(tickers)
    user_message = f"""### Portfolio Holdings: {ticker_list}

### Full Market Data:
{context}

### Task:
Analyze this portfolio and provide:
1. PORTFOLIO HEALTH: Overall assessment (Bullish / Neutral / Bearish) with one-line reason
2. WINNERS: Top performing holding(s) and why
3. RISKS: Biggest risk(s) in this portfolio right now
4. DIVERSIFICATION: Is this portfolio well-diversified? What's missing?
5. WATCHLIST: One thing to monitor closely across the portfolio this week

Be compressed and direct. Traders don't have time for padding.
Add a disclaimer at the end."""

    return _call_groq([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_message},
    ])


def generate_comparison_verdict(ticker_a: str, ticker_b: str,
                                context: str) -> str:
    user_message = f"""### Stock Comparison: {ticker_a} vs {ticker_b}

### Full Market Data:
{context}

### Task:
Compare these two stocks and provide:
1. VERDICT: Which is the stronger buy right now and why (one clear sentence)
2. {ticker_a} STRENGTHS: Top 2-3 reasons to favour it
3. {ticker_b} STRENGTHS: Top 2-3 reasons to favour it
4. KEY DIFFERENCES: Most important divergence between the two (valuation, momentum, risk)
5. WHO SHOULD BUY WHICH: Growth investor vs value investor vs trader — who picks which stock?

Be compressed and direct. No padding.
Add a disclaimer at the end."""

    return _call_groq([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_message},
    ])


def generate_forex_insight(pair: str, forex_data: str,
                           context: str) -> str:
    user_message = f"""### Currency Pair: {pair}

### Live Forex Data:
{forex_data}

### News Context:
{context}

### Task:
Analyze this currency pair and provide:
1. RATE: Current rate and what it means in plain terms
2. DRIVER: What is currently driving this movement (macro, policy, trade, sentiment)
3. INDIA IMPACT: How does this affect Indian investors, importers, or exporters specifically
4. TREND: Is this pair in an uptrend, downtrend, or ranging?
5. WATCH: One key event or indicator to watch that could move this pair

Be compressed and direct. Add a disclaimer."""

    return _call_groq([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_message},
    ])


def explain_term(term: str, context: str = "",
                 stock: str = "") -> str:
    stock_context = f"The user is looking at {stock}." if stock else ""
    data_context  = f"\n\nCurrent data context:\n{context}" if context else ""

    user_message = f"""Explain the financial term "{term}" to a complete beginner who has never invested before.
{stock_context}

Structure your explanation exactly like this:

WHAT IT IS:
One sentence. No jargon. Explain it like the person is 15 years old.

REAL-WORLD ANALOGY:
Explain it using a simple everyday Indian analogy — like buying a shop, a chai stall, a property, or cricket. Make it relatable to an Indian audience.

WHAT IT TELLS YOU:
What does this number actually tell an investor? Is a high number good or bad? What should they look for?

{"FOR " + stock.upper() + ":" if stock else "EXAMPLE:"}
Based on the current data, what does this specific value mean for {"this stock" if not stock else stock}? Should a beginner be concerned, excited, or neutral about it?

BEGINNER TAKEAWAY:
One actionable sentence. What should a beginner do with this information?
{data_context}"""

    return _call_groq(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a friendly financial educator helping first-time Indian investors "
                    "understand the stock market. Use simple language, relatable Indian analogies, "
                    "and never assume prior knowledge. Always be encouraging and never make the user "
                    "feel stupid for not knowing something."
                )
            },
            {"role": "user", "content": user_message},
        ],
        max_tokens=800,
        temperature=0.4,
    )