import os
import re
import yfinance as yf
import pandas as pd
from cachetools import TTLCache
from threading import Lock

india_cache = TTLCache(maxsize=100, ttl=300)
india_lock  = Lock()

# ── NSE/BSE ticker map ─────────────────────────────────
# yfinance uses .NS suffix for NSE and .BO for BSE
INDIA_COMPANY_MAP = {
    # Nifty 50 core
    "reliance": "RELIANCE.NS",
    "tcs": "TCS.NS",           "tata consultancy": "TCS.NS",
    "infosys": "INFY.NS",      "infy": "INFY.NS",
    "hdfc bank": "HDFCBANK.NS","hdfc": "HDFCBANK.NS",
    "icici bank": "ICICIBANK.NS","icici": "ICICIBANK.NS",
    "wipro": "WIPRO.NS",
    "hcl": "HCLTECH.NS",       "hcl tech": "HCLTECH.NS",
    "bajaj finance": "BAJFINANCE.NS",
    "kotak": "KOTAKBANK.NS",   "kotak bank": "KOTAKBANK.NS",
    "ltimindtree": "LTIM.NS",
    "axis bank": "AXISBANK.NS","axis": "AXISBANK.NS",
    "maruti": "MARUTI.NS",     "maruti suzuki": "MARUTI.NS",
    "titan": "TITAN.NS",
    "asian paints": "ASIANPAINT.NS",
    "sun pharma": "SUNPHARMA.NS",
    "ola": "OLAMOBILITY.NS",
    "zomato": "ZOMATO.NS",
    "paytm": "PAYTM.NS",       "one97": "PAYTM.NS",
    "adani": "ADANIENT.NS",    "adani enterprises": "ADANIENT.NS",
    "adani ports": "ADANIPORTS.NS",
    "adani green": "ADANIGREEN.NS",
    "tata motors": "TATAMOTORS.NS",
    "tata steel": "TATASTEEL.NS",
    "tata power": "TATAPOWER.NS",
    "hindalco": "HINDALCO.NS",
    "jswsteel": "JSWSTEEL.NS", "jsw steel": "JSWSTEEL.NS",
    "bhel": "BHEL.NS",
    "ongc": "ONGC.NS",
    "ntpc": "NTPC.NS",
    "power grid": "POWERGRID.NS",
    "coal india": "COALINDIA.NS",
    "sbi": "SBIN.NS",          "state bank": "SBIN.NS",
    "bank of baroda": "BANKBARODA.NS",
    "nykaa": "FSN.NS",
    "policybazaar": "POLICYBZR.NS",
    "delhivery": "DELHIVERY.NS",
    "irctc": "IRCTC.NS",
    "indigo": "INDIGO.NS",     "interglobe": "INDIGO.NS",
    "bharti airtel": "BHARTIARTL.NS", "airtel": "BHARTIARTL.NS",
    "jio": "RELIANCE.NS",
    "hero motocorp": "HEROMOTOCO.NS",
    "bajaj auto": "BAJAJ-AUTO.NS",
    "eicher": "EICHERMOT.NS",  "royal enfield": "EICHERMOT.NS",
    "dr reddy": "DRREDDY.NS",
    "cipla": "CIPLA.NS",
    "divis": "DIVISLAB.NS",
    "ultracemco": "ULTRACEMCO.NS", "ultratech cement": "ULTRACEMCO.NS",
    "grasim": "GRASIM.NS",
    "m&m": "M&M.NS",           "mahindra": "M&M.NS",
}

KNOWN_INDIA_TICKERS = set(INDIA_COMPANY_MAP.values())


def extract_india_ticker(query: str) -> str | None:
    query_lower = query.lower()
    for name in sorted(INDIA_COMPANY_MAP, key=len, reverse=True):
        if name in query_lower:
            return INDIA_COMPANY_MAP[name]

    # Direct ticker match — user typed RELIANCE.NS or INFY etc.
    for word in query.upper().split():
        clean = re.sub(r"[^A-Z0-9.&-]", "", word)
        if clean in KNOWN_INDIA_TICKERS:
            return clean
        # Auto-append .NS if bare Indian ticker
        if clean + ".NS" in KNOWN_INDIA_TICKERS:
            return clean + ".NS"

    return None


def get_india_stock_data(ticker: str) -> str:
    """Fetch NSE/BSE stock data via yfinance."""
    with india_lock:
        if ticker in india_cache:
            return india_cache[ticker]

    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period="5d")
        hist_30d = stock.history(period="30d")

        if hist.empty:
            return f"No price history found for {ticker}."

        change_pct = (
            (hist["Close"].iloc[-1] - hist["Close"].iloc[0])
            / hist["Close"].iloc[0] * 100
        )

        avg_volume_30d = hist_30d["Volume"].mean() if not hist_30d.empty else 0
        latest_volume  = hist["Volume"].iloc[-1]
        rel_volume = (
            f"{latest_volume / avg_volume_30d:.2f}x"
            if avg_volume_30d > 0 else "N/A"
        )

        currency = info.get("currency", "INR")
        symbol   = "₹" if currency == "INR" else "$"

        result = (
            f"Stock: {info.get('longName', ticker)} ({ticker}) — NSE/BSE\n"
            f"Current Price: {symbol}{info.get('currentPrice', 'N/A')}\n"
            f"Previous Close: {symbol}{info.get('previousClose', 'N/A')}\n"
            f"52W High: {symbol}{info.get('fiftyTwoWeekHigh', 'N/A')}\n"
            f"52W Low: {symbol}{info.get('fiftyTwoWeekLow', 'N/A')}\n"
            f"P/E Ratio: {info.get('trailingPE', 'N/A')}\n"
            f"Market Cap: {symbol}{info.get('marketCap', 0):,}\n"
            f"EPS: {info.get('trailingEps', 'N/A')}\n"
            f"5-Day Change: {change_pct:.2f}%\n"
            f"Latest Volume: {int(latest_volume):,}\n"
            f"30D Avg Volume: {int(avg_volume_30d):,}\n"
            f"Relative Volume: {rel_volume}"
        )

    except Exception as e:
        result = f"India stock data unavailable: {str(e)}"

    with india_lock:
        india_cache[ticker] = result
    return result