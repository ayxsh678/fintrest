import yfinance as yf
from datetime import datetime

# In-memory store: { session_id: [ {id, ticker, threshold, direction, created_at, triggered} ] }
_alerts: dict[str, list] = {}
_id_counter = 0

def _next_id():
    global _id_counter
    _id_counter += 1
    return _id_counter

def create_alert(session_id: str, ticker: str, threshold: float, direction: str) -> dict:
    """direction: 'above' or 'below'"""
    alert = {
        "id": _next_id(),
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

def delete_alert(session_id: str, alert_id: int) -> bool:
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
            price = yf.Ticker(alert["ticker"]).fast_info["last_price"]
            hit = (alert["direction"] == "above" and price >= alert["threshold"]) or \
                    (alert["direction"] == "below" and price <= alert["threshold"])
            if hit:
                alert["triggered"] = True
                alert["triggered_price"] = round(price, 2)
                alert["triggered_at"] = datetime.utcnow().isoformat()
                triggered.append(alert)
        except Exception:
            pass
    return triggered