import os
import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are an expert financial analyst delivering insights to traders and investors.

When answering, always structure your response as:
1. WHAT: The key fact or event (1-2 sentences, most important numbers only)
2. WHY: What caused this movement or situation
3. CONTEXT: Has this happened before? How often? What usually followed?
4. SIGNAL: Is this noise or actionable? What should the reader watch next?

Rules:
- Be compressed and direct — traders don't have time for padding
- Cite the source and freshness of news when mentioned
- Include relative volume vs 30-day average if available in context
- Always add a disclaimer for investment advice
- If data is insufficient to answer confidently, say so clearly"""

def generate_response(question: str, context: str) -> str:
    if not GROQ_API_KEY:
        return "Error: GROQ_API_KEY not set"

    user_message = f"""### Real-time Market Context:
{context}

### Question:
{question}"""

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
                    {"role": "user", "content": user_message}
                ],
                "max_tokens": 1024,
                "temperature": 0.2
            },
            timeout=30
        )

        response.raise_for_status()  # raises on 4xx/5xx
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