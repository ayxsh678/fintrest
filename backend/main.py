from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from dotenv import load_dotenv

# Load .env before any module that reads os.getenv() at import time
load_dotenv()

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
import re
import logging
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Quantiq - Python Service")

_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

_TICKER_RE = re.compile(r"^[A-Z]{1,5}(\.[A-Z]{1,2})?$")

def validate_ticker(ticker: str) -> str:
    clean = ticker.upper().strip()
    if not _TICKER_RE.match(clean):
        raise HTTPException(status_code=400, detail=f"Invalid ticker symbol: '{ticker}'")
    return clean


class ContextRequest(BaseModel):
    question: str
    time_range: str = "7d"

    @validator("question")
    def question_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Question cannot be blank")
        return v.strip()

class GenerateRequest(BaseModel):
    question: str
    context: str
    session_id: str | None = None

    @validator("question")
    def question_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Question cannot be blank")
        return v.strip()

    @validator("context")
    def context_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Context cannot be blank")
        return v.strip()

class PortfolioRequest(BaseModel):
    tickers: list[str]
    session_id: str | None = None

class PortfolioFromChatRequest(BaseModel):
    query: str
    session_id: str | None = None

    @validator("query")
    def query_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Query cannot be blank")
        return v.strip()

class CompareRequest(BaseModel):
    ticker_a: str
    ticker_b: str
    session_id: str | None = None

class CompareFromChatRequest(BaseModel):
    query: str
    session_id: str | None = None

    @validator("query")
    def query_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Query cannot be blank")
        return v.strip()

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

    @validator("term")
    def term_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Term cannot be blank")
        return v.strip()

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


@app.get("/health")
def health():
    return {"status": "ok", "service": "Quantiq Python Service"}


@app.post("/session/new", response_model=SessionResponse)
def new_session():
    session_id = create_session()
    return SessionResponse(session_id=session_id, cleared=False)


@app.delete("/session/{session_id}", response_model=SessionResponse)
def delete_session(session_id: str):
    clear_session(session_id)
    return SessionResponse(session_id=session_id, cleared=True)


@app.post("/context", response_model=ContextResponse)
def get_context(req: ContextRequest):
    valid_ranges = {"24h", "3d", "7d", "30d", "1y"}
    if req.time_range not in valid_ranges:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time_range. Must be one of: {', '.join(sorted(valid_ranges))}"
        )
    try:
        context = build_context(req.question, req.time_range)
    except Exception as e:
        logger.error("build_context failed: %s", e)
        raise HTTPException(status_code=502, detail="Failed to retrieve market context")

    return ContextResponse(context=context)


@app.post("/generate", response_model=GenerateResponse)
def get_response(req: GenerateRequest):
    session_id = req.session_id or create_session()
    history    = get_history(session_id)

    try:
        answer = generate_response(req.question, req.context, history=history)
    except Exception as e:
        logger.error("generate_response failed: %s", e)
        raise HTTPException(status_code=502, detail="Model inference failed")

    append_to_history(session_id, req.question, answer)
    return GenerateResponse(answer=answer, session_id=session_id)


@app.get("/stock/{ticker}", response_model=StockResponse)
def stock(ticker: str):
    ticker_clean = validate_ticker(ticker)

    try:
        data = get_stock_data(ticker_clean)
    except Exception as e:
        logger.error("get_stock_data failed for %s: %s", ticker_clean, e)
        raise HTTPException(status_code=502, detail=f"Failed to fetch data for {ticker_clean}")

    return StockResponse(ticker=ticker_clean, data=data)


@app.get("/sentiment/{ticker}", response_model=SentimentResponse)
def sentiment(ticker: str, company: str = ""):
    ticker_clean = validate_ticker(ticker)

    try:
        result = get_sentiment(ticker_clean, company_name=company)
    except Exception as e:
        logger.error("get_sentiment failed for %s: %s", ticker_clean, e)
        raise HTTPException(status_code=502, detail=f"Failed to fetch sentiment for {ticker_clean}")

    return SentimentResponse(**result)


@app.post("/portfolio", response_model=PortfolioResponse)
def analyze_portfolio(req: PortfolioRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="No tickers provided")

    tickers = list(dict.fromkeys(validate_ticker(t) for t in req.tickers if t.strip()))
    if len(tickers) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 tickers per portfolio")

    session_id = req.session_id or create_session()

    try:
        breakdown = get_portfolio_data(tickers)
        context   = build_portfolio_context(tickers)
        summary   = generate_portfolio_summary(tickers, context)
    except Exception as e:
        logger.error("Portfolio analysis failed for %s: %s", tickers, e)
        raise HTTPException(status_code=502, detail="Portfolio analysis failed")

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


@app.post("/compare", response_model=CompareResponse)
def compare_stocks(req: CompareRequest):
    ticker_a = validate_ticker(req.ticker_a)
    ticker_b = validate_ticker(req.ticker_b)

    if ticker_a == ticker_b:
        raise HTTPException(status_code=400, detail="Tickers must be different")

    session_id = req.session_id or create_session()

    try:
        data    = get_comparison_data(ticker_a, ticker_b)
        context = build_comparison_context(ticker_a, ticker_b)
        verdict = generate_comparison_verdict(ticker_a, ticker_b, context)
    except Exception as e:
        logger.error("Comparison failed for %s vs %s: %s", ticker_a, ticker_b, e)
        raise HTTPException(status_code=502, detail="Comparison analysis failed")

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
            detail=f"Unsupported pair. Supported: {', '.join(sorted(CURRENCY_PAIRS.keys()))}"
        )

    session_id = req.session_id or create_session()

    try:
        forex_data = get_forex_data(pair)
        news       = get_financial_news(pair.replace("/", " "), time_range="7d")
        insight    = generate_forex_insight(pair, forex_data, news)
    except Exception as e:
        logger.error("Forex analysis failed for %s: %s", pair, e)
        raise HTTPException(status_code=502, detail="Forex analysis failed")

    append_to_history(session_id, f"Forex analysis: {pair}", insight)
    return ForexResponse(pair=pair, data=forex_data, insight=insight, session_id=session_id)


@app.post("/forex/from-chat", response_model=ForexResponse)
def forex_from_chat(req: ForexFromChatRequest):
    pair = detect_forex_query(req.query)
    if not pair or pair == "ALL":
        pair = "USD/INR"
    return get_forex(ForexRequest(pair=pair, session_id=req.session_id))


@app.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    session_id = req.session_id or create_session()

    try:
        explanation = explain_term(
            req.term,
            context=req.context or "",
            stock=req.stock or ""
        )
    except Exception as e:
        logger.error("explain_term failed for '%s': %s", req.term, e)
        raise HTTPException(status_code=502, detail="Explanation generation failed")

    append_to_history(session_id, f"Explain {req.term} for beginner", explanation)
    return ExplainResponse(term=req.term, explanation=explanation, session_id=session_id)


@app.post("/create_alert")
def route_create_alert(req: AlertCreateRequest):
    direction = req.direction.lower()
    if direction not in ("above", "below"):
        raise HTTPException(status_code=400, detail="direction must be 'above' or 'below'")
    if req.threshold <= 0:
        raise HTTPException(status_code=400, detail="threshold must be a positive number")

    ticker_clean = validate_ticker(req.ticker)

    return create_alert(
        session_id=req.session_id,
        ticker=ticker_clean,
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


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)