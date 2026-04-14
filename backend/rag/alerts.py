import logging
import uuid
from datetime import datetime
from threading import Lock

import yfinance as yf

logger = logging.getLogger(__name__)

# In-memory store: { session_id: [ {id, ticker, threshold, direction, created_at, triggered} ] }
_alerts: dict[str, list] = {}
_alerts_lock = Lock()


def create_alert(session_id: str, ticker: str, threshold: float, direction: str) -> dict:
    """direction: 'above' or 'below'"""
    alert = {
        "id": str(uuid.uuid4()),
        "ticker": ticker.upper().strip(),
        "threshold": threshold,
        "direction": direction,
        "created_at": datetime.utcnow().isoformat(),
        "triggered": False,
    }
    with _alerts_lock:
        _alerts.setdefault(session_id, []).append(alert)
    return alert


def get_alerts(session_id: str) -> list:
    with _alerts_lock:
        return list(_alerts.get(session_id, []))


def delete_alert(session_id: str, alert_id: str) -> bool:
    with _alerts_lock:
        alerts = _alerts.get(session_id, [])
        before = len(alerts)
        _alerts[session_id] = [a for a in alerts if a["id"] != alert_id]
        return len(_alerts[session_id]) < before


def check_alerts(session_id: str) -> list:
    """Returns list of newly triggered alerts."""
    with _alerts_lock:
        pending = [a for a in _alerts.get(session_id, []) if not a["triggered"]]

    triggered = []
    for alert in pending:
        try:
            price = yf.Ticker(alert["ticker"]).fast_info["last_price"]
        except Exception as e:
            logger.warning("Failed to fetch price for %s: %s", alert.get("ticker"), e)
            continue
        if price is None:
            continue
        hit = (
            (alert["direction"] == "above" and price >= alert["threshold"])
            or (alert["direction"] == "below" and price <= alert["threshold"])
        )
        if hit:
            with _alerts_lock:
                if not alert["triggered"]:
                    alert["triggered"] = True
                    alert["triggered_price"] = round(float(price), 2)
                    alert["triggered_at"] = datetime.utcnow().isoformat()
                    triggered.append(dict(alert))
    return triggered
