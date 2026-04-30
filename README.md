# Fintrest — AI Portfolio Intelligence for Indian Investors

> Your personal AI analyst. Add your portfolio → get risk alerts, earnings briefs, and weekly intelligence reports.

**Live:** https://finance-ai-8qu9.vercel.app  
**Stack:** FastAPI · React · Groq (llama-3.3-70b) · RAG pipeline

---

## The Problem

India has 170M+ demat accounts. Most retail investors have no access to professional research.  
Broker apps show you charts. Fintrest tells you what to do about them.

---

## What Fintrest Does

| Feature | Description |
|---------|-------------|
| **Portfolio Risk Analysis** | Add your holdings with quantity + avg buy price. Get concentration risk flags, sector exposure warnings, and a 3-sentence AI brief. |
| **Earnings Intelligence** | Pre-earnings research note for any stock: next date, EPS consensus, key metrics to watch, post-earnings risk. |
| **Portfolio Autopsy** | Submit your trade history. Get a FIFO P&L breakdown + AI narrative on what worked, what didn't, and why. |
| **AI Q&A** | Ask anything about Indian stocks. Grounded answers in WHAT/WHY/CONTEXT/SIGNAL/AVOID format, sourced from live data. |
| **Sentiment Analysis** | News sentiment score per ticker. Bullish/neutral/bearish with per-article impact scoring. |
| **Price Alerts** | Set above/below price alerts per ticker. Redis-backed, session-scoped. |
| **Stock Comparison** | Side-by-side comparison of two stocks with AI verdict. |
| **Forex Analysis** | Live rates + macro context for major currency pairs including USD/INR. |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ask` | POST | General finance Q&A (RAG + LLM) |
| `/analyze-portfolio` | POST | Portfolio risk analysis with risk flags + AI brief |
| `/earnings-brief/{ticker}` | GET | Pre-earnings intelligence note |
| `/portfolio-autopsy` | POST | Trade history P&L + AI post-mortem |
| `/stock/{ticker}` | GET | Live stock data (price, PE, 52W, rel volume) |
| `/chart/{ticker}` | GET | OHLC candlestick data (multi-source cascade) |
| `/sentiment/{ticker}` | GET | News sentiment score + headlines |
| `/news/{ticker}` | GET | News articles with per-article impact scores |
| `/portfolio` | POST | Quick portfolio analysis (tickers only) |
| `/compare` | POST | Compare two stocks |
| `/forex` | POST | Forex pair analysis |
| `/explain` | POST | Beginner-friendly term explanation (Indian analogies) |
| `/create_alert` | POST | Create price alert |
| `/watchlist/enrich` | POST | Batch price + sentiment for multiple tickers |

---

## Architecture

```
React Frontend (Vercel)
        │
        ▼
FastAPI Backend (Render/Fly)
        │
   ┌────┴────┐
   ▼         ▼
RAG Layer   Inference Layer
  yfinance    Groq LLM
  Finnhub     (llama-3.3-70b)
  NewsAPI     5-retry backoff
  EODHD       per-agent prompts
  CoinGecko
  Alpha Vantage
  Redis (sessions)
```

See [AGENTS.md](./AGENTS.md) for detailed agent documentation.

---

## Running Locally

### Backend

```bash
cd backend
cp ../.env.example .env   # add your API keys
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

**Required env vars:**
```
GROQ_API_KEY=        # Groq API key (free tier available)
NEWS_API_KEY=        # newsapi.org
ALPHA_VANTAGE_KEY=   # alphavantage.co (free tier)
```

**Optional:**
```
FINNHUB_API_KEY=     # Finnhub (better news quality)
REDIS_URL=           # Redis for session memory (defaults to localhost:6379)
ALLOWED_ORIGIN=      # Production frontend URL for CORS
```

### Frontend

```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:8001" > .env.local
npm install
npm start
```

---

## Data Sources

| Source | Used For | Notes |
|--------|----------|-------|
| yfinance | Stock prices, PE, 52W, earnings | Free, no key |
| Finnhub | Financial news (primary) | Free tier: 60 calls/min |
| NewsAPI | News fallback | Free tier: 100 calls/day |
| CoinGecko | Crypto prices + OHLC | Free, no key |
| EODHD | US + NSE OHLC (paid plan) | Falls back to Yahoo |
| Alpha Vantage | NSE quotes fallback | Free tier: 5 calls/min |
| Groq | LLM inference | Free tier: 30 RPM |

---

## Deployment

- **Frontend:** Vercel (auto-deploys from `main` branch)
- **Backend:** Render (Docker, `backend/Dockerfile`)
- **Go service:** `backend/main.go` — handles auth + watchlist persistence

---

## Target User

Self-directed Indian retail investors managing ₹5L–₹50L in equities on NSE/BSE.  
No Bloomberg terminal. No research desk. Fintrest is their analyst.
