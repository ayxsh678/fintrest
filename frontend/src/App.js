import { useState, useRef, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const API_URL = process.env.REACT_APP_API_URL || "https://fintrest-go.onrender.com";

// ── Auth helpers ────────────────────────────────────────
const getToken    = () => localStorage.getItem("fintrest_token");
const setToken    = (t) => localStorage.setItem("fintrest_token", t);
const removeToken = () => localStorage.removeItem("fintrest_token");
const getUser  = () => { try { return JSON.parse(localStorage.getItem("fintrest_user")); } catch { return null; } };
const setUser  = (u) => localStorage.setItem("fintrest_user", JSON.stringify(u));
const removeUser  = () => localStorage.removeItem("fintrest_user");

// ── Chart data ──────────────────────────────────────────
const generateChartData = (base, points = 30) => {
  let price = base;
  return Array.from({ length: points }, (_, i) => {
    price = price + (Math.random() - 0.48) * (base * 0.008);
    return { day: `D${i + 1}`, price: parseFloat(price.toFixed(2)) };
  });
};

const WATCHLIST_DEFAULT = [
  { ticker: "AAPL",        name: "Apple Inc.",    price: null, change: null, base: 248,   type: "US"     },
  { ticker: "NVDA",        name: "NVIDIA Corp.",  price: null, change: null, base: 860,   type: "US"     },
  { ticker: "RELIANCE.NS", name: "Reliance Ind.", price: null, change: null, base: 2950,  type: "India"  },
  { ticker: "TCS.NS",      name: "TCS",           price: null, change: null, base: 3900,  type: "India"  },
  { ticker: "BTC",         name: "Bitcoin",       price: null, change: null, base: 81000, type: "Crypto" },
  { ticker: "ETH",         name: "Ethereum",      price: null, change: null, base: 3900,  type: "Crypto" },
];

const SUGGESTIONS = [
  "Should I buy AAPL right now?",
  "What is Bitcoin doing today?",
  "Compare RELIANCE.NS vs TCS.NS",
  "Analyze portfolio BTC ETH NVDA",
  "What is Ethereum's 7 day trend?",
  "Compare AAPL vs MSFT",
];

const MOBILE_TABS = [
  { id: "market",    label: "Market",    icon: "📈" },
  { id: "chat",      label: "Chat",      icon: "💬" },
  { id: "watchlist", label: "Watchlist", icon: "⭐" },
  { id: "more",      label: "More",      icon: "☰"  },
];

const MORE_SUB_TABS = [
  { id: "compare",   label: "Compare"   },
  { id: "portfolio", label: "Portfolio" },
  { id: "alerts",    label: "Alerts"    },
];

const TYPE_STYLES = {
  Crypto: { bg: "#1a1a2e", color: "#a78bfa" },
  India:  { bg: "#1a2e1a", color: "#3fb950" },
  US:     { bg: "#1a1e2e", color: "#60a5fa" },
};

// ── Sentiment helpers ───────────────────────────────────
const sentimentColor = (score) => {
  if (score === null || score === undefined) return "#8b949e";
  if (score >= 62) return "#3fb950";
  if (score <= 38) return "#f85149";
  return "#e3b341";
};
const sentimentLabel = (score) => {
  if (score === null || score === undefined) return "—";
  if (score >= 62) return "Bullish";
  if (score <= 38) return "Bearish";
  return "Neutral";
};

function SentimentBar({ score, loading }) {
  const color = sentimentColor(score);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>Sentiment</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: loading ? "#8b949e" : color }}>
          {loading ? "…" : score !== null ? sentimentLabel(score) : "—"}
        </span>
      </div>
      <div style={{ height: 3, background: "#21262d", borderRadius: 2, overflow: "hidden" }}>
        {!loading && score !== null && (
          <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 2, transition: "width 0.6s ease" }} />
        )}
      </div>
    </div>
  );
}

function SentimentGauge({ ticker, sentiment, loading }) {
  const score     = sentiment?.score ?? null;
  const label     = sentiment?.label ?? "—";
  const color     = sentimentColor(score);
  const count     = sentiment?.headline_count ?? 0;
  const headlines = sentiment?.headlines ?? [];
  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>News Sentiment</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>{ticker}</div>
        </div>
        {!loading && score !== null && (
          <div style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 20, padding: "4px 12px", fontFamily: "'DM Mono', monospace", fontSize: 12, color, fontWeight: 700 }}>{label}</div>
        )}
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: "#8b949e" }}>Analyzing headlines…</div>
      ) : score !== null ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#f85149" }}>Bearish</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color }}>{score}</span>
              <span style={{ fontSize: 10, color: "#3fb950" }}>Bullish</span>
            </div>
            <div style={{ position: "relative", height: 8, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #f8514933 0%, #e3b34133 40%, #3fb95033 100%)" }} />
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${score}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, borderRadius: 4, transition: "width 0.8s ease" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${score}% - 1px)`, width: 2, background: color, borderRadius: 1 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#8b949e" }}>
              <span>0</span><span style={{ color: "#e3b341" }}>Neutral 40–62</span><span>100</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#8b949e", marginBottom: count > 0 ? 10 : 0 }}>
            Based on {count} headline{count !== 1 ? "s" : ""} from the past 3 days
          </div>
          {headlines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Top Headlines</div>
              {headlines.slice(0, 3).map((h, i) => (
                <div key={i} style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.5, padding: "6px 10px", background: "#161b22", borderRadius: 8, borderLeft: `2px solid ${color}66` }}>
                  {h.length > 110 ? h.slice(0, 110) + "…" : h}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: "#8b949e" }}>No sentiment data — check that NEWSAPI_KEY is set.</div>
      )}
    </div>
  );
}

// ── Session helpers ─────────────────────────────────────
const getSessionId    = () => localStorage.getItem("fintrest_session_id");
const setSessionId    = (id) => localStorage.setItem("fintrest_session_id", id);
const removeSessionId = () => localStorage.removeItem("fintrest_session_id");
const startSession = async () => {
  try {
    const res  = await fetch(`${API_URL}/session/new`, { method: "POST" });
    const data = await res.json();
    setSessionId(data.session_id);
    return data.session_id;
  } catch { return null; }
};
const clearSession = async () => {
  const sid = getSessionId();
  if (sid) { try { await fetch(`${API_URL}/session/${sid}`, { method: "DELETE" }); } catch {} }
  removeSessionId();
  return startSession();
};

// ── TradingView ─────────────────────────────────────────
// Reject obvious junk before handing it to the embed (which would show an
// empty "Invalid symbol" box). Allow letters, digits, dot, dash, colon,
// underscore; keep length sane.
const CHART_VALID_TICKER = /^[A-Za-z0-9._:\-]{1,20}$/;

// Build a TradingView symbol-page URL so tapping/clicking a chart opens
// the full TV experience (matches the old iframe's click-through behavior
// without bringing back the "only available on TradingView" modal).
const TV_CRYPTO_MAP = {
  BTC:  "BINANCE-BTCUSDT",
  ETH:  "BINANCE-ETHUSDT",
  SOL:  "BINANCE-SOLUSDT",
  BNB:  "BINANCE-BNBUSDT",
  DOGE: "BINANCE-DOGEUSDT",
};
function tvSymbolUrl(ticker) {
  if (typeof ticker !== "string") return null;
  const t = ticker.toUpperCase();
  if (TV_CRYPTO_MAP[t]) return `https://www.tradingview.com/symbols/${TV_CRYPTO_MAP[t]}/`;
  if (t.endsWith(".NS")) return `https://www.tradingview.com/symbols/NSE-${t.slice(0, -3)}/`;
  if (t.endsWith(".BO")) return `https://www.tradingview.com/symbols/BSE-${t.slice(0, -3)}/`;
  if (t.includes(":"))   return `https://www.tradingview.com/symbols/${t.replace(":", "-")}/`;
  return `https://www.tradingview.com/symbols/NASDAQ-${t}/`;
}

// Only attach a title= tooltip when the value is long enough to plausibly
// truncate. Short values (e.g. "AAPL", "1.25x") don't need a tooltip and
// the extra attribute just adds noise for screen readers.
function maybeTitle(v, threshold = 8) {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v);
  return s.length > threshold ? s : undefined;
}

function ChartFallback({ ticker, height, reason }) {
  return (
    <div style={{ height, width: "100%", borderRadius: 12, background: "#161b22", border: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6, padding: 12, textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "#f7c843", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{ticker || "—"}</div>
      <div style={{ fontSize: 11, color: "#8b949e" }}>{reason}</div>
    </div>
  );
}

// Self-hosted replacement for the TradingView widget. Pulls OHLC from our
// /chart/{ticker} endpoint (backed by EODHD) and renders with
// lightweight-charts. This sidesteps TradingView's licensing modal on
// embedded NSE/BSE charts and keeps all chart data on our own trust boundary.
//
// Dynamic import so the ~150KB charts library doesn't land in the initial
// bundle for users who never open a compare view.
function TradingViewChart({ ticker, height = 220 }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const [state, setState] = useState({ status: "loading", reason: "" });

  const isValid = typeof ticker === "string" && CHART_VALID_TICKER.test(ticker);

  useEffect(() => {
    if (!isValid) {
      setState({ status: "error", reason: "Chart unavailable for this symbol" });
      return;
    }
    let cancelled = false;
    let chart;
    let resizeObserver;

    (async () => {
      try {
        const { createChart, ColorType } = await import("lightweight-charts");
        const res = await fetch(`${API_URL}/chart/${encodeURIComponent(ticker)}?days=180`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;
        if (!payload.ok || !Array.isArray(payload.rows) || payload.rows.length === 0) {
          setState({ status: "error", reason: "No chart data available" });
          return;
        }
        const el = containerRef.current;
        if (!el) return;

        chart = createChart(el, {
          width:  el.clientWidth,
          height,
          layout: {
            background: { type: ColorType.Solid, color: "#0d1117" },
            textColor:  "#8b949e",
            fontFamily: "'DM Mono', monospace",
          },
          grid: {
            vertLines: { color: "#161b22" },
            horzLines: { color: "#161b22" },
          },
          rightPriceScale: { borderColor: "#21262d" },
          timeScale:       { borderColor: "#21262d", timeVisible: false, secondsVisible: false },
          crosshair:       { mode: 1 },
        });
        chartRef.current = chart;

        const series = chart.addCandlestickSeries({
          upColor:       "#3fb950",
          downColor:     "#f85149",
          borderUpColor: "#3fb950",
          borderDownColor: "#f85149",
          wickUpColor:   "#3fb950",
          wickDownColor: "#f85149",
        });
        series.setData(payload.rows.map(r => ({
          time:  r.time,
          open:  r.open,
          high:  r.high,
          low:   r.low,
          close: r.close,
        })));
        chart.timeScale().fitContent();
        setState({ status: "ok", reason: "" });

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect?.width;
            if (w && chartRef.current) chartRef.current.applyOptions({ width: w });
          });
          resizeObserver.observe(el);
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", reason: "Chart unavailable" });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [ticker, height, isValid]);

  if (state.status === "error") {
    return <ChartFallback ticker={ticker} height={height} reason={state.reason} />;
  }

  const tvHref = tvSymbolUrl(ticker);

  return (
    <div style={{ position: "relative", height, width: "100%", borderRadius: 12, overflow: "hidden", background: "#0d1117", border: "1px solid #21262d" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 8, left: 10, fontSize: 11, color: "#8b949e", fontFamily: "'DM Mono', monospace", pointerEvents: "none" }}>
        {ticker}
      </div>
      {/* Transparent click-through overlay so tap/click on the chart opens
          the full TradingView page (matches the old iframe's click-through
          without re-introducing TV's licensing modal on NSE/BSE). Sits
          above the canvas but below the loading indicator. */}
      {tvHref && (
        <a
          href={tvHref}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${ticker} on TradingView`}
          aria-label={`Open ${ticker} on TradingView`}
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
        />
      )}
      {state.status === "loading" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 11, background: "#0d1117" }}>
          Loading chart…
        </div>
      )}
    </div>
  );
}

// ── News Feed with impact scoring ────────────────────────
function NewsFeed({ ticker, news, loading }) {
  const [openIdx, setOpenIdx] = useState(null);
  const items = news?.news ?? [];
  const summary = news?.sentiment_summary;
  const overall = news?.overall_sentiment;

  const dirColor = (d) => d === "may increase" ? "#3fb950" : d === "may decrease" ? "#f85149" : "#e3b341";
  const dirArrow = (d) => d === "may increase" ? "▲" : d === "may decrease" ? "▼" : "▬";
  const timeAgo = (iso) => {
    if (!iso) return "";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: "20px 24px", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Smart News</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>{ticker}</div>
        </div>
        {overall && (
          <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>Overall: <span style={{ color: overall === "positive" ? "#3fb950" : overall === "negative" ? "#f85149" : "#e3b341", fontWeight: 700 }}>{overall}</span></div>
        )}
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: "#8b949e" }}>Fetching news and analyzing impact…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 11, color: "#8b949e" }}>{summary || "No recent news found."}</div>
      ) : (
        <>
          {summary && <div style={{ fontSize: 11, color: "#c9d1d9", lineHeight: 1.5, marginBottom: 12, padding: "8px 12px", background: "#161b22", borderRadius: 8 }}>{summary}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((n, i) => {
              const isOpen = openIdx === i;
              const color = dirColor(n.price_direction);
              return (
                <div key={i} style={{ background: "#161b22", borderRadius: 10, borderLeft: `3px solid ${color}`, padding: "10px 12px", cursor: "pointer" }} onClick={() => setOpenIdx(isOpen ? null : i)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, fontSize: 12, color: "#e6edf3", lineHeight: 1.4, fontWeight: 500 }}>{n.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 12, padding: "2px 8px", fontFamily: "'DM Mono', monospace", fontSize: 10, color, fontWeight: 700, whiteSpace: "nowrap" }}>
                      <span>{dirArrow(n.price_direction)}</span><span>{n.impact_score}/10</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#8b949e" }}>
                    <span>{n.source}{n.published_at && ` · ${timeAgo(n.published_at)}`}</span>
                    <span style={{ color }}>{n.price_direction} {isOpen ? "▾" : "▸"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "#0d1117", borderRadius: 6, fontSize: 11, color: "#c9d1d9", lineHeight: 1.5 }}>
                      {n.impact_explanation}
                      {n.url && (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "block", marginTop: 6, color: "#58a6ff", fontSize: 10 }}>Read full article ↗</a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Metric explanations (tap-to-explain) ────────────────
const METRIC_EXPLANATIONS = {
  "Price":     { short: "What one share costs right now.", detail: "The last traded price. Goes up when more people want to buy; goes down when more people want to sell. By itself, price tells you nothing about whether a stock is cheap or expensive — compare with P/E and Market Cap." },
  "5D Change": { short: "How much the price moved over the last 5 trading days.", detail: "Short-term momentum. Green = rising, red = falling. Useful to catch trends, but 5 days is noise for long-term investors. Don't buy or sell just because of a 5-day move." },
  "Mkt Cap":   { short: "The total price tag of the whole company.", detail: "Market Cap = Share Price × Total Shares. Large cap (huge, stable), Mid cap (growing), Small cap (risky but high potential). A ₹100 share in a small company is very different from a ₹100 share in a giant." },
  "P/E":       { short: "Is the stock expensive or cheap vs its earnings?", detail: "If P/E is 20, you pay ₹20 for every ₹1 the company earns per year. Lower can mean cheaper — but very low P/E sometimes signals trouble ahead. Typical healthy range: 10–25." },
  "EPS":       { short: "How much profit the company makes per share.", detail: "Earnings Per Share = Net Profit ÷ Shares Outstanding. Rising EPS over time is a green flag. Compare EPS with the share price to understand P/E." },
  "52W High":  { short: "The highest price this stock hit in the last year.", detail: "If the current price is close to the 52W high, momentum is strong — but the stock may be fully priced. Far below? Could be a bargain, or something is wrong — investigate why." },
  "52W Low":   { short: "The lowest price this stock hit in the last year.", detail: "Shows how far the stock can fall. If the current price is near this level, be cautious and research what's dragging it down before buying." },
  "Rel Vol":   { short: "Is trading unusually busy today?", detail: "Relative Volume compares today's volume to the average. >1.5 means unusual activity (news, earnings, rumors). <0.7 means a quiet day. High Rel Vol often precedes big moves." },
};

// ── Compare Table ───────────────────────────────────────
function CompareTable({ data, ticker_a, ticker_b }) {
  const [expanded, setExpanded] = useState(null);
  const parse = (s, f) => { const m = s?.match(new RegExp(`${f}: ([^\n]+)`)); return m ? m[1].trim() : "—"; };
  const sA = typeof data?.data_a?.stock === "string" ? data.data_a.stock : ""; const sB = typeof data?.data_b?.stock === "string" ? data.data_b.stock : "";
  const rows = [
    { label: "Price",     a: parse(sA, "Current Price"),   b: parse(sB, "Current Price")   },
    { label: "5D Change", a: parse(sA, "5-Day Change"),    b: parse(sB, "5-Day Change")    },
    { label: "Mkt Cap",   a: parse(sA, "Market Cap"),      b: parse(sB, "Market Cap")      },
    { label: "P/E",       a: parse(sA, "P/E Ratio"),       b: parse(sB, "P/E Ratio")       },
    { label: "EPS",       a: parse(sA, "EPS"),             b: parse(sB, "EPS")             },
    { label: "52W High",  a: parse(sA, "52W High"),        b: parse(sB, "52W High")        },
    { label: "52W Low",   a: parse(sA, "52W Low"),         b: parse(sB, "52W Low")         },
    { label: "Rel Vol",   a: parse(sA, "Relative Volume"), b: parse(sB, "Relative Volume") },
  ];
  const isDown = (v) => v?.includes("-");
  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#161b22", borderBottom: "1px solid #21262d" }}>
        <div style={{ padding: "10px 10px", fontSize: 10, color: "#8b949e", minWidth: 0 }} />
        {[ticker_a, ticker_b].map(t => (
          <div key={t} title={maybeTitle(t)} style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#f7c843", fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</div>
        ))}
      </div>
      {rows.map((row, i) => {
        const isOpen = expanded === row.label;
        const exp = METRIC_EXPLANATIONS[row.label];
        return (
          <div key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #21262d" : "none" }}>
            <div
              onClick={() => setExpanded(isOpen ? null : row.label)}
              title="Tap to explain"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: i % 2 === 0 ? "#0d1117" : "#0a0f16", cursor: exp ? "pointer" : "default" }}
            >
              <div style={{ padding: "7px 10px", fontSize: 10, color: isOpen ? "#f7c843" : "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
                {row.label}
                {exp && <span style={{ fontSize: 9, opacity: 0.6 }}>{isOpen ? "▾" : "ⓘ"}</span>}
              </div>
              {[row.a, row.b].map((val, j) => (
                <div key={j} title={maybeTitle(val)} style={{ padding: "7px 8px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: row.label === "5D Change" ? (isDown(val) ? "#f85149" : "#3fb950") : "#e6edf3", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
              ))}
            </div>
            {isOpen && exp && (
              <div style={{ padding: "10px 14px", background: "#0a0f16", borderTop: "1px solid #21262d" }}>
                <div style={{ fontSize: 12, color: "#f7c843", fontWeight: 600, marginBottom: 4 }}>{exp.short}</div>
                <div style={{ fontSize: 11, color: "#c9d1d9", lineHeight: 1.55 }}>{exp.detail}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const currencySymbol = type => type === "India" ? "₹" : "$";

const CustomTooltip = ({ active, payload, symbol = "$" }) => active && payload?.length
  ? <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#e6edf3" }}>{symbol}{payload[0].value.toLocaleString()}</div>
  : null;

// ── Stock Card ──────────────────────────────────────────
function StockCard({ stock, isSelected, onClick, sentiment, sentimentLoading }) {
  const data = generateChartData(stock.base);
  const isUp = stock.change >= 0;
  const ts   = TYPE_STYLES[stock.type] || TYPE_STYLES.US;
  return (
    <div onClick={onClick} style={{ background: isSelected ? "#161b22" : "#0d1117", border: `1px solid ${isSelected ? "#f7c843" : "#21262d"}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div title={maybeTitle(stock.ticker)} style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stock.ticker}</div>
            {stock.type && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, padding: "1px 6px", borderRadius: 4, background: ts.bg, color: ts.color, flexShrink: 0 }}>{stock.type}</span>}
          </div>
          <div title={maybeTitle(stock.name)} style={{ fontSize: 11, color: "#8b949e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stock.name}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#e6edf3", fontWeight: 600 }}>
            {stock.price == null ? "—" : stock.type === "India" ? `₹${stock.price.toLocaleString()}` : stock.type === "Crypto" ? `$${stock.price.toLocaleString()}` : `$${stock.price.toLocaleString()}`}
          </div>
          <div style={{ fontSize: 11, color: isUp ? "#3fb950" : "#f85149", marginTop: 2 }}>
            {isUp ? "▲" : "▼"} {Math.abs(stock.change ?? 0)}%
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, height: 50, width: "100%" }}>
        <ResponsiveContainer width="100%" height={50}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`g-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="price" stroke={isUp ? "#3fb950" : "#f85149"} strokeWidth={1.5} fill={`url(#g-${stock.ticker})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <SentimentBar score={sentiment?.score ?? null} loading={sentimentLoading} />
    </div>
  );
}

// ── Main Chart ──────────────────────────────────────────
function MainChart({ stock }) {
  const data = generateChartData(stock.base, 60);
  const isUp = (stock.change ?? 0) >= 0;
  const ts   = TYPE_STYLES[stock.type] || TYPE_STYLES.US;
  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: "#f7c843", fontWeight: 700 }}>{stock.ticker}</span>
            {stock.type && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: ts.bg, color: ts.color }}>{stock.type}</span>}
          </div>
          <span style={{ fontSize: 12, color: "#8b949e" }}>{stock.name}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#e6edf3", fontWeight: 700 }}>{currencySymbol(stock.type)}{stock.price?.toLocaleString() ?? "—"}</div>
          <div style={{ fontSize: 12, color: isUp ? "#3fb950" : "#f85149" }}>{isUp ? "▲" : "▼"} {Math.abs(stock.change ?? 0)}% today</div>
        </div>
      </div>
      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} interval={9} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `${currencySymbol(stock.type)}${v.toLocaleString()}`} />
            <Tooltip content={<CustomTooltip symbol={currencySymbol(stock.type)} />} />
            <Area type="monotone" dataKey="price" stroke={isUp ? "#3fb950" : "#f85149"} strokeWidth={2} fill="url(#mainGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Chat Bubble ─────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 16 }}>
      <div style={{ maxWidth: "85%", background: isUser ? "#f7c843" : "#161b22", color: isUser ? "#0d1117" : "#e6edf3", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "11px 15px", fontSize: 14, lineHeight: 1.6, border: isUser ? "none" : "1px solid #21262d", whiteSpace: "pre-wrap" }}>
        {msg.content}
      </div>
      {msg.sources?.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {msg.sources.map((s, i) => (
            <span key={i} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#8b949e" }}>📡 {s}</span>
          ))}
          {msg.responseTime && (
            <span style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#8b949e" }}>⚡ {msg.responseTime}s</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Auth Modal ──────────────────────────────────────────
function AuthModal({ onSuccess }) {
  const [mode, setMode]       = useState("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
      setToken(data.token); setUser({ email: data.email, user_id: data.user_id }); onSuccess();
    } catch { setError("Connection error"); }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(1,4,9,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, background: "#f7c843", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💹</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Fintrest</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{ flex: 1, padding: "9px 0", fontSize: 12, fontWeight: 700, textTransform: "capitalize", border: "1px solid", borderRadius: 10, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", background: mode === m ? "#f7c843" : "transparent", color: mode === m ? "#0d1117" : "#8b949e", borderColor: mode === m ? "#f7c843" : "#21262d" }}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "#e6edf3", fontFamily: "'DM Sans', sans-serif" }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
            onKeyDown={e => e.key === "Enter" && submit()}
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "#e6edf3", fontFamily: "'DM Sans', sans-serif" }} />
          {error && <div style={{ fontSize: 12, color: "#f85149" }}>{error}</div>}
          <button onClick={submit} disabled={loading || !email || !password}
            style={{ width: "100%", background: (loading || !email || !password) ? "#21262d" : "#f7c843", color: (loading || !email || !password) ? "#8b949e" : "#0d1117", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────
export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileTab, setMobileTab] = useState("market");
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [activeTab, setActiveTab] = useState("watchlist");

  const devBypass = process.env.REACT_APP_DEV_BYPASS === "1";
  const [userState, setUserState] = useState(devBypass ? { email: "dev@local" } : getUser());
  const [showAuth, setShowAuth]   = useState(devBypass ? false : !getToken());
  const handleAuthSuccess = () => { setUserState(getUser()); setShowAuth(false); };
  const handleLogout      = () => { removeToken(); removeUser(); setUserState(null); setShowAuth(true); };

  const [watchlist, setWatchlist]               = useState(WATCHLIST_DEFAULT);
  const [selectedStock, setSelectedStock]       = useState(WATCHLIST_DEFAULT[0]);
  const [messages, setMessages]                 = useState([{ role: "assistant", content: "Hello! I'm Fintrest, your AI-powered financial advisor. Ask about US stocks, Indian stocks (NSE/BSE), or crypto.", sources: [] }]);
  const [input, setInput]                       = useState("");
  const [loading, setLoading]                   = useState(false);
  const [timeRange, setTimeRange]               = useState("7d");

  const [portfolio, setPortfolio]               = useState([]);
  const [portfolioInput, setPortfolioInput]     = useState("");
  const [portfolioData, setPortfolioData]       = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const [compareA, setCompareA]                 = useState("");
  const [compareB, setCompareB]                 = useState("");
  const [compareData, setCompareData]           = useState(null);
  const [compareLoading, setCompareLoading]     = useState(false);

  const [alerts, setAlerts]                     = useState([]);
  const [alertTicker, setAlertTicker]           = useState("");
  const [alertThreshold, setAlertThreshold]     = useState("");
  const [alertDirection, setAlertDirection]     = useState("above");
  const [alertCreating, setAlertCreating]       = useState(false);
  const [alertError, setAlertError]              = useState("");
  const [triggeredNotifs, setTriggeredNotifs]   = useState([]);

  const [sentiments, setSentiments]             = useState({});
  const [sentimentLoading, setSentimentLoading] = useState({});
  const fetchedSentiments                       = useRef(new Set());

  const bottomRef = useRef(null);

  useEffect(() => { if (!getSessionId()) startSession(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const sid = getSessionId();
    if (!sid) return;
    (async () => {
      try {
        const res  = await fetch(`${API_URL}/session/${sid}/history`);
        if (!res.ok) return;
        const data = await res.json();
        const hist = (data.messages || []).map(m => ({
          role: m.role, content: m.content, sources: []
        }));
        if (hist.length) setMessages([{ role: "assistant", content: "Welcome back. Resuming your previous conversation.", sources: [] }, ...hist]);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(`${API_URL}/watchlist/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: WATCHLIST_DEFAULT.map(s => s.ticker) }),
        });
        if (!res.ok) return;
        const { items } = await res.json();
        const byTicker = Object.fromEntries(items.map(i => [i.ticker, i]));
        const updated = WATCHLIST_DEFAULT.map(stock => {
          const live = byTicker[stock.ticker];
          if (!live || live.price == null) return stock;
          return { ...stock, price: live.price, change: live.change_5d_pct ?? 0, base: live.price };
        });
        setWatchlist(updated);
        setSelectedStock(prev => updated.find(s => s.ticker === prev.ticker) ?? prev);
        items.forEach(i => {
          if (i.sentiment_score != null) {
            fetchedSentiments.current.add(i.ticker);
            setSentiments(prev => ({
              ...prev,
              [i.ticker]: { ticker: i.ticker, score: i.sentiment_score, label: i.sentiment_label, headline_count: 0, headlines: [] },
            }));
          }
        });
      } catch {}
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchSentiment = useCallback(async (ticker, name = "") => {
    if (fetchedSentiments.current.has(ticker)) return;
    fetchedSentiments.current.add(ticker);
    setSentimentLoading(prev => ({ ...prev, [ticker]: true }));
    try {
      const res  = await fetch(`${API_URL}/sentiment/${ticker}?company=${encodeURIComponent(name)}`);
      const data = await res.json();
      setSentiments(prev => ({ ...prev, [ticker]: data }));
    } catch {
      fetchedSentiments.current.delete(ticker); // allow retry on error
      setSentiments(prev => ({ ...prev, [ticker]: null }));
    }
    setSentimentLoading(prev => ({ ...prev, [ticker]: false }));
  }, []);

  const [newsData, setNewsData]           = useState({});
  const [newsLoading, setNewsLoading]     = useState({});
  const fetchedNews = useRef(new Set());
  const fetchNews = useCallback(async (ticker, name = "") => {
    if (fetchedNews.current.has(ticker)) return;
    fetchedNews.current.add(ticker);
    setNewsLoading(prev => ({ ...prev, [ticker]: true }));
    try {
      const res  = await fetch(`${API_URL}/news/${ticker}?company=${encodeURIComponent(name)}`);
      const data = await res.json();
      setNewsData(prev => ({ ...prev, [ticker]: data }));
    } catch {
      fetchedNews.current.delete(ticker);
      setNewsData(prev => ({ ...prev, [ticker]: null }));
    }
    setNewsLoading(prev => ({ ...prev, [ticker]: false }));
  }, []);

  useEffect(() => { watchlist.forEach(s => fetchSentiment(s.ticker, s.name)); }, [watchlist, fetchSentiment]);
  useEffect(() => { fetchSentiment(selectedStock.ticker, selectedStock.name); }, [selectedStock.ticker, fetchSentiment]);
  useEffect(() => { fetchNews(selectedStock.ticker, selectedStock.name); }, [selectedStock.ticker, fetchNews]);

  useEffect(() => {
    const poll = async () => {
      const sid = getSessionId();
      if (!sid) return;
      try {
        const res  = await fetch(`${API_URL}/check_alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
        if (!res.ok) throw new Error(`check_alerts failed: ${res.status}`);
        const data = await res.json();
        if (data.triggered?.length) { setTriggeredNotifs(prev => [...prev, ...data.triggered]); fetchAlerts(); }
      } catch (e) { console.error("Alert polling error:", e); }
    };
    poll();
    const t = setInterval(poll, 300_000);
    return () => clearInterval(t);
  }, []);

  const fetchAlerts = async () => {
    const sid = getSessionId();
    if (!sid) return;
    try {
      const res  = await fetch(`${API_URL}/get_alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Failed to fetch alerts:", e); }
  };

  const createAlert = async () => {
    const ticker = alertTicker.toUpperCase().trim();
    const threshold = parseFloat(alertThreshold);
    if (!ticker || !Number.isFinite(threshold) || threshold <= 0) {
      setAlertError("Enter a valid ticker and positive threshold.");
      return;
    }
    setAlertError("");
    setAlertCreating(true);
    try {
      const sid = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/create_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, ticker, threshold, direction: alertDirection }) });
      if (!res.ok) throw new Error(`create_alert failed: ${res.status}`);
      setAlertTicker(""); setAlertThreshold(""); await fetchAlerts();
    } catch (e) {
      console.error("Failed to create alert:", e);
      setAlertError("Failed to create alert. Please try again.");
    }
    setAlertCreating(false);
  };

  const deleteAlert = async (id) => {
    const sid = getSessionId();
    if (!sid) return;
    try {
      const res = await fetch(`${API_URL}/delete_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, alert_id: id }) });
      if (!res.ok) throw new Error(`delete_alert failed: ${res.status}`);
      await fetchAlerts();
    } catch (e) { console.error("Failed to delete alert:", e); }
  };

  const dismissNotif       = (i) => setTriggeredNotifs(prev => prev.filter((_, j) => j !== i));
  const addToPortfolio     = (t) => { const v = t.trim().toUpperCase(); if (v && !portfolio.includes(v)) setPortfolio(prev => [...prev, v]); };
  const removeFromPortfolio = (t) => setPortfolio(prev => prev.filter(x => x !== t));

  const runPortfolioAnalysis = async (over = null) => {
    const tickers = over || portfolio;
    if (!tickers.length) return;
    setPortfolioLoading(true);
    try {
      const sid  = getSessionId() || await startSession();
      const res  = await fetch(`${API_URL}/portfolio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers, session_id: sid }) });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setPortfolioData(data);
    } catch { setPortfolioData({ error: "Portfolio analysis failed." }); }
    setPortfolioLoading(false);
  };

  const runComparison = async (a = null, b = null) => {
    const ta = (a || compareA).trim().toUpperCase();
    const tb = (b || compareB).trim().toUpperCase();
    if (!ta || !tb) return;
    setCompareLoading(true);
    try {
      const sid  = getSessionId() || await startSession();
      const res  = await fetch(`${API_URL}/compare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker_a: ta, ticker_b: tb, session_id: sid }) });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setCompareData(data);
      if (isMobile) setMobileTab("market"); else setActiveTab("compare");
      fetchSentiment(ta); fetchSentiment(tb);
    } catch { setCompareData({ error: "Comparison failed." }); }
    setCompareLoading(false);
  };

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return;
    const lower       = question.toLowerCase();
    const isCompare   = lower.includes(" vs ") || lower.includes("compare ");
    const isPortfolio = lower.includes("portfolio") || lower.includes("analyze my");
    setLoading(true);
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");
    if (isMobile) setMobileTab("chat");

    const sid      = getSessionId() || await startSession();
    let endpoint   = "/ask";
    if (isCompare)   endpoint = "/compare/from-chat";
    else if (isPortfolio) endpoint = "/portfolio/from-chat";

    try {
      const res  = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, query: question, session_id: sid, time_range: timeRange }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.detail || data?.error || `Request failed (${res.status}).`;
        setMessages(prev => [...prev, { role: "assistant", content: msg, sources: [] }]);
      } else {
        if (data.session_id) setSessionId(data.session_id);

        if (isCompare && data.ticker_a) {
          setCompareA(data.ticker_a); setCompareB(data.ticker_b); setCompareData(data);
          setMessages(prev => [...prev, { role: "assistant", content: data.verdict, sources: ["Yahoo Finance"] }]);
        } else if (isPortfolio && data.tickers) {
          setPortfolio(data.tickers); setPortfolioData(data);
          setMessages(prev => [...prev, { role: "assistant", content: data.summary, sources: ["Yahoo Finance"] }]);
        } else {
          const content = data.answer || data.detail || "No response received.";
          setMessages(prev => [...prev, { role: "assistant", content, sources: data.sources || [], responseTime: data.response_time }]);
        }
      }
    } catch (e) {
      console.error("sendMessage error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error.", sources: [] }]);
    }
    setLoading(false);
  };

  const handleNewChat = async () => {
    await clearSession();
    setMessages([{ role: "assistant", content: "New conversation started. What would you like to know?", sources: [] }]);
  };

  const activeAlerts    = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  const tabStyle = (tab) => ({
    flex: 1, padding: "7px 0", fontSize: 10, fontWeight: 600,
    letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer",
    border: "none", fontFamily: "'DM Sans', sans-serif",
    background:   activeTab === tab ? "#161b22" : "transparent",
    color:        activeTab === tab ? "#f7c843" : "#8b949e",
    borderBottom: activeTab === tab ? "2px solid #f7c843" : "2px solid transparent",
  });

  const renderLeftPanelContent = () => (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      {/* On mobile "more" tab: show sub-tabs so compare/portfolio/alerts are reachable */}
      {isMobile && mobileTab === "more" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {MORE_SUB_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ flex: 1, padding: "9px 0", fontSize: 12, fontWeight: 700, border: "1px solid", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                background: activeTab === id ? "#f7c843" : "#161b22",
                color: activeTab === id ? "#0d1117" : "#8b949e",
                borderColor: activeTab === id ? "#f7c843" : "#21262d" }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {/* On mobile "watchlist" tab always shows watchlist; on desktop follows activeTab */}
      {(isMobile ? mobileTab === "watchlist" : activeTab === "watchlist") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {watchlist.map(stock => (
            <StockCard key={stock.ticker} stock={stock}
              isSelected={selectedStock.ticker === stock.ticker}
              onClick={() => { setSelectedStock(stock); if (isMobile) setMobileTab("market"); }}
              sentiment={sentiments[stock.ticker] ?? null}
              sentimentLoading={sentimentLoading[stock.ticker] ?? false}
            />
          ))}
        </div>
      )}

      {activeTab === "compare" && (!isMobile || mobileTab === "more") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={compareA} onChange={e => setCompareA(e.target.value.toUpperCase())} placeholder="Ticker A (e.g. RELIANCE.NS)"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
          <input value={compareB} onChange={e => setCompareB(e.target.value.toUpperCase())} placeholder="Ticker B (e.g. TCS.NS)"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
          <button onClick={() => runComparison()} disabled={compareLoading || !compareA || !compareB}
            style={{ background: "#f7c843", color: "#0d1117", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {compareLoading ? "..." : "Compare"}
          </button>
          <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Quick picks</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              { label: "Reliance vs TCS",     a: "RELIANCE.NS",  b: "TCS.NS" },
              { label: "HDFC vs ICICI",       a: "HDFCBANK.NS",  b: "ICICIBANK.NS" },
              { label: "Infosys vs Wipro",    a: "INFY.NS",      b: "WIPRO.NS" },
              { label: "AAPL vs MSFT",        a: "AAPL",         b: "MSFT" },
              { label: "NVDA vs AMD",         a: "NVDA",         b: "AMD" },
              { label: "BTC vs ETH",          a: "BTC",          b: "ETH" },
            ].map(pick => (
              <button key={pick.label} disabled={compareLoading}
                onClick={() => { setCompareA(pick.a); setCompareB(pick.b); runComparison(pick.a, pick.b); }}
                style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 14, padding: "5px 10px", fontSize: 11, color: "#c9d1d9", cursor: compareLoading ? "wait" : "pointer" }}>
                {pick.label}
              </button>
            ))}
          </div>
          {compareData && !compareData.error && (
            <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />
          )}
        </div>
      )}

      {activeTab === "portfolio" && (!isMobile || mobileTab === "more") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={portfolioInput} onChange={e => setPortfolioInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { addToPortfolio(portfolioInput); setPortfolioInput(""); } }}
              placeholder="e.g. AAPL, BTC, INFY.NS"
              style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", color: "#e6edf3" }} />
            <button onClick={() => { addToPortfolio(portfolioInput); setPortfolioInput(""); }}
              style={{ background: "#21262d", color: "#f7c843", padding: "0 15px", borderRadius: 8, border: "none", fontSize: 18 }}>+</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {portfolio.map(t => (
              <div key={t} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#f7c843", display: "flex", alignItems: "center", gap: 6 }}>
                {t}<span onClick={() => removeFromPortfolio(t)} style={{ color: "#8b949e", cursor: "pointer" }}>×</span>
              </div>
            ))}
          </div>
          {portfolio.length > 0 && (
            <button onClick={() => runPortfolioAnalysis()} disabled={portfolioLoading}
              style={{ background: "#f7c843", color: "#0d1117", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700 }}>
              {portfolioLoading ? "Analyzing..." : "Analyze Portfolio"}
            </button>
          )}
          {portfolioData?.error && (
            <div style={{ fontSize: 12, color: "#f85149" }}>{portfolioData.error}</div>
          )}
          {portfolioData && !portfolioData.error && (
            <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>Analysis</div>
              <div style={{ fontSize: 13, color: "#e6edf3", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{portfolioData.summary}</div>
              {portfolioData.breakdown && Object.keys(portfolioData.breakdown).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>Holdings</div>
                  {Object.entries(portfolioData.breakdown).map(([ticker, info]) => {
                    const firstLine = typeof info === "string" ? info.split("\n").find(l => l.includes("Current Price")) || info.split("\n")[0] : "";
                    return (
                      <div key={ticker} style={{ background: "#0d1117", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#f7c843" }}>{ticker}</span>
                        <span style={{ fontSize: 11, color: "#8b949e" }}>{firstLine.replace(/^.*?:\s*/, "")}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "alerts" && (!isMobile || mobileTab === "more") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={alertTicker} onChange={e => setAlertTicker(e.target.value.toUpperCase())} placeholder="Ticker"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", color: "#e6edf3" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)} placeholder="Price" type="number"
              style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", color: "#e6edf3" }} />
            <select value={alertDirection} onChange={e => setAlertDirection(e.target.value)}
              style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px", color: "#e6edf3" }}>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <button onClick={createAlert} disabled={alertCreating}
            style={{ background: "#f7c843", color: "#0d1117", border: "none", borderRadius: 10, padding: "11px 0" }}>
            + Add Alert
          </button>
          {alertError && <div style={{ color: "#f85149", fontSize: 12 }}>{alertError}</div>}
          {activeAlerts.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", background: "#161b22", padding: 10, borderRadius: 8 }}>
              <span style={{ color: "#f7c843" }}>{a.ticker} @ {a.threshold}</span>
              <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "none", color: "#8b949e" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCenterContent = () => (
    <div style={{ padding: isMobile ? 16 : 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {compareData && !compareData.error && compareData.ticker_a ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#f7c843", fontWeight: 700 }}>{compareData.ticker_a} vs {compareData.ticker_b}</span>
            <button onClick={() => setCompareData(null)} style={{ background: "#161b22", color: "#8b949e", border: "none", borderRadius: 8, padding: "4px 10px" }}>Back</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <TradingViewChart ticker={compareData.ticker_a} height={isMobile ? 180 : 220} />
            <TradingViewChart ticker={compareData.ticker_b} height={isMobile ? 180 : 220} />
          </div>
          <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />
        </>
      ) : (
        <>
          <MainChart stock={selectedStock} />
          <SentimentGauge
            ticker={selectedStock.ticker}
            sentiment={sentiments[selectedStock.ticker] ?? null}
            loading={sentimentLoading[selectedStock.ticker] ?? false}
          />
          <NewsFeed
            ticker={selectedStock.ticker}
            news={newsData[selectedStock.ticker] ?? null}
            loading={newsLoading[selectedStock.ticker] ?? false}
          />
        </>
      )}
      {!isMobile && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)}
              style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 20, padding: "7px 14px", color: "#8b949e", cursor: "pointer" }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderChatContent = () => (
    <>
      {!isMobile && <div style={{ padding: 15, borderBottom: "1px solid #21262d", fontWeight: 700 }}>Fintrest Advisor</div>}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && <div style={{ color: "#8b949e", fontSize: 13 }}>Analyzing market data...</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 15, borderTop: "1px solid #21262d", display: "flex", gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask anything..."
          style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 12, color: "#e6edf3" }} />
        <button onClick={() => sendMessage(input)}
          style={{ background: "#f7c843", color: "#0d1117", border: "none", borderRadius: 12, padding: "0 20px", fontWeight: 700 }}>
          Ask
        </button>
      </div>
    </>
  );

  return (
    <>
      {showAuth && <AuthModal onSuccess={handleAuthSuccess} />}
      <div style={{ minHeight: "100vh", background: "#010409", color: "#e6edf3", display: "flex", flexDirection: "column" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #010409; font-family: 'DM Sans', sans-serif; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        `}</style>

        <header style={{ borderBottom: "1px solid #21262d", padding: isMobile ? "10px 16px" : "12px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1117" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#f7c843", padding: "4px 8px", borderRadius: 8, color: "#0d1117" }}>💹</div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Fintrest</span>
          </div>
          <div style={{ display: "flex", gap: isMobile ? 6 : 10, flexShrink: 0 }}>
            <button onClick={handleNewChat} aria-label="New chat" title="New chat" style={{ background: "#161b22", color: "#8b949e", border: "1px solid #21262d", padding: isMobile ? "6px 10px" : "6px 15px", borderRadius: 20, whiteSpace: "nowrap" }}>{isMobile ? "+" : "+ New"}</button>
            {userState && <button onClick={handleLogout} aria-label="Sign out" title="Sign out" style={{ color: "#f85149", background: "none", border: "none", padding: isMobile ? "6px 6px" : "6px 10px", whiteSpace: "nowrap" }}>{isMobile ? "Exit" : "Sign Out"}</button>}
          </div>
        </header>

        {!isMobile ? (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr 380px", overflow: "hidden", height: "calc(100vh - 65px)" }}>
            <div style={{ borderRight: "1px solid #21262d", background: "#0d1117", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex" }}>
                <button style={tabStyle("watchlist")} onClick={() => setActiveTab("watchlist")}>Watch</button>
                <button style={tabStyle("compare")}   onClick={() => setActiveTab("compare")}>Compare</button>
                <button style={tabStyle("portfolio")} onClick={() => setActiveTab("portfolio")}>Port</button>
                <button style={tabStyle("alerts")}    onClick={() => { setActiveTab("alerts"); fetchAlerts(); }}>Alerts</button>
              </div>
              {renderLeftPanelContent()}
            </div>
            <div style={{ overflowY: "auto" }}>{renderCenterContent()}</div>
            <div style={{ borderLeft: "1px solid #21262d", background: "#0d1117", display: "flex", flexDirection: "column" }}>{renderChatContent()}</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {mobileTab === "market"    ? renderCenterContent()  :
               mobileTab === "chat"     ? renderChatContent()    :
               renderLeftPanelContent()}
            </div>
            <div style={{ display: "flex", borderTop: "1px solid #21262d", background: "#0d1117", padding: "10px 4px" }}>
              {MOBILE_TABS.map(({ id, label, icon }) => (
                <button key={id}
                  onClick={() => {
                    setMobileTab(id);
                    // Default "more" to compare sub-tab when first opened
                    if (id === "more" && activeTab === "watchlist") setActiveTab("compare");
                    // Only fetch alerts when actually transitioning into "more"
                    if (id === "more" && mobileTab !== "more") fetchAlerts();
                  }}
                  style={{ flex: 1, background: "none", border: "none", color: mobileTab === id ? "#f7c843" : "#8b949e",
                    fontSize: 10, textTransform: "capitalize", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}