from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag.retriever import build_context
from model.inference import generate_response
import time

app = FastAPI(title="Finance AI API")

# ── CORS (allow React frontend) ────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict to your domain in production
    allow_methods=["*"],
    allow_headers=["*"]
)

class QueryRequest(BaseModel):
    question: str
    include_sources: bool = True

class QueryResponse(BaseModel):
    answer: str
    context_used: str
    response_time: float
    sources: list[str]

@app.get("/")
def health():
    return {"status": "Finance AI is running 🚀"}

@app.post("/ask", response_model=QueryResponse)
async def ask_finance(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    start = time.time()

    # Step 1: Retrieve real-time context
    context = build_context(req.question)

    # Step 2: Generate grounded response
    answer = generate_response(req.question, context)

    # Step 3: Extract sources used
    sources = []
    if "Stock:" in context:       sources.append("Yahoo Finance (real-time)")
    if "News:" in context:        sources.append("NewsAPI (last 7 days)")
    if "Earnings:" in context:    sources.append("Alpha Vantage (earnings)")

    return QueryResponse(
        answer=answer,
        context_used=context if req.include_sources else "",
        response_time=round(time.time() - start, 2),
        sources=sources
    )

@app.get("/stock/{ticker}")
async def get_stock(ticker: str):
    from rag.retriever import get_stock_data
    return {"data": get_stock_data(ticker.upper())}