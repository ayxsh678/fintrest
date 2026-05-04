import os
from pathlib import Path
import time
import concurrent.futures
import uvicorn
from dotenv import load_dotenv
import logging

# Configure logging immediately
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load env from both backend/.env and repo-root .env before importing modules
# that read env vars at import time.
_here = Path(__file__).resolve().parent
load_dotenv(_here / ".env", override=False)
load_dotenv(_here.parent / ".env", override=False)

from rag.retriever import (
    build_context, get_stock_data, get_financial_news, get_ohlc_yf,
    get_earnings_data, get_news_for_ticker,
)
from rag.portfolio import build_portfolio_context, extract_tickers_from_query, get_portfolio_data
from rag.comparison import build_comparison_context, extract_comparison_tickers, get_comparison_data
from rag.memory import create_session, get_history, append_to_history, clear_session
from rag.watchlist_enrich import enrich_watchlist
from rag.alerts import create_alert, get_alerts, delete_alert, check_alerts
from rag.sentiment import get_sentiment, get_news_impact
from rag.eodhd import get_ohlc
from rag.india_ohlc import get_india_ohlc
from rag.forex import detect_forex_query, get_forex_data, get_all_forex_snapshot, CURRENCY_PAIRS
from model.inference import (
    generate_response, generate_portfolio_summary,
    generate_comparison_verdict, generate_forex_insight,
    explain_term, generate_portfolio_analysis, generate_earnings_brief,
    generate_portfolio_autopsy,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="Fintrest - Python Service")


@app.on_event("startup")
def validate_config():
    missing = [k for k in ("GROQ_API_KEY",) if not os.getenv(k)]
    if missing:
        logger.warning("Missing required env vars: %s — related features will degrade.", ", ".join(missing))
    optional = [k for k in ("NEWS_API_KEY",) if not os.getenv(k)]
    if optional:
        logger.warning("Missing optional env vars: %s", ", ".join(optional))

# ── CORS ────────────────────────────────────────────────
_allowed_origin = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        _allowed_origin,
        "https://finance-ai-8qu9.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"https://finance-ai-8qu9\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────────

class ContextRequest(BaseModel):
    question: str
    time_range: str = "7d"

class AskRequest(BaseModel):
    question: str
    time_range: str = "7d"
    session_id: str | None = None

class GenerateRequest(BaseModel):
    question: str
    context: str
    session_id: str | None = None

class PortfolioRequest(BaseModel):
    tickers: list[str]
    session_id: str | None = None

class PortfolioFromChatRequest(BaseModel):
    query: str
    session_id: str | None = None

class CompareRequest(BaseModel):
    ticker_a: str
    ticker_b: str
    session_id: str | None = None

class CompareFromChatRequest(BaseModel):
    query: str
    session_id: str | None = None

class ForexRequest(BaseModel):
    pair: str
    session_id: str | None = None

class ForexFromChatRequest(BaseModel):
    query: str
    session_id: str | None = None

class ExplainRequest(BaseModel):
    term: str
    stock: str | None = None
    context: str | None = None
    session_id: str | None = None

class AlertCreateRequest(BaseModel):
    session_id: str
    ticker: str
    threshold: float
    direction: str  # "above" | "below"

class AlertGetRequest(BaseModel):
    session_id: str

class AlertDeleteRequest(BaseModel):
    session_id: str
    alert_id: str

class AlertCheckRequest(BaseModel):
    session_id: str

class ContextResponse(BaseModel):
    context: str

class GenerateResponse(BaseModel):
    answer: str
    session_id: str

class StockResponse(BaseModel):
    ticker: str
    data: str | dict

class SessionResponse(BaseModel):
    session_id: str
    cleared: bool

class PortfolioResponse(BaseModel):
    tickers: list[str]
    breakdown: dict
    summary: str
    session_id: str

class CompareResponse(BaseModel):
    ticker_a: str
    ticker_b: str
    data_a: dict
    data_b: dict
    verdict: str
    session_id: str

class ForexResponse(BaseModel):
    pair: str
    data: str
    insight: str
    session_id: str

class ExplainResponse(BaseModel):
    term: str
    explanation: str
    session_id: str

class SentimentResponse(BaseModel):
    ticker: str
    score: float | None
    label: str
    headline_count: int
    headlines: list[str]


class Holding(BaseModel):
    ticker: str
    quantity: int
    avg_buy_price: float

class PortfolioAnalysisRequest(BaseModel):
    holdings: list[Holding]
    user_context: str = ""

class RiskFlag(BaseModel):
    severity: str   # "high" | "medium" | "low"
    flag: str
    action: str

class PortfolioAnalysisResponse(BaseModel):
    total_value_inr: float
    holdings_summary: list[dict]
    risk_flags: list[RiskFlag]
    narrative_brief: str
    response_time: float

class Trade(BaseModel):
    ticker: str
    action: str     # "buy" | "sell"
    quantity: int
    price: float
    date: str       # ISO format e.g. "2024-01-15"

class PortfolioAutopsyRequest(BaseModel):
    trades: list[Trade]


# ── Health ─────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "Fintrest Python service is running"}


# ── Session ────────────────────────────────────────────

@app.post("/session/new", response_model=SessionResponse)
def new_session():
    session_id = create_session()
    return SessionResponse(session_id=session_id, cleared=False)


@app.delete("/session/{session_id}", response_model=SessionResponse)
def delete_session(session_id: str):
    clear_session(session_id)
    return SessionResponse(session_id=session_id, cleared=True)


@app.get("/session/{session_id}/history")
def session_history(session_id: str):
    """Return the session's conversation history as a list of {role, content}."""
    return {"session_id": session_id, "messages": get_history(session_id)}


class WatchlistEnrichRequest(BaseModel):
    tickers: list[str]

@app.post("/watchlist/enrich")
def watchlist_enrich(req: WatchlistEnrichRequest):
    tickers = [t.upper().strip() for t in req.tickers if t.strip()]
    if not tickers:
        raise HTTPException(status_code=400, detail="No tickers provided")
    if len(tickers) > 30:
        raise HTTPException(status_code=400, detail="Maximum 30 tickers")
    return {"items": enrich_watchlist(tickers)}


# ── Context ────────────────────────────────────────────

@app.post("/context", response_model=ContextResponse)
def get_context(req: ContextRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    valid_ranges = {"24h", "3d", "7d", "30d", "1y"}
    if req.time_range not in valid_ranges:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time_range. Must be one of: {', '.join(valid_ranges)}"
        )

    context = build_context(req.question, req.time_range)
    return ContextResponse(context=context)


# ── Generate ───────────────────────────────────────────

@app.post("/generate", response_model=GenerateResponse)
def get_response(req: GenerateRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not req.context.strip():
        raise HTTPException(status_code=400, detail="Context cannot be empty")

    session_id = req.session_id or create_session()
    history    = get_history(session_id)
    answer     = generate_response(req.question, req.context, history=history)
    append_to_history(session_id, req.question, answer)

    return GenerateResponse(answer=answer, session_id=session_id)


# ── Ask (context + generate in one shot) ──────────────

@app.post("/ask", response_model=GenerateResponse)
def ask(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    valid_ranges = {"24h", "3d", "7d", "30d", "1y"}
    time_range = req.time_range if req.time_range in valid_ranges else "7d"

    session_id = req.session_id or create_session()
    history    = get_history(session_id)
    context    = build_context(req.question, time_range)
    answer     = generate_response(req.question, context, history=history)
    append_to_history(session_id, req.question, answer)

    return GenerateResponse(answer=answer, session_id=session_id)


# ── Stock ──────────────────────────────────────────────

@app.get("/stock/{ticker}", response_model=StockResponse)
def stock(ticker: str):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
    return StockResponse(ticker=ticker_clean, data=get_stock_data(ticker_clean))


# ── Chart (OHLC for self-hosted lightweight-charts) ────
# Replaces the TradingView widget embed so we avoid TV's licensing popup on
# NSE/BSE charts and keep chart data on the same trust boundary as the rest
# of the app. Backed by EODHD and short-TTL cached in rag.eodhd.
@app.get("/chart/{ticker}")
def chart(ticker: str, days: int = 180):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
    if not 5 <= days <= 730:
        raise HTTPException(status_code=400, detail="days must be between 5 and 730")

    # 1. EODHD (NSE/BSE coverage).
    try:
        rows = get_ohlc(ticker_clean, days=days)
        if rows:
            return {"ticker": ticker_clean, "ok": True, "rows": rows, "source": "eodhd"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("chart: eodhd failed for %s: %s", ticker_clean, exc)

    # 2. Unified Yahoo v8 -> NSE direct -> Stooq cascade. Works for NSE/BSE
    #    without a paid EODHD plan.
    try:
        rows, src = get_india_ohlc(ticker_clean, days=days)
        if rows:
            return {"ticker": ticker_clean, "ok": True, "rows": rows, "source": src}
    except Exception as exc:  # noqa: BLE001
        logger.warning("chart: india_ohlc cascade failed for %s: %s", ticker_clean, exc)

    # 3. yfinance as a final safety net.
    try:
        yf_result = get_ohlc_yf(ticker_clean, days=days)
        rows = yf_result.get("rows", []) if isinstance(yf_result, dict) else yf_result
        if rows:
            return {"ticker": ticker_clean, "ok": True, "rows": rows, "source": "yfinance"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("chart: yfinance failed for %s: %s", ticker_clean, exc)

    logger.debug(
        "chart: no rows for %s (days=%s); providers tried: eodhd, yahoo_v8, nse, stooq, yfinance",
        ticker_clean, days,
    )
    return {"ticker": ticker_clean, "ok": False, "rows": [], "source": None}


# ── Sentiment ──────────────────────────────────────────

@app.get("/sentiment/{ticker}", response_model=SentimentResponse)
def sentiment(ticker: str, company: str = ""):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
    result = get_sentiment(ticker_clean, company_name=company)
    return SentimentResponse(**result)


# ── News with per-article impact ───────────────────────

@app.get("/news/{ticker}")
def news_impact(ticker: str, company: str = "", days: int = 7):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
    if days < 1 or days > 30:
        raise HTTPException(status_code=400, detail="days must be between 1 and 30")
    return get_news_impact(ticker_clean, company_name=company, days=days)


# ── Portfolio ──────────────────────────────────────────

@app.post("/portfolio", response_model=PortfolioResponse)
def analyze_portfolio(req: PortfolioRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="No tickers provided")

    tickers = list(dict.fromkeys(t.upper().strip() for t in req.tickers if t.strip()))
    if len(tickers) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 tickers per portfolio")

    session_id = req.session_id or create_session()
    breakdown  = get_portfolio_data(tickers)
    context    = build_portfolio_context(tickers)
    summary    = generate_portfolio_summary(tickers, context)
    append_to_history(session_id, f"Analyze portfolio: {', '.join(tickers)}", summary)

    return PortfolioResponse(
        tickers=tickers,
        breakdown=breakdown,
        summary=summary,
        session_id=session_id
    )


@app.post("/portfolio/from-chat", response_model=PortfolioResponse)
def portfolio_from_chat(req: PortfolioFromChatRequest):
    tickers = extract_tickers_from_query(req.query)
    if not tickers:
        raise HTTPException(
            status_code=400,
            detail="No recognizable tickers found in your message"
        )
    return analyze_portfolio(PortfolioRequest(tickers=tickers, session_id=req.session_id))


# ── Comparison ─────────────────────────────────────────

@app.post("/compare", response_model=CompareResponse)
def compare_stocks(req: CompareRequest):
    ticker_a = req.ticker_a.upper().strip()
    ticker_b = req.ticker_b.upper().strip()

    if not ticker_a or not ticker_b:
        raise HTTPException(status_code=400, detail="Both tickers are required")
    if ticker_a == ticker_b:
        raise HTTPException(status_code=400, detail="Tickers must be different")

    session_id = req.session_id or create_session()
    data       = get_comparison_data(ticker_a, ticker_b)
    context    = build_comparison_context(ticker_a, ticker_b)
    verdict    = generate_comparison_verdict(ticker_a, ticker_b, context)

    append_to_history(session_id, f"Compare {ticker_a} vs {ticker_b}", verdict)

    return CompareResponse(
        ticker_a=ticker_a,
        ticker_b=ticker_b,
        data_a=data.get(ticker_a, {}),
        data_b=data.get(ticker_b, {}),
        verdict=verdict,
        session_id=session_id
    )


@app.post("/compare/from-chat", response_model=CompareResponse)
def compare_from_chat(req: CompareFromChatRequest):
    result = extract_comparison_tickers(req.query)
    if not result:
        raise HTTPException(
            status_code=400,
            detail="Could not find two tickers to compare. Try: 'compare RELIANCE.NS vs TCS.NS'"
        )
    ticker_a, ticker_b = result
    return compare_stocks(CompareRequest(
        ticker_a=ticker_a,
        ticker_b=ticker_b,
        session_id=req.session_id
    ))


# ── Forex ──────────────────────────────────────────────

@app.get("/forex/pairs")
def list_forex_pairs():
    return {
        "pairs": [
            {"pair": k, "name": v[2]}
            for k, v in CURRENCY_PAIRS.items()
        ]
    }


@app.post("/forex", response_model=ForexResponse)
def get_forex(req: ForexRequest):
    pair = req.pair.upper().strip()
    if pair not in CURRENCY_PAIRS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported pair. Supported: {', '.join(CURRENCY_PAIRS.keys())}"
        )

    session_id = req.session_id or create_session()
    forex_data = get_forex_data(pair)
    news       = get_financial_news_for_forex(pair)
    insight    = generate_forex_insight(pair, forex_data, news)

    append_to_history(session_id, f"Forex analysis: {pair}", insight)

    return ForexResponse(
        pair=pair,
        data=forex_data,
        insight=insight,
        session_id=session_id
    )


@app.post("/forex/from-chat", response_model=ForexResponse)
def forex_from_chat(req: ForexFromChatRequest):
    pair = detect_forex_query(req.query)
    if not pair or pair == "ALL":
        pair = "USD/INR"
    return get_forex(ForexRequest(pair=pair, session_id=req.session_id))


# ── Explain (beginner mode) ────────────────────────────

@app.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    if not req.term.strip():
        raise HTTPException(status_code=400, detail="Term cannot be empty")

    session_id  = req.session_id or create_session()
    explanation = explain_term(
        req.term,
        context=req.context or "",
        stock=req.stock or ""
    )

    append_to_history(session_id, f"Explain {req.term} for beginner", explanation)

    return ExplainResponse(
        term=req.term,
        explanation=explanation,
        session_id=session_id
    )


# ── Alerts ─────────────────────────────────────────────

@app.post("/create_alert")
def route_create_alert(req: AlertCreateRequest):
    direction = req.direction.lower()
    if direction not in ("above", "below"):
        raise HTTPException(status_code=400, detail="direction must be 'above' or 'below'")
    if req.threshold <= 0:
        raise HTTPException(status_code=400, detail="threshold must be a positive number")
    return create_alert(
        session_id=req.session_id,
        ticker=req.ticker,
        threshold=req.threshold,
        direction=direction,
    )


@app.post("/get_alerts")
def route_get_alerts(req: AlertGetRequest):
    return get_alerts(req.session_id)


@app.post("/delete_alert")
def route_delete_alert(req: AlertDeleteRequest):
    deleted = delete_alert(req.session_id, req.alert_id)
    return {"deleted": deleted}


@app.post("/check_alerts")
def route_check_alerts(req: AlertCheckRequest):
    triggered = check_alerts(req.session_id)
    return {"triggered": triggered}


# ── Analyze Portfolio (structured, with risk flags) ────

@app.post("/analyze-portfolio", response_model=PortfolioAnalysisResponse)
def analyze_portfolio_v2(req: PortfolioAnalysisRequest):
    if not req.holdings:
        raise HTTPException(status_code=400, detail="No holdings provided")
    if len(req.holdings) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 holdings")

    start = time.time()
    tickers = [h.ticker.upper().strip() for h in req.holdings]

    # Fetch live stock data concurrently
    stock_data: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(get_stock_data, t): t for t in tickers}
        for future in concurrent.futures.as_completed(futures):
            t = futures[future]
            try:
                stock_data[t] = future.result()
            except Exception:
                stock_data[t] = {"ticker": t, "error": "Data unavailable"}

    # Build holdings summary + total value
    holdings_summary: list[dict] = []
    total_value = 0.0
    for holding in req.holdings:
        ticker = holding.ticker.upper().strip()
        data   = stock_data.get(ticker, {})
        cur    = data.get("price") or holding.avg_buy_price
        cur_val  = cur * holding.quantity
        cost_val = holding.avg_buy_price * holding.quantity
        pnl_pct  = ((cur - holding.avg_buy_price) / holding.avg_buy_price * 100
                    if holding.avg_buy_price else 0)
        total_value += cur_val
        holdings_summary.append({
            "ticker":         ticker,
            "name":           data.get("name", ticker),
            "quantity":       holding.quantity,
            "avg_buy_price":  holding.avg_buy_price,
            "current_price":  round(cur, 2),
            "current_value":  round(cur_val, 2),
            "cost_basis":     round(cost_val, 2),
            "pnl_pct":        round(pnl_pct, 2),
            "weight":         0.0,
            "pe_ratio":       data.get("pe_ratio"),
            "week52_high":    data.get("week52_high"),
            "week52_low":     data.get("week52_low"),
        })

    # Calculate portfolio weights
    for item in holdings_summary:
        item["weight"] = round(item["current_value"] / total_value * 100, 2) if total_value else 0

    # Concentration risk flags
    risk_flags: list[RiskFlag] = []
    for item in holdings_summary:
        w = item["weight"]
        if w > 30:
            risk_flags.append(RiskFlag(
                severity="high",
                flag=f"Concentration risk: {item['ticker']} is {w:.1f}% of portfolio",
                action=f"Trim {item['ticker']} to below 25% of portfolio",
            ))
        elif w > 20:
            risk_flags.append(RiskFlag(
                severity="medium",
                flag=f"High concentration: {item['ticker']} is {w:.1f}% of portfolio",
                action=f"Monitor {item['ticker']}; rebalance if it grows further",
            ))

    india_weight = sum(
        item["weight"] for item in holdings_summary
        if ".NS" in item["ticker"] or ".BO" in item["ticker"]
    )
    if india_weight < 20 and total_value > 0:
        risk_flags.append(RiskFlag(
            severity="low",
            flag="Low India allocation: less than 20% in Indian equities",
            action="Consider adding Nifty 50 large-caps for domestic exposure",
        ))

    # Build LLM context string
    ctx_lines = [
        f"Portfolio Total Value: ₹{total_value:,.2f}",
        f"Holdings ({len(holdings_summary)}):",
    ]
    for item in holdings_summary:
        ctx_lines.append(
            f"  {item['ticker']} ({item['name']}): {item['weight']:.1f}% weight | "
            f"P&L: {item['pnl_pct']:+.2f}% | Price: ₹{item['current_price']} | "
            f"P/E: {item.get('pe_ratio') or 'N/A'}"
        )
    if req.user_context:
        ctx_lines.append(f"Investor context: {req.user_context}")

    narrative = generate_portfolio_analysis("\n".join(ctx_lines), risk_flags)

    return PortfolioAnalysisResponse(
        total_value_inr=round(total_value, 2),
        holdings_summary=holdings_summary,
        risk_flags=risk_flags,
        narrative_brief=narrative,
        response_time=round(time.time() - start, 2),
    )


# ── Earnings Brief ─────────────────────────────────────

@app.get("/earnings-brief/{ticker}")
def earnings_brief(ticker: str):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")

    earnings  = get_earnings_data(ticker_clean)
    news      = get_news_for_ticker(ticker_clean, days=30)
    news_text = "\n".join(
        f"- {a['title']} ({a['published_at']})" for a in news[:5]
    )
    brief = generate_earnings_brief(ticker_clean, earnings, news_text)

    return {
        "ticker":             ticker_clean,
        "next_earnings_date": earnings.get("next_earnings_date"),
        "eps_estimate":       earnings.get("eps_estimate"),
        "eps_actual":         earnings.get("eps_actual"),
        "forward_pe":         earnings.get("forward_pe"),
        "brief":              brief,
    }


# ── Portfolio Autopsy ──────────────────────────────────

@app.post("/portfolio-autopsy")
def portfolio_autopsy(req: PortfolioAutopsyRequest):
    if not req.trades:
        raise HTTPException(status_code=400, detail="No trades provided")
    if len(req.trades) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 trades")

    # FIFO P&L matching per ticker
    from collections import defaultdict
    open_lots: dict[str, list[dict]] = defaultdict(list)
    realized: list[dict] = []

    for trade in sorted(req.trades, key=lambda t: t.date):
        t = trade.ticker.upper()
        if trade.action.lower() == "buy":
            open_lots[t].append({"qty": trade.quantity, "price": trade.price, "date": trade.date})
        elif trade.action.lower() == "sell":
            if not open_lots[t]:
                logger.warning("SELL for %s on %s has no matching BUY — skipped", t, trade.date)
                continue
            remaining = trade.quantity
            for lot in open_lots[t]:
                if remaining <= 0:
                    break
                matched  = min(remaining, lot["qty"])
                pnl      = (trade.price - lot["price"]) * matched
                pnl_pct  = ((trade.price - lot["price"]) / lot["price"] * 100
                            if lot["price"] else 0)
                realized.append({
                    "ticker":     t,
                    "buy_date":   lot["date"],
                    "sell_date":  trade.date,
                    "quantity":   matched,
                    "buy_price":  lot["price"],
                    "sell_price": trade.price,
                    "pnl":        round(pnl, 2),
                    "pnl_pct":    round(pnl_pct, 2),
                })
                lot["qty"]  -= matched
                remaining   -= matched
            open_lots[t] = [l for l in open_lots[t] if l["qty"] > 0]

    total_pnl = sum(r["pnl"] for r in realized)
    winners   = sorted([r for r in realized if r["pnl"] > 0],  key=lambda x: x["pnl_pct"], reverse=True)
    losers    = sorted([r for r in realized if r["pnl"] <= 0], key=lambda x: x["pnl_pct"])

    ctx_lines = [
        f"Total Realized P&L: ₹{total_pnl:,.2f}",
        f"Trades analyzed: {len(realized)} | Winners: {len(winners)} | Losers: {len(losers)}",
    ]
    if winners:
        top = winners[0]
        ctx_lines.append(
            f"Best trade: {top['ticker']} {top['buy_date']}→{top['sell_date']} "
            f"+{top['pnl_pct']:.1f}% (₹{top['pnl']:,.0f})"
        )
    if losers:
        worst = losers[0]
        ctx_lines.append(
            f"Worst trade: {worst['ticker']} {worst['buy_date']}→{worst['sell_date']} "
            f"{worst['pnl_pct']:.1f}% (₹{worst['pnl']:,.0f})"
        )
    for r in realized[:10]:
        sign = "+" if r["pnl"] >= 0 else ""
        ctx_lines.append(
            f"  {r['ticker']}: Buy ₹{r['buy_price']} on {r['buy_date']}, "
            f"Sell ₹{r['sell_price']} on {r['sell_date']} → {sign}{r['pnl_pct']:.1f}%"
        )

    narrative = generate_portfolio_autopsy("\n".join(ctx_lines))

    return {
        "total_pnl":       round(total_pnl, 2),
        "trade_count":     len(realized),
        "winners":         len(winners),
        "losers":          len(losers),
        "realized_trades": realized,
        "narrative":       narrative,
    }


# ── Helper (internal) ──────────────────────────────────

def get_financial_news_for_forex(pair: str) -> str:
    """Fetch news relevant to a forex pair for LLM context."""
    # Use individual currency codes as search queries to get relevant articles
    base, quote = pair.split("/") if "/" in pair else (pair, "")
    articles = get_financial_news(base, days=7)
    if not articles and quote:
        articles = get_financial_news(quote, days=7)
    if not articles:
        return "No recent forex news available."
    return "\n".join(
        f"- {a.get('title', '')} ({a.get('source', '')})"
        for a in articles[:5]
    )


# ── Entry point ────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
