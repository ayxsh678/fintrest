import os
import requests
from cachetools import TTLCache
from threading import Lock
from datetime import datetime, timedelta

OPEN_EXCHANGE_KEY = os.getenv("OPEN_EXCHANGE_RATES_KEY")
OXR_BASE = "https://openexchangerates.org/api"

forex_cache      = TTLCache(maxsize=50,  ttl=300)   # 5 min
forex_hist_cache = TTLCache(maxsize=50,  ttl=3600)  # 1 hour for historical
forex_lock       = Lock()
forex_hist_lock  = Lock()

# ── Supported pairs ────────────────────────────────────
CURRENCY_PAIRS = {
    # base -> quote : display name
    "USD/INR":  ("USD", "INR",  "US Dollar / Indian Rupee"),
    "EUR/USD":  ("EUR", "USD",  "Euro / US Dollar"),
    "GBP/USD":  ("GBP", "USD",  "British Pound / US Dollar"),
    "USD/JPY":  ("USD", "JPY",  "US Dollar / Japanese Yen"),
    "USD/CHF":  ("USD", "CHF",  "US Dollar / Swiss Franc"),
    "EUR/INR":  ("EUR", "INR",  "Euro / Indian Rupee"),
    "GBP/INR":  ("GBP", "INR",  "British Pound / Indian Rupee"),
    "USD/AED":  ("USD", "AED",  "US Dollar / UAE Dirham"),
    "USD/SGD":  ("USD", "SGD",  "US Dollar / Singapore Dollar"),
    "JPY/INR":  ("JPY", "INR",  "Japanese Yen / Indian Rupee"),
}

# All currencies we need
ALL_CURRENCIES = {"USD", "INR", "EUR", "GBP", "JPY",
                  "CHF", "AED", "SGD", "BRL", "ZAR"}

# ── Keyword detection ──────────────────────────────────
CURRENCY_KEYWORDS = {
    "dollar": "USD",    "usd": "USD",
    "rupee": "INR",     "inr": "INR",      "indian": "INR",
    "euro": "EUR",      "eur": "EUR",
    "pound": "GBP",     "gbp": "GBP",      "sterling": "GBP",
    "yen": "JPY",       "jpy": "JPY",
    "franc": "CHF",     "chf": "CHF",      "swiss": "CHF",
    "dirham": "AED",    "aed": "AED",      "uae": "AED",
    "singapore": "SGD", "sgd": "SGD",
    "forex": None,      "currency": None,
    "exchange rate": None, "fx": None,
}

PAIR_KEYWORDS = {
    "usd/inr": "USD/INR", "usdinr": "USD/INR",
    "eur/usd": "EUR/USD", "eurusd": "EUR/USD",
    "gbp/usd": "GBP/USD", "gbpusd": "GBP/USD",
    "usd/jpy": "USD/JPY", "usdjpy": "USD/JPY",
    "usd/chf": "USD/CHF", "usdchf": "USD/CHF",
    "eur/inr": "EUR/INR", "eurinr": "EUR/INR",
    "gbp/inr": "GBP/INR", "gbpinr": "GBP/INR",
    "usd/aed": "USD/AED", "usdaed": "USD/AED",
    "usd/sgd": "USD/SGD", "usdsgd": "USD/SGD",
    "jpy/inr": "JPY/INR", "jpyinr": "JPY/INR",
}


def detect_forex_query(query: str) -> str | None:
    """
    Returns a pair key like 'USD/INR' if query is about forex.
    Returns 'ALL' if general forex query.
    Returns None if not a forex query.
    """
    lower = query.lower()

    # Check explicit pair first
    for kw, pair in PAIR_KEYWORDS.items():
        if kw in lower:
            return pair

    # Check currency keywords
    found_currencies = []
    for kw, code in CURRENCY_KEYWORDS.items():
        if kw in lower:
            if code and code not in found_currencies:
                found_currencies.append(code)

    if len(found_currencies) >= 2:
        # Build pair from detected currencies
        pair = f"{found_currencies[0]}/{found_currencies[1]}"
        if pair in CURRENCY_PAIRS:
            return pair
        # Try reverse
        pair_rev = f"{found_currencies[1]}/{found_currencies[0]}"
        if pair_rev in CURRENCY_PAIRS:
            return pair_rev

    if len(found_currencies) == 1:
        # Default to USD as base
        code = found_currencies[0]
        for pair_key, (base, quote, _) in CURRENCY_PAIRS.items():
            if base == code or quote == code:
                return pair_key

    # General forex query
    if any(kw in lower for kw in ["forex", "exchange rate", " fx ", "currency"]):
        return "ALL"

    return None


def _fetch_all_rates() -> dict | None:
    """Fetch all latest rates from OXR (base USD)."""
    cache_key = "all_rates"
    with forex_lock:
        if cache_key in forex_cache:
            return forex_cache[cache_key]

    if not OPEN_EXCHANGE_KEY:
        return None

    try:
        resp = requests.get(
            f"{OXR_BASE}/latest.json",
            params={"app_id": OPEN_EXCHANGE_KEY, "symbols": ",".join(ALL_CURRENCIES)},
            timeout=10
        )
        resp.raise_for_status()
        rates = resp.json().get("rates", {})
        with forex_lock:
            forex_cache[cache_key] = rates
        return rates
    except Exception:
        return None


def _fetch_historical_rates(date_str: str) -> dict | None:
    """Fetch rates for a specific date (YYYY-MM-DD)."""
    with forex_hist_lock:
        if date_str in forex_hist_cache:
            return forex_hist_cache[date_str]

    if not OPEN_EXCHANGE_KEY:
        return None

    try:
        resp = requests.get(
            f"{OXR_BASE}/historical/{date_str}.json",
            params={"app_id": OPEN_EXCHANGE_KEY, "symbols": ",".join(ALL_CURRENCIES)},
            timeout=10
        )
        resp.raise_for_status()
        rates = resp.json().get("rates", {})
        with forex_hist_lock:
            forex_hist_cache[date_str] = rates
        return rates
    except Exception:
        return None


def _calc_rate(rates: dict, base: str, quote: str) -> float | None:
    """Calculate cross rate from USD-based rates."""
    try:
        if base == "USD":
            return rates.get(quote)
        elif quote == "USD":
            base_rate = rates.get(base)
            return (1 / base_rate) if base_rate else None
        else:
            base_rate  = rates.get(base)
            quote_rate = rates.get(quote)
            if base_rate and quote_rate:
                return quote_rate / base_rate
    except Exception:
        return None
    return None


def get_forex_data(pair: str) -> str:
    """Get rate + 24h change for a specific pair."""
    if pair not in CURRENCY_PAIRS:
        return f"Unsupported currency pair: {pair}"

    base, quote, display_name = CURRENCY_PAIRS[pair]

    # Current rates
    rates_now = _fetch_all_rates()
    if not rates_now:
        return "Forex data unavailable: API key not set or request failed."

    rate_now = _calc_rate(rates_now, base, quote)
    if not rate_now:
        return f"Could not calculate rate for {pair}."

    # Yesterday's rates for 24h change
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    rates_yesterday = _fetch_historical_rates(yesterday)
    change_str = "N/A"
    change_pct = None

    if rates_yesterday:
        rate_yesterday = _calc_rate(rates_yesterday, base, quote)
        if rate_yesterday and rate_yesterday != 0:
            change_pct = ((rate_now - rate_yesterday) / rate_yesterday) * 100
            direction  = "▲" if change_pct >= 0 else "▼"
            change_str = f"{direction} {abs(change_pct):.3f}%"

    # 7-day change
    week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    rates_week = _fetch_historical_rates(week_ago)
    week_change_str = "N/A"

    if rates_week:
        rate_week = _calc_rate(rates_week, base, quote)
        if rate_week and rate_week != 0:
            week_pct = ((rate_now - rate_week) / rate_week) * 100
            direction = "▲" if week_pct >= 0 else "▼"
            week_change_str = f"{direction} {abs(week_pct):.3f}%"

    return (
        f"Forex: {display_name} ({pair})\n"
        f"Current Rate: 1 {base} = {rate_now:.4f} {quote}\n"
        f"24h Change: {change_str}\n"
        f"7-Day Change: {week_change_str}\n"
        f"Last Updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )


def get_all_forex_snapshot() -> str:
    """Get a snapshot of all tracked pairs."""
    rates_now = _fetch_all_rates()
    if not rates_now:
        return "Forex data unavailable."

    yesterday   = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    rates_yesterday = _fetch_historical_rates(yesterday)

    lines = ["Forex Market Snapshot:"]
    for pair, (base, quote, display_name) in CURRENCY_PAIRS.items():
        rate_now = _calc_rate(rates_now, base, quote)
        if not rate_now:
            continue

        change_str = "N/A"
        if rates_yesterday:
            rate_yesterday = _calc_rate(rates_yesterday, base, quote)
            if rate_yesterday and rate_yesterday != 0:
                change_pct = ((rate_now - rate_yesterday) / rate_yesterday) * 100
                direction  = "▲" if change_pct >= 0 else "▼"
                change_str = f"{direction}{abs(change_pct):.2f}%"

        lines.append(f"{pair}: {rate_now:.4f} ({change_str})")

    return "\n".join(lines)