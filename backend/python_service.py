from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from rag.retriever import build_context, get_stock_data
from rag.portfolio import build_portfolio_context, extract_tickers_from_query, get_portfolio_data
from rag.memory import create_session, get_history, append_to_history, clear_session
from model.inference import generate_response, generate_portfolio_summary
import os
import uvicorn

app = FastAPI(title="Quantiq - Python Service")


# ── Models ─────────────────────────────────────────────

class ContextRequest(BaseModel):
    question: str
    time_range: str = "7d"

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
    history = get_history(session_id)
    answer = generate_response(req.question, req.context, history=history)
    append_to_history(session_id, req.question, answer)

    return GenerateResponse(answer=answer, session_id=session_id)


# ── Stock ──────────────────────────────────────────────

@app.get("/stock/{ticker}", response_model=StockResponse)
def stock(ticker: str):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
    return StockResponse(ticker=ticker_clean, data=get_stock_data(ticker_clean))


# ── Portfolio ──────────────────────────────────────────

@app.post("/portfolio", response_model=PortfolioResponse)
def analyze_portfolio(req: PortfolioRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="No tickers provided")

    tickers = list(dict.fromkeys(t.upper().strip() for t in req.tickers if t.strip()))

    if len(tickers) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 tickers per portfolio")

    session_id = req.session_id or create_session()
    breakdown = get_portfolio_data(tickers)
    context = build_portfolio_context(tickers)
    summary = generate_portfolio_summary(tickers, context)

    append_to_history(
        session_id,
        f"Analyze portfolio: {', '.join(tickers)}",
        summary
    )

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

    return analyze_portfolio(PortfolioRequest(
        tickers=tickers,
        session_id=req.session_id
    ))


# ── Entry point ────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)