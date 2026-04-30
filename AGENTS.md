# Fintrest AI Agents

This document describes the AI agents that power Fintrest's portfolio intelligence features.

---

## 1. Portfolio Risk Agent

**Endpoint:** `POST /analyze-portfolio`
**Triggered:** On portfolio submission via the Portfolio tab

**Does:**
- Fetches live price data for each holding concurrently (ThreadPoolExecutor, 10 workers)
- Calculates portfolio weights (current value / total portfolio value)
- Runs concentration risk checks: flags any holding >30% (high severity) or >20% (medium)
- Checks India equity allocation; flags if below 20% of portfolio
- Builds structured context and passes to Groq LLM (llama-3.3-70b) using the Portfolio Risk Manager system prompt

**Output:** `PortfolioAnalysisResponse`
- `total_value_inr` — live total portfolio value in INR
- `holdings_summary` — per-holding: current price, P&L %, weight, cost basis
- `risk_flags` — list of `RiskFlag` objects with severity (high/medium/low), description, and recommended action
- `narrative_brief` — 3–4 sentence AI-generated portfolio intelligence brief
- `response_time` — end-to-end latency in seconds

---

## 2. Earnings Intelligence Agent

**Endpoint:** `GET /earnings-brief/{ticker}`
**Triggered:** On-demand per holding, or pre-earnings (5 days before earnings date)

**Does:**
- Fetches next earnings date, forward EPS estimate, trailing EPS, and forward P/E via yfinance
- Pulls last 30 days of news for the ticker (Finnhub → NewsAPI fallback)
- Passes structured data to Groq LLM using the Earnings Intelligence Analyst system prompt (sell-side research note style)

**Output:**
- `next_earnings_date` — ISO date string
- `eps_estimate` — forward EPS consensus
- `eps_actual` — last reported EPS
- `forward_pe` — forward price-to-earnings ratio
- `brief` — pre-earnings research note (headline, track record, key metrics to watch, risk, consensus, trade setup)

---

## 3. Portfolio Autopsy Agent

**Endpoint:** `POST /portfolio-autopsy`
**Triggered:** On-demand by user submitting trade history

**Does:**
- Accepts a list of buy/sell trades with dates and prices
- Performs FIFO P&L matching: pairs each sell with the earliest available buy lots
- Calculates realized P&L per matched trade (absolute and percentage)
- Identifies biggest winners and losers by percentage return
- Passes trade summary to Groq LLM using the Trade Analyst system prompt

**Output:**
- `total_pnl` — total realized P&L in INR
- `trade_count`, `winners`, `losers` — trade statistics
- `realized_trades` — full list of matched buy/sell pairs with P&L
- `narrative` — honest post-mortem: what worked, what failed, why, and 2–3 actionable lessons

---

## 4. Q&A Agent (existing)

**Endpoint:** `POST /ask`
**Triggered:** On user question in the Chat tab

**Does:**
- Extracts ticker symbols from the question via regex
- Fetches live stock data + recent news for extracted tickers (RAG retrieval)
- Builds a context string from stock data and news headlines
- Passes context + question + conversation history to Groq LLM using the General QA system prompt
- Stores exchange in Redis session (24h TTL, max 10 messages)

**Output:** Structured answer in WHAT/WHY/CONTEXT/SIGNAL/AVOID format, sourced and dated.

---

## System Architecture

```
User Request
     │
     ▼
FastAPI (backend/main.py)
     │
     ├── RAG Layer (rag/)
     │    ├── retriever.py    — yfinance + Finnhub + NewsAPI
     │    ├── portfolio.py    — concurrent portfolio data fetch
     │    ├── india_stocks.py — NSE/BSE specific data
     │    ├── crypto.py       — CoinGecko data
     │    ├── sentiment.py    — news sentiment scoring
     │    └── memory.py       — Redis session management
     │
     └── Inference Layer (model/)
          ├── prompts.py      — per-agent system prompts
          └── inference.py    — Groq API (llama-3.3-70b, 5-retry backoff)
```

## LLM Details

- **Primary model:** `llama-3.3-70b-versatile` (Groq)
- **Fallback model:** `llama-3.1-8b-instant` (Groq, 2 retries)
- **Retry policy:** Exponential backoff, max 5 attempts, handles 429/500/502/503/504
- **Temperature:** 0.2 (factual Q&A), 0.4 (beginner explanations)
- **Context window:** Per-agent prompt + retrieved data + conversation history (max 10 turns)
