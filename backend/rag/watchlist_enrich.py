"""Read-only enrichment for watchlist tickers.

Takes a list of tickers (source of truth lives in the Go gateway) and returns
live price + sentiment snapshot for each. Routes India tickers (.NS/.BO) to
get_india_stock_data and the rest to get_stock_data.
"""
import concurrent.futures
import logging
import re

from rag.retriever import get_stock_data, get_ohlc_yf
from rag.india_stocks import get_india_stock_data
from rag.crypto import get_coin_id, get_crypto_data
from rag.sentiment import get_sentiment
from rag.eodhd import get_ohlc as eodhd_get_ohlc

logger = logging.getLogger(__name__)
_BATCH_TIMEOUT_S = 20.0


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


def _get_sparkline(ticker: str, points: int = 30) -> list[float] | None:
    """Return the last `points` daily close prices for the sparkline chart.

    Tries EODHD first (covers NSE/BSE), then yfinance as fallback (covers
    US and crypto). Returns None when both sources are unavailable so the
    frontend can fall back to its own placeholder rather than crashing.
    """
    try:
        rows = eodhd_get_ohlc(ticker, days=points + 5) or get_ohlc_yf(ticker, days=points + 5)
        if not rows:
            return None
        closes: list[float] = []
        for r in rows[-points:]:
            if not isinstance(r, dict) or "close" not in r:
                continue  # skip malformed rows rather than raising
            closes.append(float(r["close"]))
        return closes if len(closes) >= 2 else None
    except (TypeError, ValueError, KeyError) as exc:
        import logging
        logging.getLogger(__name__).debug("sparkline fetch failed for %s: %s", ticker, exc)
        return None


def _fetch_one(ticker: str) -> dict:
    kind = _classify(ticker)

    # Price is the only mandatory field - if this fails the row is useless.
    try:
        if kind == "india":
            raw = get_india_stock_data(ticker)
        elif kind == "crypto":
            raw = get_crypto_data(get_coin_id(ticker.lower()))
        else:
            raw = get_stock_data(ticker)
    except Exception as e:  # noqa: BLE001
        logger.warning("enrich price fetch failed for %s: %s", ticker, e)
        return {"ticker": ticker, "type": kind, "error": str(e)}

    # Sentiment + sparkline are best-effort. A slow or failing sentiment
    # model shouldn't blank out the whole watchlist row.
    try:
        sentiment = get_sentiment(ticker)
    except Exception as e:  # noqa: BLE001
        logger.warning("enrich sentiment failed for %s: %s", ticker, e)
        sentiment = {"score": None, "label": None}

    try:
        sparkline = _get_sparkline(ticker)
    except Exception as e:  # noqa: BLE001
        logger.warning("enrich sparkline failed for %s: %s", ticker, e)
        sparkline = None

    return {
        "ticker": ticker,
        "type": kind,
        "price": _parse_price(raw),
        "change_5d_pct": _parse_change(raw),
        "sentiment_score": sentiment.get("score"),
        "sentiment_label": sentiment.get("label"),
        "sparkline": sparkline,
    }


def enrich_watchlist(tickers: list[str]) -> list[dict]:
    """Fan out per-ticker enrichment under a batch wall-clock budget.

    Without a timeout the slowest ticker dictates end-to-end latency, which
    routinely tripped the Go gateway's 30s client timeout and surfaced as
    "Enrichment service unavailable" for the entire watchlist. We now
    return placeholder rows for any ticker that hasn't completed by the
    time the budget elapses - the frontend already renders those as "-".

    The budget is applied to the batch as a whole (via as_completed's
    timeout) rather than per ticker. That's the cheapest correct behaviour
    given ThreadPoolExecutor can't cancel already-running work on timeout.
    """
    if not tickers:
        return []

    # Index results by *position* rather than by ticker string, so that a
    # watchlist containing duplicate tickers still aligns 1:1 with the
    # input list. (By-ticker indexing would collapse duplicates and leave
    # earlier slots stuck as the timeout placeholder.)
    results: list[dict] = [
        {"ticker": t, "type": _classify(t), "error": "timeout"} for t in tickers
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(tickers))) as ex:
        futures = {ex.submit(_fetch_one, t): i for i, t in enumerate(tickers)}
        try:
            for fut in concurrent.futures.as_completed(futures, timeout=_BATCH_TIMEOUT_S):
                idx = futures[fut]
                try:
                    # as_completed guarantees fut is done, so no timeout here.
                    results[idx] = fut.result()
                except Exception as e:  # noqa: BLE001
                    t = tickers[idx]
                    logger.warning("enrich row failed for %s: %s", t, e)
                    results[idx] = {
                        "ticker": t, "type": _classify(t), "error": str(e),
                    }
        except concurrent.futures.TimeoutError:
            logger.info(
                "enrich: batch timeout after %.1fs; returning partial results",
                _BATCH_TIMEOUT_S,
            )
    return results
