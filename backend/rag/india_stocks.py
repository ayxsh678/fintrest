import os
import re
import yfinance as yf
import pandas as pd
from cachetools import TTLCache
from threading import Lock

from rag.alpha_vantage import get_quote as av_get_quote, format_as_stock_data as av_format
from rag.nse_quote import get_nse_quote, format_as_stock_data as nse_format
from rag.eodhd import get_avg_volume as eodhd_get_avg_volume

india_cache = TTLCache(maxsize=100, ttl=300)
india_lock  = Lock()

# ── NSE/BSE ticker map ─────────────────────────────────
INDIA_COMPANY_MAP = {
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
    for word in query.upper().split():
        clean = re.sub(r"[^A-Z0-9.&-]", "", word)
        if clean in KNOWN_INDIA_TICKERS:
            return clean
        if clean + ".NS" in KNOWN_INDIA_TICKERS:
            return clean + ".NS"
    return None


def get_india_stock_data(ticker: str, as_dict: bool = False):
    """
    Fetch NSE/BSE stock data via yfinance.
    as_dict=True  → returns a JSON-serialisable dict (used by compare table).
    as_dict=False → returns the legacy formatted string (used by /ask context).
    """
    cache_key = f"{ticker}:{'dict' if as_dict else 'str'}"
    with india_lock:
        if cache_key in india_cache:
            return india_cache[cache_key]

    try:
        stock    = yf.Ticker(ticker)
        info     = stock.info
        hist     = stock.history(period="5d")
        hist_30d = stock.history(period="30d")

        if hist.empty:
            result = {"ticker": ticker, "error": "No price history found"} if as_dict \
                     else f"No price history found for {ticker}."
            with india_lock:
                india_cache[cache_key] = result
            return result

        change_pct     = ((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0] * 100)
        avg_volume_30d = hist_30d["Volume"].mean() if not hist_30d.empty else 0
        latest_volume  = hist["Volume"].iloc[-1]

        # yfinance volume often empty for NSE on cloud IPs — fall back to EODHD
        if not avg_volume_30d or avg_volume_30d <= 0:
            try:
                fallback_avg = eodhd_get_avg_volume(ticker)
                if fallback_avg and fallback_avg > 0:
                    avg_volume_30d = fallback_avg
            except Exception:
                pass

        rel_volume_ratio = (
            round(latest_volume / avg_volume_30d, 2)
            if avg_volume_30d and avg_volume_30d > 0 and latest_volume else None
        )
        rel_volume_str = f"{rel_volume_ratio}x" if rel_volume_ratio else "N/A"

        currency = info.get("currency", "INR")
        symbol   = "₹" if currency == "INR" else "$"

        if as_dict:
            result = {
                "ticker":          ticker,
                "name":            info.get("longName", ticker),
                "price":           info.get("currentPrice") or info.get("regularMarketPrice"),
                "change":          info.get("regularMarketChangePercent"),
                "five_day_change": round(change_pct, 2),
                "market":          "NSE/BSE",
                "currency":        currency,
                "market_cap":      info.get("marketCap"),
                "pe_ratio":        info.get("trailingPE"),
                "week52_high":     info.get("fiftyTwoWeekHigh"),
                "week52_low":      info.get("fiftyTwoWeekLow"),
                "rel_volume":      rel_volume_ratio,
                "eps_actual":      info.get("trailingEps"),
            }
        else:
            result = (
                f"Stock: {info.get('longName', ticker)} ({ticker}) — NSE/BSE\n"
                f"Current Price: {symbol}{info.get('currentPrice', 'N/A')}\n"
                f"Previous Close: {symbol}{info.get('previousClose', 'N/A')}\n"
                f"52W High: {symbol}{info.get('fiftyTwoWeekHigh', 'N/A')}\n"
                f"52W Low: {symbol}{info.get('fiftyTwoWeekLow', 'N/A')}\n"
                f"P/E Ratio: {info.get('trailingPE', 'N/A')}\n"
                f"Market Cap: {symbol}{int(info.get('marketCap') or 0):,}\n"
                f"EPS: {info.get('trailingEps', 'N/A')}\n"
                f"5-Day Change: {change_pct:.2f}%\n"
                f"Latest Volume: {int(latest_volume):,}\n"
                f"30D Avg Volume: {int(avg_volume_30d):,}\n"
                f"Relative Volume: {rel_volume_str}"
            )

    except Exception as e:
        nse = get_nse_quote(ticker)
        if nse:
            if as_dict:
                result = {
                    "ticker":          ticker,
                    "name":            nse.get("long_name", ticker),
                    "price":           nse.get("price"),
                    "change":          nse.get("change_pct"),
                    "five_day_change": nse.get("change_pct"),
                    "market":          "NSE/BSE",
                    "currency":        "INR",
                    "market_cap":      nse.get("mkt_cap"),
                    "pe_ratio":        nse.get("pe"),
                    "week52_high":     nse.get("week_high"),
                    "week52_low":      nse.get("week_low"),
                    "rel_volume":      nse.get("rel_vol"),
                    "eps_actual":      nse.get("eps"),
                }
            else:
                result = nse_format(ticker, nse)
        else:
            av_quote = av_get_quote(ticker)
            if av_quote:
                if as_dict:
                    result = {
                        "ticker":          ticker,
                        "name":            av_quote.get("long_name", ticker),
                        "price":           av_quote.get("price"),
                        "change":          av_quote.get("change_pct"),
                        "five_day_change": av_quote.get("change_pct"),
                        "market":          "NSE/BSE",
                        "currency":        "INR",
                        "market_cap":      av_quote.get("mkt_cap"),
                        "pe_ratio":        av_quote.get("pe"),
                        "week52_high":     av_quote.get("week_high"),
                        "week52_low":      av_quote.get("week_low"),
                        "rel_volume":      av_quote.get("rel_vol"),
                        "eps_actual":      av_quote.get("eps"),
                    }
                else:
                    result = av_format(ticker, av_quote, symbol="₹", label="NSE/BSE")
            else:
                result = {"ticker": ticker, "error": str(e)} if as_dict \
                            else f"India stock data unavailable: {str(e)}"

    with india_lock:
        india_cache[cache_key] = result
    return result
