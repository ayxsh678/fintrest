from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag.retriever import build_context, get_stock_data, get_news_for_ticker
from model.inference import analyze_article_sentiment, calculate_aggregate_sentiment, generate_response
import time

app = FastAPI(title="Finance AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ── Models ─────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    include_sources: bool = True
    session_id: str = ""
    time_range: str = "7d"

class QueryResponse(BaseModel):
    answer: str
    context_used: str
    response_time: float
    sources: list[str]
    session_id: str = ""

# ── Health ─────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "Finance AI is running 🚀"}

# ── Context (called by Go gateway) ────────────────────

@app.post("/context")
async def get_context(req: dict):
    question   = req.get("question", "")
    time_range = req.get("time_range", "7d")
    context    = build_context(question, time_range)
    return {"context": context}

# ── Generate (called by Go gateway) ───────────────────

@app.post("/generate")
async def generate(req: dict):
    question   = req.get("question", "")
    context    = req.get("context", "")
    session_id = req.get("session_id", "")
    answer, session_id = generate_response(question, context, session_id)
    return {"answer": answer, "session_id": session_id}

# ── Ask (direct, legacy) ───────────────────────────────

@app.post("/ask", response_model=QueryResponse)
async def ask_finance(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    start   = time.time()
    context = build_context(req.question, req.time_range)
    answer, session_id = generate_response(req.question, context, req.session_id)

    sources = []
    if "Stock:"    in context: sources.append("Yahoo Finance (real-time)")
    if "News:"     in context: sources.append("NewsAPI (last 7 days)")
    if "Earnings:" in context: sources.append("Alpha Vantage (earnings)")
    if "NSE/BSE"   in context: sources.append("Yahoo Finance (NSE/BSE)")
    if "TakeToday" in context: sources.append("TakeToday (verified)")

    return QueryResponse(
        answer=answer,
        context_used=context if req.include_sources else "",
        response_time=round(time.time() - start, 2),
        sources=sources,
        session_id=session_id or req.session_id
    )

# ── Stock ──────────────────────────────────────────────

@app.get("/stock/{ticker}")
async def get_stock(ticker: str):
    return {"data": get_stock_data(ticker.upper())}

# ── News ───────────────────────────────────────────────

@app.get("/news/{ticker}")
async def get_news(
    ticker:  str,
    days:    int = Query(default=7, ge=1, le=30),
    company: str = Query(default="")
):
    ticker   = ticker.upper()
    articles = get_news_for_ticker(ticker, days=days, company_name=company)
    return {
        "ticker":        ticker,
        "article_count": len(articles),
        "articles":      articles
    }

# ── Sentiment ──────────────────────────────────────────

@app.get("/sentiment/{ticker}")
async def get_sentiment(
    ticker:  str,
    company: str = Query(default="")
):
    ticker   = ticker.upper()
    articles = get_news_for_ticker(ticker, days=7, company_name=company)

    if not articles:
        return {
            "ticker": ticker,
            "sentiment": {
                "score":         None,
                "label":         "Insufficient Data",
                "article_count": 0,
                "summary":       "No recent financial news found for this ticker."
            },
            "articles": []
        }

    scored_articles = []
    for article in articles:
        score_data = analyze_article_sentiment(
            title=article["title"],
            summary=article.get("summary", ""),
            ticker=ticker
        )
        scored_articles.append({**article, **score_data})

    aggregate = calculate_aggregate_sentiment(scored_articles)

    return {
        "ticker":    ticker,
        "sentiment": aggregate,
        "articles":  scored_articles
    }

# ── Session ────────────────────────────────────────────

@app.post("/session/new")
async def new_session():
    import uuid
    return {"session_id": str(uuid.uuid4())}

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    return {"deleted": session_id}

@app.get("/session/{session_id}/history")
async def get_history(session_id: str):
    return {"session_id": session_id, "history": []}

# ── Alerts ─────────────────────────────────────────────

@app.post("/create_alert")
async def create_alert(body: dict):
    return {"status": "created", "alert": body}

@app.post("/get_alerts")
async def get_alerts(body: dict):
    return []

@app.post("/delete_alert")
async def delete_alert(body: dict):
    return {"status": "deleted"}

@app.post("/check_alerts")
async def check_alerts(body: dict):
    return {"triggered": []}

# ── Watchlist Enrich ───────────────────────────────────

@app.post("/watchlist/enrich")
async def enrich_watchlist(body: dict):
    tickers = body.get("tickers", [])
    results = []
    for t in tickers:
        data = get_stock_data(t.upper())
        results.append(data)
    return {"tickers": results}

# ── Portfolio ──────────────────────────────────────────

@app.post("/portfolio")
async def portfolio(body: dict):
    tickers = body.get("tickers", [])
    holdings = []
    for t in tickers:
        data = get_stock_data(t.upper())
        holdings.append(data)
    return {"holdings": holdings}

@app.post("/portfolio/from-chat")
async def portfolio_from_chat(body: dict):
    query      = body.get("query", "")
    session_id = body.get("session_id", "")
    context    = build_context(query)
    answer, _  = generate_response(query, context, session_id)
    return {"answer": answer, "holdings": []}

# ── Compare ────────────────────────────────────────────

@app.post("/compare")
async def compare(body: dict):
    ticker_a = body.get("ticker_a", "").upper()
    ticker_b = body.get("ticker_b", "").upper()
    data_a   = get_stock_data(ticker_a)
    data_b   = get_stock_data(ticker_b)
    return {"ticker_a": data_a, "ticker_b": data_b}

@app.post("/compare/from-chat")
async def compare_from_chat(body: dict):
    query      = body.get("query", "")
    session_id = body.get("session_id", "")
    context    = build_context(query)
    answer, _  = generate_response(query, context, session_id)
    return {"answer": answer}

# ── Forex ──────────────────────────────────────────────

@app.get("/forex/pairs")
async def forex_pairs():
    return {"pairs": ["USD/INR", "EUR/INR", "GBP/INR", "USD/EUR", "USD/JPY"]}

@app.post("/forex")
async def forex(body: dict):
    pair       = body.get("pair", "USD/INR")
    session_id = body.get("session_id", "")
    context    = build_context(f"forex rate for {pair}")
    answer, _  = generate_response(f"What is the current {pair} exchange rate?", context, session_id)
    return {"pair": pair, "answer": answer}

@app.post("/forex/from-chat")
async def forex_from_chat(body: dict):
    query      = body.get("query", "")
    session_id = body.get("session_id", "")
    context    = build_context(query)
    answer, _  = generate_response(query, context, session_id)
    return {"answer": answer}

# ── Explain ────────────────────────────────────────────

@app.post("/explain")
async def explain(body: dict):
    term       = body.get("term", "")
    stock      = body.get("stock", "")
    context    = body.get("context", "")
    session_id = body.get("session_id", "")
    question   = f"Explain '{term}' in the context of {stock} stock. {context}".strip()
    answer, _  = generate_response(question, context, session_id)
    return {"term": term, "explanation": answer}

# ── Chart ──────────────────────────────────────────────

@app.get("/chart/{ticker}")
async def get_chart(
    ticker: str,
    days:   int = Query(default=180, ge=1, le=730)
):
    import yfinance as yf
    ticker = ticker.upper()
    try:
        period = f"{days}d"
        t      = yf.Ticker(ticker)
        hist   = t.history(period=period, interval="1d")

        if hist.empty:
            return {"ticker": ticker, "ok": False, "rows": [], "source": None}

        rows = []
        for date, row in hist.iterrows():
            rows.append({
                "time":   date.strftime("%Y-%m-%d"),
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row["Volume"])
            })

        return {
            "ticker": ticker,
            "ok":     True,
            "rows":   rows,
            "source": "Yahoo Finance"
        }
    except Exception as e:
        print(f"[chart] error for {ticker}: {e}")
        return {"ticker": ticker, "ok": False, "rows": [], "source": None}