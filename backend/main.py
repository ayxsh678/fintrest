from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag.retriever import build_context, get_stock_data, get_financial_news
from rag.portfolio import build_portfolio_context, extract_tickers_from_query, get_portfolio_data
from rag.comparison import build_comparison_context, extract_comparison_tickers, get_comparison_data
from rag.memory import create_session, get_history, append_to_history, clear_session
from rag.alerts import create_alert, get_alerts, delete_alert, check_alerts
from rag.sentiment import get_sentiment
from rag.forex import detect_forex_query, get_forex_data, get_all_forex_snapshot, CURRENCY_PAIRS
from model.inference import (
    generate_response, generate_portfolio_summary,
    generate_comparison_verdict, generate_forex_insight,
    explain_term
)
import os
import uvicorn

app = FastAPI(title="Quantiq - Python Service")

# ── CORS ────────────────────────────────────────────────
_allowed_origin = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_allowed_origin, "http://localhost:3000", "http://localhost:5173"],
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
    data: str

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
    score: float
    label: str
    headline_count: int
    headlines: list[str]


# ── Health ─────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "Quantiq Python service is running"}


# ── Session ────────────────────────────────────────────

@app.post("/session/new", response_model=SessionResponse)
def new_session():
    session_id = create_session()
    return SessionResponse(session_id=session_id, cleared=False)


@app.delete("/session/{session_id}", response_model=SessionResponse)
def delete_session(session_id: str):
    clear_session(session_id)
    return SessionResponse(session_id=session_id, cleared=True)


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


# ── Sentiment ──────────────────────────────────────────

@app.get("/sentiment/{ticker}", response_model=SentimentResponse)
def sentiment(ticker: str, company: str = ""):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
    result = get_sentiment(ticker_clean, company_name=company)
    return SentimentResponse(**result)


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
            detail="Could not find two tickers to compare. Try: 'compare AAPL vs TSLA'"
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


# ── Helper (internal) ──────────────────────────────────

def get_financial_news_for_forex(pair: str) -> str:
    """Fetch news relevant to a forex pair for LLM context."""
    query = pair.replace("/", " ")
    return get_financial_news(query, time_range="7d")


# ── Entry point ────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)