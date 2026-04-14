import os
import requests
from cachetools import TTLCache
from threading import Lock

COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY")  # optional — works without key on free tier
COINGECKO_BASE = "https://api.coingecko.com/api/v3"

crypto_cache = TTLCache(maxsize=100, ttl=120)  # 2 min — crypto moves fast
crypto_lock  = Lock()

# ── Coin ID map ────────────────────────────────────────
# CoinGecko uses IDs not symbols — map common names/symbols to IDs
COIN_MAP = {
    # By name
    "bitcoin": "bitcoin",       "btc": "bitcoin",
    "ethereum": "ethereum",     "eth": "ethereum",
    "solana": "solana",         "sol": "solana",
    "binance": "binancecoin",   "bnb": "binancecoin",
    "ripple": "ripple",         "xrp": "ripple",
    "cardano": "cardano",       "ada": "cardano",
    "dogecoin": "dogecoin",     "doge": "dogecoin",
    "polygon": "matic-network", "matic": "matic-network",
    "avalanche": "avalanche-2", "avax": "avalanche-2",
    "chainlink": "chainlink",   "link": "chainlink",
    "litecoin": "litecoin",     "ltc": "litecoin",
    "polkadot": "polkadot",     "dot": "polkadot",
    "shiba": "shiba-inu",       "shib": "shiba-inu",
    "uniswap": "uniswap",       "uni": "uniswap",
    "tron": "tron",             "trx": "tron",
    "stellar": "stellar",       "xlm": "stellar",
    # Indian crypto exchanges list these too
    "wazirx": "wazirx",         "wrx": "wazirx",
}

KNOWN_COINS = set(COIN_MAP.keys())


def get_coin_id(query: str) -> str | None:
    """Resolve a name or symbol to a CoinGecko coin ID."""
    return COIN_MAP.get(query.lower().strip())


def get_crypto_data(coin_id: str) -> str:
    """Fetch real-time crypto data from CoinGecko."""
    with crypto_lock:
        if coin_id in crypto_cache:
            return crypto_cache[coin_id]

    try:
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY

        resp = requests.get(
            f"{COINGECKO_BASE}/coins/{coin_id}",
            params={
                "localization": "false",
                "tickers": "false",
                "community_data": "false",
                "developer_data": "false",
            },
            headers=headers,
            timeout=10
        )
        resp.raise_for_status()
        d = resp.json()
        m = d.get("market_data", {})

        price_usd  = m.get("current_price", {}).get("usd", "N/A")
        price_inr  = m.get("current_price", {}).get("inr", "N/A")
        change_24h = m.get("price_change_percentage_24h", "N/A")
        change_7d  = m.get("price_change_percentage_7d", "N/A")
        market_cap = m.get("market_cap", {}).get("usd", 0)
        volume_24h = m.get("total_volume", {}).get("usd", 0)
        high_24h   = m.get("high_24h", {}).get("usd", "N/A")
        low_24h    = m.get("low_24h", {}).get("usd", "N/A")
        ath        = m.get("ath", {}).get("usd", "N/A")
        rank       = d.get("market_cap_rank", "N/A")

        def fmt_num(v, prefix=""):
            if v == "N/A" or v is None:
                return "N/A"
            try:
                return f"{prefix}{v:,}"
            except (ValueError, TypeError):
                return str(v)

        def fmt_pct(v):
            if v == "N/A" or v is None:
                return "N/A"
            try:
                return f"{float(v):.2f}%"
            except (ValueError, TypeError):
                return str(v)

        result = (
            f"Crypto: {d.get('name', coin_id)} ({d.get('symbol', '').upper()})\n"
            f"Price (USD): {fmt_num(price_usd, '$')}\n"
            f"Price (INR): {fmt_num(price_inr, '₹')}\n"
            f"24h Change: {fmt_pct(change_24h)}\n"
            f"7d Change: {fmt_pct(change_7d)}\n"
            f"24h High: {fmt_num(high_24h, '$')}\n"
            f"24h Low: {fmt_num(low_24h, '$')}\n"
            f"All-Time High: {fmt_num(ath, '$')}\n"
            f"Market Cap: ${market_cap:,}\n"
            f"24h Volume: ${volume_24h:,}\n"
            f"Market Cap Rank: #{rank}"
        )

    except requests.exceptions.Timeout:
        result = f"Crypto data unavailable: request timed out."
    except requests.exceptions.HTTPError as e:
        result = f"Crypto data unavailable: HTTP {e.response.status_code}"
    except Exception as e:
        result = f"Crypto data unavailable: {str(e)}"

    with crypto_lock:
        crypto_cache[coin_id] = result
    return result


def get_crypto_news(coin_name: str) -> str:
    """Fetch trending news for a coin via CoinGecko search trending fallback."""
    try:
        resp = requests.get(
            f"{COINGECKO_BASE}/search/trending",
            timeout=8
        )
        resp.raise_for_status()
        coins = resp.json().get("coins", [])
        names = [c["item"]["name"] for c in coins[:5]]
        if names:
            return f"Trending crypto right now: {', '.join(names)}"
        return ""
    except Exception:
        return ""