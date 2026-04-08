import os
import json
import uuid
import redis
from datetime import timedelta

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
SESSION_TTL_HOURS = 24
MAX_HISTORY = 10  # last 10 messages (5 exchanges)

r = redis.from_url(REDIS_URL, decode_responses=True)


def create_session() -> str:
    """Generate a new session ID."""
    return str(uuid.uuid4())


def get_history(session_id: str) -> list[dict]:
    """Fetch conversation history for a session. Returns [] if not found."""
    try:
        raw = r.get(f"session:{session_id}")
        if not raw:
            return []
        return json.loads(raw)
    except Exception:
        return []


def append_to_history(session_id: str, question: str, answer: str) -> None:
    """
    Append a user/assistant exchange to the session.
    Keeps only the last MAX_HISTORY messages (user + assistant pairs).
    Refreshes TTL on every write.
    """
    try:
        history = get_history(session_id)

        history.append({"role": "user",    "content": question})
        history.append({"role": "assistant", "content": answer})

        # Trim to last MAX_HISTORY messages
        if len(history) > MAX_HISTORY:
            history = history[-MAX_HISTORY:]

        r.setex(
            f"session:{session_id}",
            timedelta(hours=SESSION_TTL_HOURS),
            json.dumps(history)
        )
    except Exception:
        pass  # Memory failure should never break the main response


def clear_session(session_id: str) -> None:
    """Delete a session — used when user starts a fresh conversation."""
    try:
        r.delete(f"session:{session_id}")
    except Exception:
        pass