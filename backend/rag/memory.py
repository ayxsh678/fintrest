import os
import json
import uuid
import logging
from datetime import timedelta

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None

logger = logging.getLogger(__name__)

REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379")
SESSION_TTL_HOURS = 24
MAX_HISTORY       = 10  # last 10 messages (5 exchanges)

# Lazy Redis connection — never crashes at import time
r = None

def _get_redis():
    global r
    if r is not None:
        return r
    if redis_lib is None:
        return None
    try:
        client = redis_lib.from_url(REDIS_URL, decode_responses=True)
        client.ping()
        r = client
        return r
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}) — conversation memory disabled.")
        return None


def create_session() -> str:
    """Generate a new session ID."""
    return str(uuid.uuid4())


def get_history(session_id: str) -> list[dict]:
    """Fetch conversation history for a session. Returns [] if not found."""
    client = _get_redis()
    if not client:
        return []
    try:
        raw = client.get(f"session:{session_id}")
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
    client = _get_redis()
    if not client:
        return
    try:
        history = get_history(session_id)

        history.append({"role": "user",      "content": question})
        history.append({"role": "assistant",  "content": answer})

        # Trim to last MAX_HISTORY messages
        if len(history) > MAX_HISTORY:
            history = history[-MAX_HISTORY:]

        client.setex(
            f"session:{session_id}",
            timedelta(hours=SESSION_TTL_HOURS),
            json.dumps(history)
        )
    except Exception:
        pass  # Memory failure should never break the main response


def clear_session(session_id: str) -> None:
    """Delete a session — used when user starts a fresh conversation."""
    client = _get_redis()
    if not client:
        return
    try:
        client.delete(f"session:{session_id}")
    except Exception:
        pass