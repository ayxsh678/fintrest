from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag.retriever import build_context, get_stock_data
from model.inference import generate_response

app = FastAPI(title="Quantiq - Python Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ContextRequest(BaseModel):
    question: str


class GenerateRequest(BaseModel):
    question: str
    context: str


@app.post("/context")
def get_context(req: ContextRequest):
    context = build_context(req.question)
    return {"context": context}


@app.post("/generate")
def get_response(req: GenerateRequest):
    answer = generate_response(req.question, req.context)
    return {"answer": answer}


@app.get("/stock/{ticker}")
def stock(ticker: str):
    return get_stock_data(ticker.upper())


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)