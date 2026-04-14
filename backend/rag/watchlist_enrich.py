"""Read-only enrichment for watchlist tickers.

Takes a list of tickers (source of truth lives in the Go gateway) and returns
live price + sentiment snapshot for each. Routes India tickers (.NS/.BO) to
get_india_stock_data and the rest to get_stock_data.
"""
import concurrent.futures
import re

from rag.retriever import get_stock_data
from rag.india_stocks import get_india_stock_data
from rag.crypto import get_coin_id, get_crypto_data
from rag.sentiment import get_sentiment


def _parse_price(raw: str) -> float | None:
    m = re.search(r"Current Price:\s*[₹$]?([\d,]+\.?\d*)", raw)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _parse_change(raw: str) -> float | None:
    m = re.search(r"5-Day Change:\s*(-?[\d.]+)%", raw)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _classify(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".NS") or t.endswith(".BO"):
        return "india"
    if get_coin_id(t.lower()):
        return "crypto"
    return "us"


def _fetch_one(ticker: str) -> dict:
    kind = _classify(ticker)
    try:
        if kind == "india":
            raw = get_india_stock_data(ticker)
        elif kind == "crypto":
            raw = get_crypto_data(get_coin_id(ticker.lower()))
        else:
            raw = get_stock_data(ticker)
        sentiment = get_sentiment(ticker)
    except Exception as e:
        return {"ticker": ticker, "type": kind, "error": str(e)}

    return {
        "ticker": ticker,
        "type": kind,
        "price": _parse_price(raw),
        "change_5d_pct": _parse_change(raw),
        "sentiment_score": sentiment.get("score"),
        "sentiment_label": sentiment.get("label"),
    }


def enrich_watchlist(tickers: list[str]) -> list[dict]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(tickers))) as ex:
        return list(ex.map(_fetch_one, tickers))
