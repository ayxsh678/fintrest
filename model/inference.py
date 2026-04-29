# model/inference.py — Groq API (no local model needed)
import os
import logging
import requests
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
TIMEOUT = 30

logger = logging.getLogger(__name__)


def _call_groq(messages: list[dict], max_tokens: int = 1024, temperature: float = 0.7) -> str:
    if not GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not configured")
        return "Error: LLM service is not configured. Please set GROQ_API_KEY."

    try:
        response = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            logger.warning("Groq returned no choices: %s", data)
            return "Error: LLM returned no response. Please try again."
        content = choices[0].get("message", {}).get("content")
        if not content:
            return "Error: LLM returned empty content. Please try again."
        return content
    except requests.exceptions.Timeout:
        logger.warning("Groq request timed out")
        return "Error: LLM request timed out. Please try again."
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "unknown"
        logger.warning("Groq HTTP error: %s", status)
        return f"Error: LLM service returned HTTP {status}. Please try again."
    except requests.exceptions.RequestException as e:
        logger.warning("Groq request failed: %s", e)
        return "Error: LLM service unavailable. Please try again."
    except (ValueError, KeyError) as e:
        logger.warning("Failed to parse Groq response: %s", e)
        return "Error: LLM returned malformed response."


def generate_response(question: str, context: str, history: list[dict] | None = None) -> str:
    system_prompt = (
        "You are Fintrest, an expert Indian financial advisor with access to real-time NSE/BSE market data. "
        "You specialize in Indian equities, mutual funds, SIPs, and the Indian economy. "
        "Use the provided real-time context to give accurate, grounded answers in Indian Rupees (₹). "
        "Cite specific numbers from the context when relevant. Be concise but thorough. "
        "If asked about US stocks or crypto, politely redirect to Indian markets. "
        "Always add a short disclaimer for investment advice."
    )
    user_prompt = f"### Real-time Context:\n{context}\n\n### Question:\n{question}"

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    if history:
        for turn in history[-6:]:
            q = turn.get("question") or turn.get("q")
            a = turn.get("answer") or turn.get("a")
            if q:
                messages.append({"role": "user", "content": q})
            if a:
                messages.append({"role": "assistant", "content": a})
    messages.append({"role": "user", "content": user_prompt})

    return _call_groq(messages)


def generate_portfolio_summary(tickers: list[str], context: str) -> str:
    prompt = (
        f"Analyze the following portfolio of {len(tickers)} assets: {', '.join(tickers)}.\n\n"
        f"### Real-time Context:\n{context}\n\n"
        "Provide a concise summary covering: diversification, notable movers, risk profile, "
        "and 2-3 actionable observations. Add a brief disclaimer."
    )
    return _call_groq(
        [
            {"role": "system", "content": "You are an expert portfolio analyst."},
            {"role": "user", "content": prompt},
        ]
    )


def generate_comparison_verdict(ticker_a: str, ticker_b: str, context: str) -> str:
    prompt = (
        f"Compare {ticker_a} vs {ticker_b} based on the data below.\n\n"
        f"### Real-time Context:\n{context}\n\n"
        "Give a clear verdict on: momentum, valuation signals, sentiment, and which looks "
        "stronger in the short term. End with a one-line bottom-line and a disclaimer."
    )
    return _call_groq(
        [
            {"role": "system", "content": "You are an expert equity analyst."},
            {"role": "user", "content": prompt},
        ]
    )


def generate_forex_insight(pair: str, forex_data: str, news: str) -> str:
    prompt = (
        f"Provide a forex insight for {pair}.\n\n"
        f"### Market Data:\n{forex_data}\n\n"
        f"### Relevant News:\n{news}\n\n"
        "Summarize: recent movement, key drivers, short-term outlook. Add a disclaimer."
    )
    return _call_groq(
        [
            {"role": "system", "content": "You are an expert forex analyst."},
            {"role": "user", "content": prompt},
        ]
    )


def explain_term(term: str, context: str = "", stock: str = "") -> str:
    extra = ""
    if stock:
        extra += f" Relate the explanation to {stock} where helpful."
    if context:
        extra += f"\n\nAdditional context:\n{context}"
    prompt = (
        f"Explain the financial term '{term}' for a beginner.{extra}\n\n"
        "Use plain language, a short example, and keep it under 200 words."
    )
    return _call_groq(
        [
            {"role": "system", "content": "You teach finance to beginners."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=512,
    )
