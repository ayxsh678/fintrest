# Fintrest — Finance AI: Complete Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Directory Structure](#3-directory-structure)
4. [Technology Stack](#4-technology-stack)
5. [Environment Configuration](#5-environment-configuration)
6. [Backend: Go Gateway](#6-backend-go-gateway)
7. [Backend: Python Service](#7-backend-python-service)
8. [RAG Modules (rag/)](#8-rag-modules-rag)
9. [Model & Inference Layer](#9-model--inference-layer)
10. [Frontend (React)](#10-frontend-react)
11. [Database Schemas](#11-database-schemas)
12. [Session & Memory System](#12-session--memory-system)
13. [External APIs & Services](#13-external-apis--services)
14. [Caching Strategy](#14-caching-strategy)
15. [Authentication & Security](#15-authentication--security)
16. [API Endpoints Reference](#16-api-endpoints-reference)
17. [Data Flows](#17-data-flows)
18. [Deployment](#18-deployment)
19. [Dependencies](#19-dependencies)
20. [Known Limitations & Design Decisions](#20-known-limitations--design-decisions)

---

## 1. Project Overview

**Fintrest** is a full-stack AI-powered financial assistant application that lets users query stocks, cryptocurrencies, and forex in natural language. It provides real-time market data, AI-generated analysis, portfolio tools, sentiment scoring, price alerts, and a personalized watchlist — all in one conversational interface.

### Core Capabilities

| Feature | Description |
|---|---|
| **Conversational AI** | Ask questions in plain English; get AI responses backed by live market data |
| **Multi-Asset Coverage** | US stocks, Indian stocks (NSE/BSE), and 30+ cryptocurrencies |
| **Sentiment Analysis** | AI-scored news sentiment per ticker (0–100 scale, per-article impact) |
| **Portfolio Analysis** | Multi-ticker portfolio breakdown with LLM-generated health summary |
| **Stock Comparison** | Side-by-side comparison of two assets with a verdict |
| **Forex Analysis** | Currency pair rates + AI-driven insight |
| **Price Alerts** | Session-based price threshold monitoring with optional email notifications |
| **Watchlist** | Persistent per-user watchlist with live price/sentiment enrichment |
| **Beginner Mode** | `/explain` endpoint translates financial jargon into plain language |
| **Conversation Memory** | Redis-backed history (last 10 messages, 24-hour TTL) |
| **JWT Authentication** | Secure user accounts backed by PostgreSQL |

---

## 2. Architecture Overview

Fintrest uses a **two-service backend** architecture separated by responsibility:

```
Browser (React)
      │
      ▼
Go Gateway  (port 8000)       ← Auth, CORS, Sessions, Watchlist, DB
      │  proxy
      ▼
Python Service  (port 8001)   ← Data retrieval, LLM inference, RAG
      │
      ├── Redis               ← Conversation memory (session history)
      ├── PostgreSQL          ← Users, watchlist, sessions
      └── External APIs       ← yfinance, CoinGecko, Groq, NewsAPI, etc.
```

**Design rationale:**
- **Go** is responsible for stateful concerns: authentication, JWT tokens, watchlist CRUD, alert polling, and routing. Go's concurrency model makes the background alert poller efficient.
- **Python** handles all compute-intensive work: market data fetching (yfinance/CoinGecko), RAG context assembly, LLM inference (Groq), sentiment scoring, and news analysis.
- This separation keeps each service independently deployable and horizontally scalable.

---

## 3. Directory Structure

```
finance-ai/
├── backend/
│   ├── main.go                  Go HTTP gateway (Gin), port 8000
│   ├── auth.go                  User registration, login, JWT issuance & validation
│   ├── db.go                    PostgreSQL connection + table creation
│   ├── watchlist.go             Watchlist CRUD handlers
│   ├── main.py                  Python FastAPI service, port 8001
│   ├── requirements.txt         Python package dependencies
│   ├── go.mod / go.sum          Go module dependencies
│   ├── Procfile                 Process definition for PaaS hosting
│   ├── Dockerfile               Go service container image
│   ├── Dockerfile.trading       Alternate/trading-specific container
│   ├── .env                     Local environment variables (not committed)
│   ├── rag/
│   │   ├── __init__.py
│   │   ├── retriever.py         Core RAG: ticker parsing, yfinance, context assembly
│   │   ├── memory.py            Redis session memory (create/get/append/clear)
│   │   ├── india_stocks.py      NSE/BSE stock data, company name map, fallbacks
│   │   ├── crypto.py            CoinGecko integration, coin ID resolution, OHLC
│   │   ├── forex.py             Open Exchange Rates integration, pair detection
│   │   ├── sentiment.py         News fetching, Groq-based sentiment & impact scoring
│   │   ├── alerts.py            In-memory price alert store, trigger checking
│   │   ├── portfolio.py         Multi-ticker portfolio fetch, parallel execution
│   │   ├── comparison.py        Two-ticker comparison logic
│   │   ├── eodhd.py             EODHD API client (OHLC + volume fallback)
│   │   ├── india_ohlc.py        Indian stock OHLC cascading fallback chain
│   │   ├── nse_quote.py         Direct NSE quote endpoint client
│   │   ├── alpha_vantage.py     Alpha Vantage fallback client
│   │   ├── watchlist_enrich.py  Bulk ticker data enrichment for watchlist
│   │   └── backtester.py        Stub (backtesting — not yet implemented)
│   └── model/
│       ├── __init__.py
│       └── inference.py         Groq LLM calls with retry/fallback/backoff
├── frontend/
│   ├── package.json             Node.js project metadata & dependencies
│   ├── public/
│   │   ├── index.html           HTML entrypoint
│   │   ├── manifest.json        PWA manifest
│   │   └── favicon.svg          Brand favicon
│   ├── src/
│   │   ├── index.js             ReactDOM render entrypoint
│   │   ├── index.css            Global CSS reset & base styles
│   │   ├── App.js               Main React component (all tabs and state)
│   │   ├── App.css              Component-level styles
│   │   ├── Aperture.jsx         Fintrest brand icon SVG component
│   │   ├── tokens.js            Design tokens (colors, spacing, etc.)
│   │   └── reportWebVitals.js   Performance measurement
│   ├── Dockerfile               Multi-stage build: Node → Nginx
│   ├── nginx.config             Nginx reverse proxy configuration
│   └── vercel.json              Vercel deployment routing config
├── model/                       Root-level model copy (used in legacy main.py)
│   ├── inference.py
│   └── __init__.py
├── main.py                      Legacy Python FastAPI app (root level, Procfile target)
├── crypto.py                    Root-level crypto module (legacy)
├── requirements.txt             Root Python dependencies
├── Dockerfile                   Root container image
├── Procfile                     `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
├── .env.example                 Environment variable template
└── fintrest-*.md / *.svg        Product specs, design references
```

---

## 4. Technology Stack

### Backend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| API Gateway | Go + Gin | 1.21+ | HTTP routing, auth, proxying, alert polling |
| Inference Engine | Python + FastAPI | 3.10+ / 0.115+ | LLM inference, data retrieval, RAG |
| Auth | golang-jwt/jwt | v5 | JWT token issuance & validation |
| Password Hashing | golang.org/x/crypto | latest | bcrypt (cost=10) |
| Database Driver | lib/pq | latest | PostgreSQL for Go |
| HTTP Framework | fastapi + uvicorn | latest | Async Python API server |
| LLM SDK | groq | latest | Groq API client |
| Stock Data | yfinance | ≥0.2.54 | US and Indian market data |
| Caching | cachetools | latest | In-process TTL caches (Python) |
| Session Store | redis | latest | Redis client for session history |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI component library |
| Axios | 1.14.0 | HTTP client for API calls |
| Recharts | 3.8.1 | Line and area charts |
| Lightweight-charts | 4.2.3 | OHLC candlestick charts |
| Lucide-react | 1.7.0 | Icon library |
| Nginx | 1.25.5 | Static file serving (production) |

### Infrastructure

| Component | Technology |
|---|---|
| Primary DB | PostgreSQL 12+ |
| Session Cache | Redis 6+ |
| Containerization | Docker (multi-stage builds) |
| Frontend Hosting | Vercel (vercel.json) |
| Backend Hosting | Render / Heroku (Procfile) |

---

## 5. Environment Configuration

All environment variables live in `.env` (backend) and `.env.local` (frontend). A complete template is in `.env.example`.

### Go Gateway Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens. App refuses to start if missing. |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgres://user:pass@host:5432/dbname`) |
| `PORT` | No | HTTP listen port (default: 8000) |
| `PYTHON_SERVICE_URL` | No | URL of Python service (default: `http://localhost:8001`) |
| `ALLOWED_ORIGIN` | No | Production frontend URL for CORS |
| `SMTP_USER` | No | Gmail/SMTP username for email alerts |
| `SMTP_PASS` | No | SMTP password or app password |
| `ALERT_EMAIL` | No | Address that receives triggered alert emails |

### Python Service Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for LLM inference |
| `NEWS_API_KEY` | No | NewsAPI.org key (fallback news source) |
| `FINNHUB_API_KEY` | No | Finnhub key (primary news source) |
| `OPEN_EXCHANGE_RATES_KEY` | No | Open Exchange Rates key for forex |
| `EODHD_API_KEY` | No | EODHD key for OHLC fallback data |
| `ALPHA_VANTAGE_KEY` | No | Alpha Vantage fallback key |
| `REDIS_URL` | No | Redis connection string (default: `redis://localhost:6379`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

### Frontend Variables

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_API_URL` | Yes | Base URL of the Go gateway |

---

## 6. Backend: Go Gateway

**File:** [backend/main.go](backend/main.go)

The Go gateway is the sole public-facing entry point. It handles:

- **Authentication** (register, login, JWT middleware)
- **CORS policy** enforcement
- **HTTP proxying** — forwards most requests to the Python service
- **Session tracking** — maintains an in-memory `activeSessions` map with 24-hour TTL
- **Alert polling** — background goroutine runs every 5 minutes to check price alerts
- **Watchlist persistence** — PostgreSQL-backed CRUD via [backend/watchlist.go](backend/watchlist.go)

### CORS Policy

Origins allowed:

- `http://localhost:3000` (React dev)
- `http://localhost:5173` (Vite dev)
- `https://*-ayxsh678s-projects.vercel.app` (Vercel preview deployments)
- Value of `ALLOWED_ORIGIN` env var (production)

### Session Tracking

Active sessions are stored in `activeSessions map[string]*SessionInfo`:

```go
type SessionInfo struct {
    ID       string
    LastSeen time.Time
    UserID   int    // optional, if authenticated
}
```

Sessions expire after 24 hours of inactivity. The alert poller only checks active sessions, preventing wasted API calls for abandoned sessions.

### Alert Polling (Background Goroutine)

Runs every 5 minutes in a goroutine started at server init. For each active session:

1. Calls Python `POST /check_alerts` with the session ID
2. Receives list of triggered alerts
3. Sends email via SMTP (if configured) for each trigger
4. Logs the alert if SMTP is unconfigured

### Authentication (`auth.go`)

- **`POST /register`** — validates email uniqueness, hashes password with bcrypt (cost=10), inserts into `users` table, returns 201.
- **`POST /login`** — fetches user by email, uses a dummy hash to prevent timing attacks for missing users, compares bcrypt hashes, issues a 7-day JWT on success.
- **`AuthMiddleware()`** — extracts `Authorization: Bearer <token>`, validates HMAC signature (prevents `alg:none` attacks), injects `user_id` and `email` into Gin context.
- **`generateToken()`** — signs JWT with HS256, 7-day expiry.

### Database (`db.go`)

- **`InitDB()`** — opens PostgreSQL connection, sets pool parameters (25 max open, 5 idle, 5-min lifetime), runs `createTables()`.
- **`createTables()`** — idempotently creates `users` and `watchlist` tables.
- Pool config prevents connection exhaustion under load.

### Watchlist (`watchlist.go`)

- **`handleGetWatchlist()`** — `SELECT ticker FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC`
- **`handleAddWatchlist()`** — `INSERT ... ON CONFLICT DO NOTHING` prevents duplicates
- **`handleDeleteWatchlist()`** — deletes specific ticker for authenticated user
- Ticker validation regex: `^[A-Za-z0-9._:\-]{1,20}$`

---

## 7. Backend: Python Service

**File:** [backend/main.py](backend/main.py)

The Python service runs on port 8001 and is not publicly exposed. It handles all compute-heavy work:

- RAG context assembly
- LLM inference via Groq
- Market data fetching with cascading fallbacks
- Sentiment analysis
- Portfolio and comparison analysis
- Forex data and insights
- Session memory via Redis
- In-memory price alert management

FastAPI provides async HTTP handling; uvicorn serves it. CORS is configured to only allow requests from the Go gateway and localhost.

---

## 8. RAG Modules (`rag/`)

### `retriever.py` — Core RAG Engine

The central module for converting a natural language question into structured market data context.

**Key functions:**

| Function | Description |
|---|---|
| `build_context(question, time_range)` | Top-level: extracts tickers from question, fetches data, assembles context string |
| `get_stock_data(ticker)` | yfinance wrapper; returns price, PE, market cap, 52W high/low, earnings dates |
| `get_news_for_ticker(ticker, days, company_name)` | Fetches from Finnhub (primary) → NewsAPI (fallback); applies financial signal filter |
| `get_earnings_data(ticker)` | Upcoming and recent earnings via yfinance calendar |
| `detect_asset_type(ticker)` | Returns `'india'`, `'crypto'`, or `'us'` based on ticker format |

**Context assembly logic:**
1. Regex-extract ticker symbols from question
2. Detect asset type per ticker
3. Dispatch to appropriate data module (india_stocks, crypto, retriever)
4. Assemble a formatted multi-section string
5. Append news if news-related keywords appear in question

**COMPANY_MAP & KNOWN_TICKERS** — lookup tables mapping company names and common aliases to ticker symbols used during context extraction.

**Financial signal filtering** — articles are kept only if they contain financial keywords (earnings, revenue, analyst, dividend, merger, etc.) and do not match noise patterns (product reviews, travel guides, etc.).

---

### `memory.py` — Redis Session Memory

Manages conversation history per session ID.

| Function | Description |
|---|---|
| `create_session()` | Generates a UUID string |
| `get_history(session_id)` | Fetches list of `{role, content}` dicts from Redis |
| `append_to_history(session_id, q, a)` | Appends user+assistant messages, trims to 10, resets 24h TTL |
| `clear_session(session_id)` | Deletes the Redis key |

**Graceful degradation** — all functions catch `RedisError` and return safe defaults (empty list) if Redis is unavailable.

---

### `india_stocks.py` — NSE/BSE Data

Handles Indian stock market data with a multi-level fallback chain.

**INDIA_COMPANY_MAP** — 60+ company-to-ticker mappings (e.g., `"reliance" → "RELIANCE.NS"`, `"tcs" → "TCS.NS"`).

| Function | Description |
|---|---|
| `get_india_stock_data(ticker, as_dict)` | Primary fetch via yfinance; returns structured data dict |
| `extract_india_ticker(query)` | Parses company names from natural language using word-boundary regex |

**Fallback chain for Indian stocks:**
```
yfinance (.NS/.BO) → EODHD → NSE direct endpoint → Alpha Vantage
```

Data returned includes: price, change%, PE ratio, market cap, 52W high/low, relative volume, dividend yield.

---

### `crypto.py` — Cryptocurrency Data

Integrates with CoinGecko (free tier) for real-time and historical crypto data.

**COIN_MAP** — 30+ mappings of names/symbols to CoinGecko IDs (e.g., `"btc" → "bitcoin"`, `"sol" → "solana"`).

| Function | Description |
|---|---|
| `get_coin_id(query)` | Resolves name or symbol to CoinGecko ID |
| `get_crypto_data(coin_id)` | Current price (USD + INR), 24h/7d change, market cap, rank, volume |
| `get_crypto_ohlc(coin_id, days)` | Daily OHLC bars via CoinGecko `/coins/{id}/ohlc` |

**Caches:** `crypto_cache` (2-min TTL), `ohlc_cache` (10-min TTL), both capped at 100 entries.

---

### `forex.py` — Currency Pairs

Integrates with Open Exchange Rates for live FX rates.

**CURRENCY_PAIRS** — 10 supported pairs: USD/INR, EUR/USD, GBP/USD, USD/JPY, USD/AUD, EUR/GBP, EUR/INR, GBP/INR, USD/CAD, USD/SGD.

| Function | Description |
|---|---|
| `detect_forex_query(query)` | Parses natural language to identify a currency pair |
| `get_forex_data(pair)` | Current rate + recent history from Open Exchange Rates |

**Cache:** `forex_cache` (5-min TTL), `forex_hist_cache` (1-hour TTL).

---

### `sentiment.py` — News Sentiment Analysis

Combines news fetching with Groq LLM scoring to produce sentiment signals.

**Sentiment scale (0–100):**

| Range | Label | Color |
|---|---|---|
| 0–38 | Bearish | Red |
| 40–62 | Neutral | Yellow |
| 62–100 | Bullish | Green |

**Impact score per article (1–10):**

| Score | Meaning |
|---|---|
| 9–10 | Major positive (blockbuster beat, huge deal) |
| 7–8 | Positive (earnings beat, analyst upgrade) |
| 5–6 | Neutral (product launch, industry news) |
| 3–4 | Soft negative (guidance cut, cost pressure) |
| 1–2 | Major negative (earnings miss, fraud) |

| Function | Description |
|---|---|
| `get_sentiment(ticker, company_name)` | Fetch headlines → Groq aggregate scoring → `{score, label, headline_count, headlines}` |
| `get_news_impact(ticker, company_name, days)` | Per-article impact scores with detailed analysis |
| `_score_with_groq(ticker, headlines)` | Sends headlines to Groq with calibration examples |
| `_analyze_impact_with_groq(...)` | Returns structured impact analysis per article |

**Caches:** `_cache` (30-min TTL, 200 entries), `_impact_cache` (30-min TTL, 200 entries).

**Word-boundary matching** — prevents false positives like `"reliance on data"` matching Reliance Industries.

---

### `alerts.py` — Price Alerts

In-memory alert storage (not persisted across server restarts).

**Alert structure:**
```python
{
    "id": str,           # UUID
    "ticker": str,
    "threshold": float,
    "direction": str,    # "above" or "below"
    "triggered": bool,
    "created_at": float  # Unix timestamp
}
```

| Function | Description |
|---|---|
| `create_alert(session_id, ticker, threshold, direction)` | Stores alert keyed by session ID |
| `check_alerts(session_id)` | Fetches latest price via yfinance `fast_info["last_price"]`, returns triggered alerts |
| `get_alerts(session_id)` | Lists all alerts for a session |
| `delete_alert(session_id, alert_id)` | Removes a specific alert |

**Limitation:** Alerts are lost on Python service restart (in-memory only, not Redis/PostgreSQL).

---

### `portfolio.py` — Portfolio Analysis

Multi-ticker portfolio analysis with parallel data fetching.

| Function | Description |
|---|---|
| `extract_tickers_from_query(query)` | Parses natural language for ticker symbols (checks crypto → India → US) |
| `get_portfolio_data(tickers)` | Fetches data for up to 20 tickers using `ThreadPoolExecutor(max_workers=10)` |
| `build_portfolio_context(tickers)` | Assembles formatted context string for LLM |

**Returns:** `{tickers, breakdown (per-ticker dict), summary (LLM text), session_id}`

One failed ticker does not crash the others — errors are caught per future and logged.

---

### `comparison.py` — Stock Comparison

Two-ticker side-by-side comparison.

| Function | Description |
|---|---|
| `extract_comparison_tickers(query)` | Extracts exactly two tickers from natural language |
| `get_comparison_data(ticker_a, ticker_b)` | Fetches both in parallel using `ThreadPoolExecutor(max_workers=2)` |
| `build_comparison_context(...)` | Formats both tickers' data into a single context string |

**Returns:** `{ticker_a, ticker_b, data_a, data_b, verdict (LLM text), session_id}`

---

### `eodhd.py` — EODHD Fallback

Provides OHLC historical data and average volume when primary sources fail.

**Caches:** `_vol_cache` (4-hour TTL), `_ohlc_cache` (30-min TTL).

---

### `india_ohlc.py` — Indian Stock OHLC

Cascading fallback chain specifically for Indian stock OHLC data:

```
CoinGecko (if crypto) → EODHD → Yahoo Finance v8 API → NSE direct endpoint → Stooq → yfinance download
```

Each step is tried in order; logs a warning on failure and proceeds to next.

---

### `alpha_vantage.py` — Alpha Vantage Fallback

Last-resort fallback for US stock data (5 req/min on free tier).

---

### `watchlist_enrich.py` — Bulk Watchlist Data

Accepts a list of ticker symbols and returns enriched data (price, change%, sentiment) for all of them. Used by the frontend to populate the watchlist view with live data.

---

## 9. Model & Inference Layer

**File:** [backend/model/inference.py](backend/model/inference.py)

All LLM calls go through this module. It uses Groq's API with `llama-3.3-70b-versatile` as the primary model and `llama-3.1-8b-instant` as the fallback.

### Models

| Model | Role | Retries |
|---|---|---|
| `llama-3.3-70b-versatile` | Primary (highest quality) | 5 |
| `llama-3.1-8b-instant` | Fallback (faster, lower cost) | 2 |

### Retry & Backoff Logic

```
Attempt 1 → wait 1s
Attempt 2 → wait 2s
Attempt 3 → wait 4s
Attempt 4 → wait 8s
Attempt 5 → wait 15s (+jitter)
```

- Respects `Retry-After` header on 429 responses
- On primary model exhaustion → switches to fallback model
- Returns user-friendly rate-limit messages instead of crashing

### Inference Functions

| Function | Purpose |
|---|---|
| `generate_response(question, context, history)` | General financial Q&A with conversation history |
| `generate_portfolio_summary(tickers, context)` | Portfolio health summary with sector/risk analysis |
| `generate_comparison_verdict(ticker_a, ticker_b, context)` | Side-by-side comparison with investor profile targeting |
| `generate_forex_insight(pair, forex_data, news)` | Currency pair analysis with macro drivers |
| `explain_term(term, context, stock)` | Beginner-friendly definition with real-world examples |

### System Prompt

The LLM is prompted as a **professional financial analyst** with instructions to:
- Use the provided context data rather than hallucinating numbers
- Cite the data source (e.g., "According to the market data...")
- Present balanced risk/reward perspectives
- Avoid investment advice disclaimers mid-response (kept concise)
- Format responses with markdown where useful

---

## 10. Frontend (React)

**File:** [frontend/src/App.js](frontend/src/App.js)

Single-page React application with a multi-tab layout.

### Tabs

| Tab | Content |
|---|---|
| **Market** | Watchlist overview, selected stock card, OHLC chart, sentiment gauge |
| **Chat** | Conversational AI interface with session history |
| **Watchlist** | Full watchlist table with real-time prices, change%, sentiment bars |
| **More** | Compare, Portfolio, Alerts sub-sections |

### State Management

Key state variables managed with `useState`:

| State | Type | Purpose |
|---|---|---|
| `messages` | Array | Chat history (user + assistant messages) |
| `sessionId` | String | Current conversation session UUID |
| `watchlist` | Array | User's tickers with enriched price data |
| `selectedTicker` | String | Ticker currently viewed in Market tab |
| `chartData` | Array | OHLC bars for the lightweight-charts component |
| `sentimentData` | Object | Sentiment score + headlines for selected ticker |
| `portfolioData` | Object | Portfolio analysis result |
| `comparisonData` | Object | Comparison result for two tickers |
| `authToken` | String | JWT token from localStorage |
| `user` | Object | Logged-in user profile |

### Authentication Flow

1. On load: read `fintrest_token` and `fintrest_user` from `localStorage`
2. Login/Register: POST to Go gateway → receive JWT → store in localStorage
3. Protected API calls: include `Authorization: Bearer <token>` header
4. Logout: clear localStorage keys, reset state

### Chart Components

- **Recharts** `<AreaChart>` — used for portfolio value visualization and line charts
- **Lightweight-charts** `createChart()` — used for OHLC candlestick charts; self-hosted (no TradingView embed)

### Sentiment Gauge UI

The sentiment score (0–100) is rendered as:
- A color gradient arc (red → yellow → green)
- A numeric score
- A label: "Bearish" / "Neutral" / "Bullish"
- A scrollable list of recent headlines with per-article impact scores

### Mobile Layout

A 4-tab bottom navigation bar is shown on small screens (CSS media queries):
- Market | Chat | Watchlist | More

### Brand Component (`Aperture.jsx`)

SVG aperture/shutter icon for the Fintrest brand.

| Prop | Options | Default |
|---|---|---|
| `variant` | `solid`, `outline`, `glyph` | `solid` |
| `size` | Number (pixels) | `32` |
| `color` | CSS color string | Brand default |
| `background` | CSS color string | Transparent |
| `strokeWidth` | Number | `2` |

---

## 11. Database Schemas

### `users` table

```sql
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,           -- bcrypt hash
    created_at TIMESTAMP DEFAULT NOW()
);
```

### `watchlist` table

```sql
CREATE TABLE IF NOT EXISTS watchlist (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ticker   TEXT NOT NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);
```

**Connection pool config:**
- Max open connections: 25
- Max idle connections: 5
- Max connection lifetime: 5 minutes

---

## 12. Session & Memory System

### Session Lifecycle

1. **Create** — `POST /session/new` generates a UUID; Go tracks it in `activeSessions`; Python creates Redis key
2. **Use** — each `/ask` call reads history from Redis, appends new messages after response
3. **Expire** — Redis TTL: 24 hours (reset on each write); Go session expires after 24h of inactivity
4. **Delete** — `DELETE /session/:id` removes Redis key and Go session entry

### Redis Key Structure

```
Key:   session:{uuid}
Value: JSON array of {role: "user"|"assistant", content: "..."}
TTL:   86400 seconds (24 hours, reset on each append)
```

### History Limits

- Maximum stored: **10 messages** (5 user + 5 assistant)
- When limit exceeded: oldest 2 messages (1 exchange) are dropped before append
- Ensures the LLM context window is never overloaded with history

### Graceful Degradation

All Redis operations are wrapped in try/except blocks. If Redis is down:
- `get_history()` returns `[]` (no history — fresh conversation)
- `append_to_history()` silently skips (response is still returned)
- No crash, no error exposed to user

---

## 13. External APIs & Services

### Market Data

| Service | Purpose | URL | Rate Limit | Fallback |
|---|---|---|---|---|
| **yfinance** | US stocks, India stocks, crypto history | Python library | Unofficial; best-effort | EODHD, Alpha Vantage |
| **CoinGecko** | Crypto prices, OHLC, market data | `api.coingecko.com` | Free: 10–50 req/min | None |
| **EODHD** | OHLC data, NSE/BSE fallback | `eodhd.com/api` | Free: 20 calls/day | Stooq, yfinance |
| **Alpha Vantage** | US stock fallback | `alphavantage.co` | Free: 5 req/min | yfinance |
| **NSE Direct** | Indian stock quotes | `nseindia.com` (unofficial) | Unofficial | EODHD |
| **Stooq** | Indian/EM stock data | `stooq.com` | Unofficial | yfinance |

### News

| Service | Purpose | Priority | API Key Required |
|---|---|---|---|
| **Finnhub** | Company-specific financial news | Primary | Yes (optional) |
| **NewsAPI** | General news headlines | Fallback | Yes |

### AI / LLM

| Service | Purpose | Models Used |
|---|---|---|
| **Groq** | LLM inference (all AI responses) | `llama-3.3-70b-versatile` (primary), `llama-3.1-8b-instant` (fallback) |

### Forex

| Service | Purpose | API Key |
|---|---|---|
| **Open Exchange Rates** | Live FX rates | Required (demo key used if missing) |

---

## 14. Caching Strategy

### Python In-Process Caches (cachetools TTLCache)

| Module | Cache Variable | TTL | Max Size | What's Cached |
|---|---|---|---|---|
| `india_stocks.py` | `india_cache` | 5 min | 100 | NSE/BSE stock data dicts |
| `crypto.py` | `crypto_cache` | 2 min | 100 | Crypto price snapshots |
| `crypto.py` | `ohlc_cache` | 10 min | 100 | Crypto OHLC bar series |
| `sentiment.py` | `_cache` | 30 min | 200 | Aggregate sentiment scores |
| `sentiment.py` | `_impact_cache` | 30 min | 200 | Per-article impact scores |
| `eodhd.py` | `_vol_cache` | 4 hours | 200 | Average volume data |
| `eodhd.py` | `_ohlc_cache` | 30 min | 200 | OHLC series from EODHD |
| `forex.py` | `forex_cache` | 5 min | 50 | Current FX rates |
| `forex.py` | `forex_hist_cache` | 1 hour | 50 | Historical FX rate series |

### Redis (Session Memory)

- Per-session conversation history
- 24-hour TTL, reset on each write
- Max 10 messages stored

### No Frontend Caching

The React frontend does not implement local caching — all requests hit the Go gateway fresh. Chart data and sentiment scores are fetched on ticker selection.

---

## 15. Authentication & Security

### JWT Tokens

- Algorithm: **HS256** (explicit validation prevents `alg:none` attacks)
- Expiry: **7 days**
- Claims: `user_id` (int), `email` (string), `exp`, `iat`
- Header: `Authorization: Bearer <token>`

### Password Hashing

- Algorithm: **bcrypt** with cost factor 10 (~100ms per hash on modern hardware)
- Timing-safe login: dummy hash computed for missing users to prevent timing-based email enumeration

### CORS

- Whitelisted origins only (no wildcard `*` in production)
- Allows credentials for auth headers
- Vercel preview URL pattern matched dynamically

### Input Validation

- Ticker symbols validated with regex `^[A-Za-z0-9._:\-]{1,20}$` before DB writes
- Pydantic models validate all Python service request bodies
- Gin binds and validates request bodies in Go handlers

### Email Safety in Logs

The `redactEmail()` helper in Go logs emails as `a...@example.com` format, preventing accidental credential exposure in log output.

### Python Service Isolation

The Python service (port 8001) is not publicly exposed — only the Go gateway (port 8000) is. The CORS config on Python allows only Go's origin.

---

## 16. API Endpoints Reference

### Go Gateway (Port 8000)

#### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/register` | Create account (`{email, password}`) |
| `POST` | `/login` | Authenticate (`{email, password}`) → `{token}` |

#### Chat & AI

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/ask` | No | Ask financial question `{question, session_id, time_range}` |
| `POST` | `/explain` | No | Explain financial term `{term, stock}` |
| `POST` | `/portfolio` | No | Analyze portfolio `{tickers[]}` |
| `POST` | `/portfolio/from-chat` | No | Extract tickers from query `{question}` → analyze |
| `POST` | `/compare` | No | Compare two tickers `{ticker_a, ticker_b}` |
| `POST` | `/compare/from-chat` | No | Extract pair from query `{question}` → compare |
| `POST` | `/forex` | No | Analyze FX pair `{pair}` |
| `POST` | `/forex/from-chat` | No | Detect pair from query `{question}` → analyze |

#### Market Data

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/stock/:ticker` | No | Stock data (price, PE, market cap, etc.) |
| `GET` | `/chart/:ticker` | No | OHLC candlestick data (`?days=180`) |
| `GET` | `/sentiment/:ticker` | No | Sentiment score + headlines (`?company=Name`) |
| `GET` | `/news/:ticker` | No | News articles (`?days=7&company=Name`) |
| `GET` | `/forex/pairs` | No | List of supported currency pairs |

#### Session Management

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/session/new` | No | Create new session → `{session_id}` |
| `DELETE` | `/session/:id` | No | Delete session and history |
| `GET` | `/session/:id/history` | No | Get conversation history |

#### Watchlist (JWT Required)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/watchlist` | Yes | Get user's watchlist |
| `POST` | `/watchlist` | Yes | Add ticker `{ticker}` |
| `DELETE` | `/watchlist/:ticker` | Yes | Remove ticker |
| `POST` | `/watchlist/enrich` | No | Bulk-enrich ticker list `{tickers[]}` |

#### Alerts

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/create_alert` | No | Create alert `{session_id, ticker, threshold, direction}` |
| `POST` | `/get_alerts` | No | Get alerts for session `{session_id}` |
| `POST` | `/delete_alert` | No | Delete alert `{session_id, alert_id}` |
| `POST` | `/check_alerts` | No | Check if any alerts triggered (used by poller) |

---

### Python Service (Port 8001, Internal Only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/context` | Build RAG context from question |
| `POST` | `/generate` | Generate LLM response given context |
| `POST` | `/ask` | One-shot context + generate |
| `GET` | `/stock/:ticker` | Stock data dict |
| `GET` | `/chart/:ticker` | OHLC rows (`?days=180`) |
| `GET` | `/sentiment/:ticker` | Sentiment score + headlines |
| `GET` | `/news/:ticker` | News articles (`?days=7`) |
| `POST` | `/portfolio` | Portfolio analysis |
| `POST` | `/portfolio/from-chat` | NLP ticker extraction + analysis |
| `POST` | `/compare` | Two-ticker comparison |
| `POST` | `/compare/from-chat` | NLP pair extraction + comparison |
| `GET` | `/forex/pairs` | Supported FX pairs |
| `POST` | `/forex` | FX pair analysis |
| `POST` | `/forex/from-chat` | NLP pair detection + analysis |
| `POST` | `/explain` | Beginner financial explanation |
| `POST` | `/create_alert` | Create in-memory price alert |
| `POST` | `/get_alerts` | List alerts for session |
| `POST` | `/delete_alert` | Delete alert |
| `POST` | `/check_alerts` | Check alert triggers |
| `POST` | `/session/new` | Create Redis session |
| `DELETE` | `/session/:id` | Clear session from Redis |
| `GET` | `/session/:id/history` | Get session history |
| `POST` | `/watchlist/enrich` | Bulk-fetch ticker data |

---

## 17. Data Flows

### Chat Query → AI Response

```
1. User types question in React chat UI
2. React → POST /ask to Go gateway (question, session_id)
3. Go → POST /context to Python (question)
4. Python retriever.py:
   a. Regex-extract ticker symbols from question
   b. detect_asset_type() per ticker
   c. Dispatch:
      - Crypto  → crypto.py → CoinGecko
      - India   → india_stocks.py → yfinance → EODHD → NSE → Alpha Vantage
      - US      → retriever.py → yfinance → Alpha Vantage
   d. Fetch news if question contains news keywords
   e. Assemble formatted context string
5. Go → POST /generate to Python (question, context, session_id)
6. Python:
   a. memory.py.get_history(session_id) → Redis
   b. model/inference.py.generate_response(question, context, history)
   c. Groq API call (llama-3.3-70b-versatile, up to 5 retries)
   d. memory.py.append_to_history(session_id, question, answer)
7. Answer returned → Go gateway → React UI
8. React renders response in chat
```

### Sentiment Analysis

```
1. User selects ticker or views watchlist
2. React → GET /sentiment/:ticker?company=Name
3. Go → GET /sentiment/:ticker to Python
4. Python sentiment.py:
   a. Fetch headlines: Finnhub → NewsAPI (fallback)
   b. Apply financial signal filter (keep finance-relevant articles)
   c. Word-boundary company name filter
   d. _score_with_groq(): send headlines to Groq with calibration examples
   e. Groq returns score (0-100) + label (Bearish/Neutral/Bullish)
5. Return {score, label, headline_count, headlines}
6. React renders sentiment gauge + headline list
```

### Portfolio Analysis

```
1. User provides tickers (list or natural language query)
2. React → POST /portfolio (or /portfolio/from-chat)
3. Go → POST /portfolio to Python
4. Python portfolio.py:
   a. extract_tickers_from_query() if from-chat
   b. get_portfolio_data(tickers):
      - ThreadPoolExecutor(max_workers=10)
      - Detect type per ticker, dispatch to module
      - Collect results; log failures but continue
   c. build_portfolio_context() → formatted string
   d. model/inference.py.generate_portfolio_summary()
5. Return {tickers, breakdown {per-ticker data}, summary (LLM), session_id}
6. React renders breakdown table + AI summary
```

### Price Alert Check (Background)

```
Every 5 minutes (Go background goroutine):
  For each entry in activeSessions (not expired):
    1. POST /check_alerts to Python {session_id}
    2. Python alerts.py:
       a. Fetch alerts for session
       b. For each untriggered alert:
          - yfinance fast_info["last_price"] for ticker
          - Check: price >= threshold (if "above") or price <= threshold (if "below")
          - Mark triggered if condition met
       c. Return list of newly triggered alerts
    3. Go: for each triggered alert:
       - SMTP send email (if configured)
       - Log if SMTP not configured
```

### OHLC Chart Data

```
1. User selects ticker; React → GET /chart/:ticker?days=180
2. Go → GET /chart/:ticker to Python
3. Python india_ohlc.py (cascading):
   a. If crypto ticker → CoinGecko OHLC
   b. Else try EODHD
   c. Else try Yahoo Finance v8 API (direct)
   d. Else try NSE direct endpoint
   e. Else try Stooq
   f. Else try yfinance download
4. Return array of {time, open, high, low, close, volume}
5. React lightweight-charts renders candlestick chart
```

---

## 18. Deployment

### Local Development

```bash
# Go gateway
cd backend
go build -o fintrest
export JWT_SECRET="dev-secret-minimum-32-chars-long"
export DATABASE_URL="postgres://user:pass@localhost:5432/fintrest"
export PYTHON_SERVICE_URL="http://localhost:8001"
./fintrest

# Python service (separate terminal)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export GROQ_API_KEY="..."
python main.py

# Frontend (separate terminal)
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 npm start
```

### Production (PaaS — Render / Railway)

**Procfile (root):**
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```
This starts the legacy Python service directly (suitable for single-service hosting without the Go gateway layer).

### Docker (Full Stack)

**Backend Dockerfile:**
```dockerfile
FROM golang:1.21-alpine
WORKDIR /app
COPY backend/ .
RUN go build -o fintrest
EXPOSE 8000
CMD ["./fintrest"]
```

**Frontend Dockerfile (multi-stage):**
```dockerfile
FROM node:20.14.0-alpine AS builder
WORKDIR /app
COPY frontend/ .
RUN npm ci && npm run build

FROM nginx:1.25.5-alpine AS runtime
COPY --from=builder /app/build /usr/share/nginx/html
COPY frontend/nginx.config /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080
HEALTHCHECK CMD wget -q -O- http://localhost:8080/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

**Security hardening in production container:**
- Non-root `nginx` user
- Explicit port 8080 (not 80 which requires root)
- Healthcheck via wget
- Final image ~25 MB (no Node.js runtime)

### Vercel (Frontend)

`vercel.json` handles SPA routing (all paths → `index.html`) and sets `REACT_APP_API_URL` to the Go gateway URL.

---

## 19. Dependencies

### Python (`backend/requirements.txt`)

```
fastapi         # Async HTTP framework
uvicorn         # ASGI server
python-dotenv   # Load .env files
requests        # HTTP client for external APIs
yfinance>=0.2.54 # Yahoo Finance data (unofficial)
feedparser      # RSS/news feed parsing
cachetools      # TTLCache for in-process caching
redis           # Redis client for session memory
groq            # Groq LLM SDK
```

### Go (`backend/go.mod`)

```
github.com/gin-gonic/gin        # HTTP web framework
github.com/golang-jwt/jwt/v5    # JWT auth
golang.org/x/crypto             # bcrypt password hashing
github.com/lib/pq               # PostgreSQL driver
```

### Node.js (`frontend/package.json`)

```json
"react": "^18.0.0",
"react-dom": "^18.0.0",
"axios": "^1.14.0",
"recharts": "^3.8.1",
"lightweight-charts": "^4.2.3",
"lucide-react": "^1.7.0"
```

---

## 20. Known Limitations & Design Decisions

### Alerts Not Persisted

Price alerts are stored in Python's in-memory dict (keyed by session ID). A Python service restart clears all alerts. For production reliability, alerts should be stored in Redis or PostgreSQL.

### yfinance Is Unofficial

yfinance scrapes Yahoo Finance data and is not officially supported. Rate limits and data availability can change without notice. The cascading fallback chain (EODHD → Alpha Vantage → NSE) mitigates this risk.

### Free API Tiers

Several APIs used have tight free-tier limits:
- EODHD: 20 calls/day
- Alpha Vantage: 5 calls/minute
- CoinGecko: 10–50 req/min
- NewsAPI: 100 req/day

In production, these limits can be hit quickly. The caching layer reduces redundant calls significantly.

### Groq Rate Limits

Groq's free tier has per-model rate limits. The retry/backoff/fallback system handles 429 errors gracefully, but sustained high traffic will degrade response latency.

### Session-Scoped Alerts

Alerts are tied to a session ID, not a user account. A user who starts a new session loses visibility into alerts from previous sessions. This could be improved by associating alerts with authenticated user IDs in PostgreSQL.

### Root-Level Legacy Files

`main.py`, `crypto.py`, and `requirements.txt` at the project root are legacy files from before the `backend/` reorganization. The Procfile uses the root `main.py` for PaaS deployments. These should ideally be consolidated.

### Backtester Stub

`backend/rag/backtester.py` is a stub — backtesting functionality is not implemented.

### Concurrent Watchlist Enrichment

Watchlist enrichment in `watchlist_enrich.py` fetches tickers sequentially, not in parallel (unlike portfolio analysis which uses ThreadPoolExecutor). For large watchlists this can be slow. The Go gateway applies a 90-second timeout.

### No Request Rate Limiting

The Go gateway does not implement per-user or per-IP rate limiting. Under heavy traffic, the Groq and external API budgets could be exhausted quickly.

### LLM Temperature & Determinism

Groq calls use the default temperature, meaning responses to identical questions may vary. For financial data display this is generally acceptable; for reproducible analysis it would need `temperature=0`.
