import math

def _safe_float(v, default=None):
    try:
        return float(v)
    except (ValueError, TypeError):
        return default

def _compute_rsi(closes, period=14):
    if len(closes) < period:
        raise ValueError("Not enough data points for RSI calculation")

    deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0 for d in deltas]
    losses = [-d if d < 0 else 0 for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(closes)):
        gain = gains[i] - gains[i-1]
        loss = losses[i] - losses[i-1]

        if gain > 0:
            avg_gain = (avg_gain * (period - 1) + gain) / period
        else:
            avg_gain = avg_gain

        if loss < 0:
            avg_loss = (avg_loss * (period - 1) + loss) / period
        else:
            avg_loss = avg_loss

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    return rsi

def get_conviction_score(ticker, days=30):
    try:
        # Fetch historical data for the ticker
        history = fetch_historical_data(ticker, days)
        if not history:
            raise ValueError("No historical data available")

        # Calculate RSI for the last 14 days
        closes = [float(c['close']) for c in history]
        rsi = _compute_rsi(closes)

        # Determine conviction score based on RSI
        if rsi < 30:
            return "Strong Buy"
        elif rsi > 70:
            return "Strong Sell"
        else:
            return "Neutral"

    except Exception as e:
        print(f"Error calculating conviction score for {ticker}: {e}")
        return None

def fetch_historical_data(ticker, days):
    # Implement logic to fetch historical data from a source
    pass
