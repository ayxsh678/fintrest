import logging
import uuid

import requests
import yfinance as yf
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory store: { session_id: [ {id, ticker, threshold, direction, created_at, triggered} ] }
_alerts: dict[str, list] = {}


def create_alert(session_id: str, ticker: str, threshold: float, direction: str) -> dict:
    """direction: 'above' or 'below'"""
    alert = {
        "id": str(uuid.uuid4()),
        "ticker": ticker.upper(),
        "threshold": threshold,
        "direction": direction,
        "created_at": datetime.utcnow().isoformat(),
        "triggered": False,
    }
    _alerts.setdefault(session_id, []).append(alert)
    return alert


def get_alerts(session_id: str) -> list:
    return _alerts.get(session_id, [])


def delete_alert(session_id: str, alert_id: str) -> bool:
    alerts = _alerts.get(session_id, [])
    before = len(alerts)
    _alerts[session_id] = [a for a in alerts if a["id"] != alert_id]
    return len(_alerts[session_id]) < before


def check_alerts(session_id: str) -> list:
    """Returns list of newly triggered alerts."""
    triggered = []
    for alert in _alerts.get(session_id, []):
        if alert["triggered"]:
            continue
        try:
            price = yf.Ticker(alert["ticker"]).fast_info.last_price
            if price is None:
                continue            hit = (alert["direction"] == "above" and price >= alert["threshold"]) or \
                    (alert["direction"] == "below" and price <= alert["threshold"])
            if hit:
                alert["triggered"] = True
                alert["triggered_price"] = round(price, 2)
                alert["triggered_at"] = datetime.utcnow().isoformat()
                triggered.append(alert)
        except (requests.RequestException, KeyError, OSError) as e:
            logger.warning(
                "Failed to check price for alert %s (%s): %s",
                alert.get("id"),
                alert.get("ticker"),
                e,
            )
    return triggered
