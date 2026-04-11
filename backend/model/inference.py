import os
import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"

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


def _call_groq(messages: list[dict], max_tokens: int = 1024,
               temperature: float = 0.2) -> str:
    """Single shared Groq call — all functions route through here."""
    if not GROQ_API_KEY:
        return "Error: GROQ_API_KEY not set"
    try:
        response = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    except requests.exceptions.Timeout:
        return "Error: Request to Groq timed out. Please try again."
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code
        if status == 429:
            return "Error: Groq rate limit hit. Please wait a moment and retry."
        elif status == 401:
            return "Error: Invalid GROQ_API_KEY."
        return f"Error: Groq API returned {status}"
    except (KeyError, IndexError):
        return "Error: Unexpected response format from Groq."
    except Exception as e:
        return f"Error: {str(e)}"


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