import os
import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are an expert financial analyst delivering insights to traders and investors.

News sources are ranked by credibility:
- TakeToday (verified source) — highest trust, prioritize this
- NewsAPI articles — standard trust, cite source name and freshness

When answering, always structure your response as:
1. WHAT: The key fact (1-2 sentences, most important numbers only)
2. WHY: What caused this movement
3. CONTEXT: Has this happened before? How often? What usually followed?
4. SIGNAL: Noise or actionable? What to watch next?

Always cite which source the news came from and how fresh it is.
Add a disclaimer for investment advice.
If the user refers to a previous question (e.g. 'what about that stock?', 'why did it drop?'),
use the conversation history to resolve what they are referring to."""


def generate_response(question: str, context: str,
                        history: list[dict] = None) -> str:
    if not GROQ_API_KEY:
        return "Error: GROQ_API_KEY not set"

    user_message = f"""### Real-time Market Context:
{context}

### Question:
{question}"""

    # Build messages: system + history + current user message
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if history:
        messages.extend(history)  # list of {"role": "user"/"assistant", "content": "..."}

    messages.append({"role": "user", "content": user_message})

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
                "max_tokens": 1024,
                "temperature": 0.2
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

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
    

def generate_portfolio_summary(tickers: list[str], context: str) -> str:
    if not GROQ_API_KEY:
        return "Error: GROQ_API_KEY not set"
    ticker_list = ", ".join(tickers)
    user_message = f"""### Portfolio Holdings: {ticker_list}
### Full Market Data:
{context}
### Task:
Analyze this portfolio and provide:
1. PORTFOLIO HEALTH: Overall assessment (Bullish / Neutral / Bearish) with one-line reason
2. WINNERS: Top performing holding(s) and why
3. RISKS: Biggest risk(s) in this portfolio right now
4. DIVERSIFICATION: Is this portfolio well-diversified? What\'s missing?
5. WATCHLIST: One thing to monitor closely across the portfolio this week
Be compressed and direct. Traders don\'t have time for padding.
Add a disclaimer at the end."""
    try:
        response = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_message}
                ],
                "max_tokens": 1024,
                "temperature": 0.2
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except requests.exceptions.Timeout:
        return "Error: Request to Groq timed out."
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code
        if status == 429:
            return "Error: Groq rate limit hit. Please retry."
        elif status == 401:
            return "Error: Invalid GROQ_API_KEY."
        return f"Error: Groq API returned {status}"
    except (KeyError, IndexError):
        return "Error: Unexpected response format from Groq."
    except Exception as e:
        return f"Error: {str(e)}"
