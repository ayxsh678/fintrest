from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from rag.retriever import build_context, get_stock_data
from model.inference import generate_response
import os
import uvicorn

app = FastAPI(title="Quantiq - Python Service")

# No CORS middleware — this is an internal service
# only accessible from the Go gateway, not the public internet


# ── Request / Response models ──────────────────────────

class ContextRequest(BaseModel):
    question: str
    time_range: str = "7d"  # 24h, 3d, 7d, 30d, 1y

class GenerateRequest(BaseModel):
    question: str
    context: str

class ContextResponse(BaseModel):
    context: str

class GenerateResponse(BaseModel):
    answer: str

class StockResponse(BaseModel):
    ticker: str
    data: str


# ── Health check ───────────────────────────────────────

@app.get("/")
def health():
    return {"status": "Quantiq Python service is running"}


# ── Context endpoint ───────────────────────────────────

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


# ── Generate endpoint ──────────────────────────────────

@app.post("/generate", response_model=GenerateResponse)
def get_response(req: GenerateRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not req.context.strip():
        raise HTTPException(status_code=400, detail="Context cannot be empty")

    answer = generate_response(req.question, req.context)
    return GenerateResponse(answer=answer)


# ── Stock endpoint ─────────────────────────────────────

@app.get("/stock/{ticker}", response_model=StockResponse)
def stock(ticker: str):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")

    data = get_stock_data(ticker_clean)
    return StockResponse(ticker=ticker_clean, data=data)


# ── Entry point ────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)