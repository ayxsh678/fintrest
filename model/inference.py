# model/inference.py — Groq API (no local model needed)
import os
import requests
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def generate_response(question: str, context: str) -> str:
    prompt = f"""You are an expert financial advisor with access to real-time market data.

### Real-time Context:
{context}

### Question:
{question}

### Instructions:
- Use the real-time context above to give accurate, grounded answers
- Cite specific numbers from the context when relevant
- Be concise but thorough
- Always add a disclaimer for investment advice"""

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
            "temperature": 0.7
        }
    )

    data = response.json()
    return data["choices"][0]["message"]["content"]