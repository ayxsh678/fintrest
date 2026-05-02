import { useState, useRef, useEffect, useCallback } from "react";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import {
  TrendingUp, MessageSquare, Bookmark, ArrowLeftRight, PieChart,
  Bell, LogOut, Send, Plus, X, MoreHorizontal, Copy, Check,
} from "lucide-react";
import Aperture from "./Aperture";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "https://fintrest-go.onrender.com";

// ── Color tokens ────────────────────────────────────────
const C = {
  bg:       "#0F0F11",
  surface:  "#17171A",
  surface2: "#1E1E24",
  border:   "#2A2A32",
  borderA:  "#3D3D4A",
  text:     "#F0EEE8",
  textSec:  "#8C8A9A",
  textTer:  "#5A5868",
  accent:   "#C8A96E",
  pos:      "#4CAF7D",
  neg:      "#E05C5C",
  neutral:  "#B8A860",
};

// ── Auth helpers ─────────────────────────────────────────
const getToken    = () => localStorage.getItem("fintrest_token");
const setToken    = (t) => localStorage.setItem("fintrest_token", t);
const removeToken = () => localStorage.removeItem("fintrest_token");
const getUser     = () => { try { return JSON.parse(localStorage.getItem("fintrest_user")); } catch { return null; } };
const setUser     = (u) => localStorage.setItem("fintrest_user", JSON.stringify(u));
const removeUser  = () => localStorage.removeItem("fintrest_user");

// ── Session helpers ──────────────────────────────────────
const getSessionId    = () => localStorage.getItem("fintrest_session_id");
const setSessionId    = (id) => localStorage.setItem("fintrest_session_id", id);
const removeSessionId = () => localStorage.removeItem("fintrest_session_id");
const startSession    = async () => {
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

// ── Data helpers ─────────────────────────────────────────
// Seeded RNG — same ticker always produces same sparkline shape, no re-render flicker
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
const generateSparkline = (base, points = 30, seed = 42) => {
  const rng = seededRng(seed);
  let price = base;
  return Array.from({ length: points }, (_, i) => {
    price += (rng() - 0.48) * (base * 0.008);
    return { i, v: parseFloat(price.toFixed(2)) };
  });
};

const WATCHLIST_DEFAULT = [
  { ticker: "RELIANCE.NS",   name: "Reliance Ind.",  price: null, change: null, base: 1430, type: "India" },
  { ticker: "TCS.NS",        name: "TCS",            price: null, change: null, base: 2465, type: "India" },
  { ticker: "HDFCBANK.NS",   name: "HDFC Bank",      price: null, change: null, base: 778, type: "India" },
  { ticker: "INFY.NS",       name: "Infosys",        price: null, change: null, base: 1167, type: "India" },
  { ticker: "ICICIBANK.NS",  name: "ICICI Bank",     price: null, change: null, base: 1279, type: "India" },
  { ticker: "SBIN.NS",       name: "SBI",            price: null, change: null, base: 788,  type: "India" },
];

let _msgSeq = 0;
const mkMsg = (role, content, extras = {}) => ({ _id: ++_msgSeq, role, content, ...extras });

const SUGGESTIONS = [
  "Should I buy Reliance now?",
  "Compare HDFCBANK.NS vs ICICIBANK.NS",
  "Analyze portfolio RELIANCE.NS TCS.NS INFY.NS",
  "Is Nifty 50 overbought right now?",
  "What are the best large cap stocks on NSE?",
  "Explain P/E ratio for TCS",
];

const METRIC_EXPLANATIONS = {
  "Price":     { short: "What one share costs right now.", detail: "The last traded price. Goes up when more people want to buy; goes down when more want to sell. Price alone says nothing about value — compare with P/E and Market Cap." },
  "5D Change": { short: "Price movement over the last 5 trading days.", detail: "Short-term momentum indicator. Green = rising, red = falling. Useful for catching trends, but too short a window for long-term investors." },
  "Mkt Cap":   { short: "Total price tag of the entire company.", detail: "Market Cap = Share Price × Total Shares. Large cap = huge and stable. Mid cap = growing. Small cap = risky but high potential." },
  "P/E":       { short: "Is the stock expensive relative to its earnings?", detail: "P/E of 20 means you pay ₹20 for every ₹1 the company earns per year. Lower can mean cheaper — but very low P/E can signal trouble ahead." },
  "EPS":       { short: "Profit the company makes per share.", detail: "Earnings Per Share = Net Profit ÷ Shares Outstanding. Rising EPS over time is a positive signal." },
  "52W High":  { short: "Highest price this stock hit in the past year.", detail: "If current price is near the 52W high, momentum is strong but the stock may be fully priced." },
  "52W Low":   { short: "Lowest price this stock hit in the past year.", detail: "Shows how far the stock has fallen. Current price near this level warrants research into the cause." },
  "Rel Vol":   { short: "Is trading unusually busy today?", detail: "Relative Volume compares today's volume to the average. >1.5 means unusual activity (news, earnings). High Rel Vol often precedes big moves." },
};

const TIME_RANGES = [
  { label: "1W", days: 7   },
  { label: "1M", days: 30  },
  { label: "3M", days: 90  },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

// ── Nav config ───────────────────────────────────────────
const NAV_ITEMS = [
  { id: "market",    label: "Market",    Icon: TrendingUp      },
  { id: "chat",      label: "Chat",      Icon: MessageSquare   },
  { id: "watchlist", label: "Watchlist", Icon: Bookmark        },
  { id: "compare",   label: "Compare",   Icon: ArrowLeftRight  },
  { id: "portfolio", label: "Portfolio", Icon: PieChart        },
  { id: "alerts",    label: "Alerts",    Icon: Bell            },
];

const MOBILE_TABS = [
  { id: "market",    label: "Market",    Icon: TrendingUp      },
  { id: "chat",      label: "Chat",      Icon: MessageSquare   },
  { id: "watchlist", label: "Watchlist", Icon: Bookmark        },
  { id: "more",      label: "More",      Icon: MoreHorizontal  },
];

const MORE_SECTIONS = ["compare", "portfolio", "alerts"];

// ── Utilities ────────────────────────────────────────────
const sentimentColor = (s) => {
  if (s == null) return C.textSec;
  if (s >= 62)  return C.pos;
  if (s <= 38)  return C.neg;
  return C.neutral;
};
const sentimentLabel = (s) => {
  if (s == null) return "—";
  if (s >= 62)  return "Bullish";
  if (s <= 38)  return "Bearish";
  return "Neutral";
};
const currencySymbol = (type) => type === "India" ? "₹" : type === "Crypto" ? "" : "$";
const maybeTitle      = (v, t = 8) => { const s = String(v ?? ""); return s.length > t ? s : undefined; };

// Indian notation: ₹2000 Cr, ₹45 L, etc.
const fmtInr = (v) => {
  if (v == null || v === "") return "—";
  if (typeof v !== "number") return String(v);
  if (v >= 1e11) return (v / 1e7).toFixed(0) + " Cr";
  if (v >= 1e7)  return (v / 1e7).toFixed(2) + " Cr";
  if (v >= 1e5)  return (v / 1e5).toFixed(2) + " L";
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};
const fmt = (v) => {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    if (v > 1e12) return (v / 1e12).toFixed(2) + "T";
    if (v > 1e9)  return (v / 1e9).toFixed(2) + "B";
    if (v > 1e6)  return (v / 1e6).toFixed(2) + "M";
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
};
const fmtPct = (v) => v != null && v !== "" ? fmt(v) + "%" : "—";

// ── Chart helpers ─────────────────────────────────────────
const CHART_VALID_TICKER = /^[A-Za-z0-9._:&\-]{1,20}$/;
function tvSymbolUrl(ticker) {
  if (!ticker || !CHART_VALID_TICKER.test(ticker)) return null;
  const t = ticker.toUpperCase();
  if (t.endsWith(".NS")) return `https://www.tradingview.com/symbols/NSE-${t.slice(0,-3)}/`;
  if (t.endsWith(".BO")) return `https://www.tradingview.com/symbols/BSE-${t.slice(0,-3)}/`;
  if (t.includes(":"))  return `https://www.tradingview.com/symbols/${t.replace(":","-")}/`;
  // Bare tickers without exchange suffix are US stocks by default
  return `https://www.tradingview.com/symbols/NASDAQ-${t}/`;
}

function normalizeSentimentPayload(data) {
  if (!data || data.error) return null;
  if (data.sentiment && typeof data.sentiment === "object") {
    return {
      ticker: data.ticker,
      score: data.sentiment.score ?? null,
      label: data.sentiment.label ?? "—",
      headline_count: data.sentiment.headline_count ?? data.sentiment.article_count ?? 0,
      headlines: data.headlines ?? data.articles?.map(a => a.title).filter(Boolean) ?? [],
    };
  }
  return {
    ...data,
    score: data.score ?? null,
    label: data.label ?? (data.score == null ? "Insufficient Data" : sentimentLabel(data.score)),
    headline_count: data.headline_count ?? 0,
    headlines: Array.isArray(data.headlines) ? data.headlines : [],
  };
}

function normalizeComparePayload(data, fallbackA, fallbackB) {
  if (!data || data.error) return data;
  if (data.data_a || data.data_b) return data;
  const stockA = data.ticker_a && typeof data.ticker_a === "object" ? data.ticker_a : {};
  const stockB = data.ticker_b && typeof data.ticker_b === "object" ? data.ticker_b : {};
  return {
    ticker_a: stockA.ticker || fallbackA,
    ticker_b: stockB.ticker || fallbackB,
    data_a: { stock: stockA, earnings: {} },
    data_b: { stock: stockB, earnings: {} },
    verdict: data.verdict || data.answer || "",
    session_id: data.session_id,
  };
}

// ═══════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════

// ── Loading line ──────────────────────────────────────────
function LoadingLine({ message = "Fetching market data…" }) {
  return (
    <div style={{ padding: "32px 0", display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>{message}</span>
      <div className="progress-line-wrap" style={{ width: 200 }}>
        <div className="progress-line" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────
function EmptyState({ Icon: Icon_, title, subtitle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", gap: 12, textAlign: "center" }}>
      {Icon_ && <Icon_ size={28} color={C.textTer} />}
      <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: C.text }}>{title}</div>
      {subtitle && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: C.textSec }}>{subtitle}</div>}
    </div>
  );
}

// ── Sentiment bar (watchlist row) ─────────────────────────
function SentimentBar({ score }) {
  const color = sentimentColor(score);
  return (
    <div style={{ width: 64 }}>
      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
        {score != null && (
          <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg,${color}66,${color})`, borderRadius: 2, transition: "width 0.6s ease" }} />
        )}
      </div>
    </div>
  );
}

// ── Sentiment gauge (SVG arc) ─────────────────────────────
function SentimentGauge({ ticker, sentiment, loading }) {
  const score     = sentiment?.score ?? null;
  const label     = sentiment?.label ?? "—";
  const headlines = sentiment?.headlines ?? [];
  const count     = sentiment?.headline_count ?? 0;

  const cx = 100, cy = 100, r = 78;
  const safeScore = score ?? 0;
  const angle     = Math.PI * (1 - safeScore / 100);
  const nx        = cx + r * Math.cos(angle);
  const ny        = cy - r * Math.sin(angle);
  const largeArc  = safeScore > 50 ? 1 : 0;
  const arcLen    = Math.PI * r * safeScore / 100;

  const impactColor = (s) => s >= 7 ? C.pos : s <= 3 ? C.neg : C.textSec;

  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>News Sentiment</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.textSec, fontWeight: 500 }}>{ticker}</div>
        </div>
        {!loading && score != null && (
          <div className={score >= 62 ? "pill-pos" : score <= 38 ? "pill-neg" : "pill-neutral"} style={{ fontSize: 11, padding: "3px 10px" }}>
            {label}
          </div>
        )}
      </div>

      {loading ? (
        <LoadingLine message="Analyzing headlines…" />
      ) : score != null ? (
        <>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <svg viewBox="0 0 200 108" width="200" height="108" style={{ overflow: "visible" }}>
              <defs>
                <linearGradient id="sg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor="#E05C5C" />
                  <stop offset="38%"  stopColor="#C8813A" />
                  <stop offset="62%"  stopColor="#C8A96E" />
                  <stop offset="100%" stopColor="#4CAF7D" />
                </linearGradient>
              </defs>
              {/* Track */}
              <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
                fill="none" stroke={C.border} strokeWidth="10" strokeLinecap="round" />
              {/* Fill */}
              {safeScore > 0 && (
                <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${nx} ${ny}`}
                  fill="none" stroke="url(#sg-grad)" strokeWidth="10" strokeLinecap="round"
                  style={{ "--arc-len": arcLen, strokeDasharray: arcLen, strokeDashoffset: arcLen, animation: "drawGauge 0.8s ease-in-out forwards" }} />
              )}
              {/* Needle */}
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.text} strokeWidth="2" strokeLinecap="round" />
              <circle cx={nx} cy={ny} r="4" fill={C.text} />
              <circle cx={cx} cy={cy} r="4.5" fill={C.surface2} stroke={C.text} strokeWidth="1.5" />
              {/* Axis labels */}
              <text x={cx-r} y={cy+14} textAnchor="middle" fontSize="9" fill={C.textTer} fontFamily="DM Sans">0</text>
              <text x={cx+r} y={cy+14} textAnchor="middle" fontSize="9" fill={C.textTer} fontFamily="DM Sans">100</text>
            </svg>
          </div>

          <div style={{ textAlign: "center", marginTop: -4, marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 32, color: C.text, lineHeight: 1 }}>{score}</div>
            <div className="label" style={{ marginTop: 6 }}>{label}</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textTer, marginTop: 4 }}>
              {count} headline{count !== 1 ? "s" : ""} analyzed
            </div>
          </div>

          {headlines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
              {headlines.slice(0, 5).map((h, i) => (
                <div key={i} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec, lineHeight: 1.4, padding: "8px 12px", background: C.surface2, borderRadius: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h}>
                  {h}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>Unable to fetch sentiment data.</div>
      )}
    </div>
  );
}

// ── News feed ─────────────────────────────────────────────
function NewsFeed({ ticker, news, loading }) {
  const [openIdx, setOpenIdx] = useState(null);
  const items   = news?.news ?? [];
  const summary = news?.sentiment_summary;
  const overall = news?.overall_sentiment;

  const dirColor = (d) => d === "may increase" ? C.pos : d === "may decrease" ? C.neg : C.neutral;
  const dirArrow = (d) => d === "may increase" ? "▲" : d === "may decrease" ? "▼" : "▬";
  const timeAgo  = (iso) => {
    if (!iso) return "";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 3600)  return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Smart News</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.textSec }}>{ticker}</div>
        </div>
        {overall && (
          <span className={overall === "positive" ? "pill-pos" : overall === "negative" ? "pill-neg" : "pill-neutral"} style={{ fontSize: 11 }}>
            {overall}
          </span>
        )}
      </div>

      {loading ? (
        <LoadingLine message="Analyzing news impact…" />
      ) : items.length === 0 ? (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>{summary || "No recent news found."}</div>
      ) : (
        <>
          {summary && (
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 14, padding: "10px 14px", background: C.surface2, borderRadius: 8 }}>
              {summary}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((n, i) => {
              const isOpen = openIdx === i;
              const color  = dirColor(n.price_direction);
              return (
                <div key={i} style={{ background: C.surface2, borderRadius: 10, borderLeft: `3px solid ${color}`, padding: "10px 14px", cursor: "pointer", transition: "background 150ms" }}
                  onClick={() => setOpenIdx(isOpen ? null : i)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.text, lineHeight: 1.4, fontWeight: 500 }}>{n.title}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 12, padding: "2px 8px", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color, fontWeight: 500, flexShrink: 0 }}>
                      <span>{dirArrow(n.price_direction)}</span><span>{n.impact_score}/10</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textSec }}>
                    <span>{n.source}{n.published_at && ` · ${timeAgo(n.published_at)}`}</span>
                    <span style={{ color }}>{n.price_direction} {isOpen ? "▾" : "▸"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: C.bg, borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>
                      {n.impact_explanation}
                      {n.url && (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          style={{ display: "block", marginTop: 6, color: C.accent, fontSize: 11, textDecoration: "none" }}>
                          Read full article ↗
                        </a>
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

// ── Compare table ─────────────────────────────────────────
function CompareTable({ data, ticker_a, ticker_b }) {
  const [expanded, setExpanded] = useState(null);
  const stockA = data?.data_a?.stock || {};
  const stockB = data?.data_b?.stock || {};
  const earnA  = data?.data_a?.earnings || {};
  const earnB  = data?.data_b?.earnings || {};

  const rows = [
    { label: "Price",     a: fmt(stockA.price),            b: fmt(stockB.price)            },
    { label: "5D Change", a: fmtPct(stockA.five_day_change),b: fmtPct(stockB.five_day_change)},
    { label: "Mkt Cap",   a: fmt(stockA.market_cap),       b: fmt(stockB.market_cap)       },
    { label: "P/E",       a: fmt(stockA.pe_ratio),         b: fmt(stockB.pe_ratio)         },
    { label: "EPS",       a: fmt(earnA.eps_actual),        b: fmt(earnB.eps_actual)        },
    { label: "52W High",  a: fmt(stockA.week52_high),      b: fmt(stockB.week52_high)      },
    { label: "52W Low",   a: fmt(stockA.week52_low),       b: fmt(stockB.week52_low)       },
    { label: "Rel Vol",   a: fmt(stockA.rel_volume),       b: fmt(stockB.rel_volume)       },
  ];
  const hasAnyData = rows.some(row => row.a !== "—" || row.b !== "—");
  const isDown = (v) => typeof v === "string" && v.startsWith("-");

  if (!hasAnyData) {
    return (
      <div className="card" style={{ padding: 16, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>
        No comparison metrics returned for these tickers. Check the symbols and try again.
      </div>
    );
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ padding: "10px 14px" }} />
        {[ticker_a, ticker_b].map(t => (
          <div key={t} title={maybeTitle(t)} style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</div>
        ))}
      </div>
      {rows.map((row, i) => {
        const isOpen = expanded === row.label;
        const exp    = METRIC_EXPLANATIONS[row.label];
        return (
          <div key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div onClick={() => setExpanded(isOpen ? null : row.label)}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: i % 2 === 0 ? C.surface : C.bg, cursor: exp ? "pointer" : "default" }}>
              <div style={{ padding: "8px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: isOpen ? C.accent : C.textSec, display: "flex", alignItems: "center", gap: 4 }}>
                {row.label}
                {exp && <span style={{ fontSize: 9, opacity: 0.5 }}>{isOpen ? "▾" : "ⓘ"}</span>}
              </div>
              {[row.a, row.b].map((val, j) => (
                <div key={j} title={maybeTitle(val)} style={{ padding: "8px 8px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: row.label === "5D Change" ? (isDown(val) ? C.neg : val === "—" ? C.textSec : C.pos) : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
              ))}
            </div>
            {isOpen && exp && (
              <div style={{ padding: "10px 14px", background: C.surface2, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 4 }}>{exp.short}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>{exp.detail}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stock card (market tab list) ──────────────────────────
function StockCard({ stock, isSelected, onClick, sentiment, sentimentLoading }) {
  const data  = Array.isArray(stock.sparkline) && stock.sparkline.length > 1
    ? stock.sparkline.map((p, i) => ({ i, v: p }))
    : generateSparkline(stock.base);
  const isUp  = (stock.change ?? 0) >= 0;
  const color = isUp ? C.pos : C.neg;
  const sym   = currencySymbol(stock.type);
  return (
    <div className={`stock-card${isSelected ? " selected" : ""}`} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={maybeTitle(stock.ticker)}>
            {stock.ticker}
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: C.text, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={maybeTitle(stock.name, 20)}>
            {stock.name}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: 12 }}>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: C.text, lineHeight: 1.1 }}>
            {stock.price == null ? "—" : `${sym}${stock.price.toLocaleString()}`}
          </div>
          <div style={{ marginTop: 4 }}>
            <span className={isUp ? "pill-pos" : "pill-neg"} style={{ fontSize: 11 }}>
              {isUp ? "▲" : "▼"} {Math.abs(stock.change ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      <div style={{ height: 44, marginBottom: 10 }}>
        <ResponsiveContainer width="100%" height={44}>
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id={`spark-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <YAxis domain={["auto","auto"]} hide />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${stock.ticker})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="label" style={{ fontSize: 10 }}>Sentiment</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sentimentLoading ? (
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: C.textTer }}>…</span>
          ) : sentiment?.score != null ? (
            <>
              <SentimentBar score={sentiment.score} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: sentimentColor(sentiment.score), minWidth: 18 }}>{sentiment.score}</span>
            </>
          ) : (
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: C.textTer }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Watchlist table ───────────────────────────────────────
function WatchlistTable({ watchlist, sentiments, sentimentLoading, onSelect }) {
  if (!watchlist.length) return <EmptyState Icon={Bookmark} title="No stocks." subtitle="Add tickers to your watchlist." />;
  return (
    <div style={{ width: "100%" }}>
      <div className="wl-header">
        {["Ticker", "Name", "Price", "Change", "Sentiment"].map(h => (
          <div key={h} className="label" style={{ fontSize: 10 }}>{h}</div>
        ))}
      </div>
      {watchlist.map((s, idx) => {
        const isUp  = (s.change ?? 0) >= 0;
        const sent  = sentiments[s.ticker];
        const sLoad = sentimentLoading[s.ticker];
        const sym   = currencySymbol(s.type);
        return (
          <div key={s.ticker} className="wl-row" style={{ animationDelay: `${idx * 0.05}s` }}
            onClick={() => onSelect(s)}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.ticker}</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.text }}>
              {s.price == null ? "—" : `${sym}${s.price.toLocaleString()}`}
            </div>
            <div>
              {s.change == null ? <span style={{ color: C.textSec }}>—</span> : (
                <span className={isUp ? "pill-pos" : "pill-neg"} style={{ fontSize: 11 }}>
                  {isUp ? "▲" : "▼"} {Math.abs(s.change).toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {sLoad ? (
                <span style={{ fontSize: 11, color: C.textTer }}>…</span>
              ) : sent?.score != null ? (
                <>
                  <SentimentBar score={sent.score} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: sentimentColor(sent.score) }}>{sent.score}</span>
                </>
              ) : <span style={{ fontSize: 11, color: C.textTer }}>—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── OHLC chart (lightweight-charts) ──────────────────────
function ChartFallback({ ticker, height, reason }) {
  return (
    <div style={{ height, width: "100%", background: C.surface2, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.textSec }}>{ticker}</div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textTer }}>{reason}</div>
    </div>
  );
}

function TradingViewChart({ ticker, height = 220, days = 180 }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const [state, setState] = useState({ status: "loading" });
  const isValid = typeof ticker === "string" && CHART_VALID_TICKER.test(ticker);

  useEffect(() => {
    if (!isValid) { setState({ status: "error", reason: "Invalid symbol" }); return; }
    let cancelled = false;
    let resizeObserver;

    setState({ status: "loading" });
    (async () => {
      try {
        const { createChart, ColorType, LineStyle } = await import("lightweight-charts");
        const res = await fetch(`${API_URL}/chart/${encodeURIComponent(ticker)}?days=${days}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;
        if (!payload.ok || !Array.isArray(payload.rows) || !payload.rows.length) {
          setState({ status: "error", reason: "No chart data available" }); return;
        }
        const el = containerRef.current;
        if (!el) return;
        if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

        const chart = createChart(el, {
          width:  el.clientWidth,
          height,
          layout: {
            background: { type: ColorType.Solid, color: C.surface },
            textColor: C.textSec,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: C.border, style: LineStyle.Dashed },
            horzLines: { color: C.border, style: LineStyle.Dashed },
          },
          rightPriceScale: { borderColor: C.border },
          timeScale:       { borderColor: C.border, timeVisible: false, secondsVisible: false },
          crosshair: {
            mode: 1,
            vertLine: { color: C.textTer, style: LineStyle.Dotted },
            horzLine: { color: C.textTer, style: LineStyle.Dotted },
          },
        });
        chartRef.current = chart;

        const candles = chart.addCandlestickSeries({
          upColor: C.pos, downColor: C.neg,
          borderUpColor: C.pos, borderDownColor: C.neg,
          wickUpColor: C.pos, wickDownColor: C.neg,
        });
        const rows = payload.rows.map(r => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));
        candles.setData(rows);

        if (payload.rows[0]?.volume != null) {
          const volSeries = chart.addHistogramSeries({
            priceFormat: { type: "volume" },
            priceScaleId: "vol",
          });
          chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
          volSeries.setData(payload.rows.map(r => ({
            time: r.time,
            value: r.volume,
            color: r.close >= r.open ? "rgba(76,175,125,0.30)" : "rgba(224,92,92,0.30)",
          })));
        }

        chart.timeScale().fitContent();
        setState({ status: "ok" });

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect?.width;
            if (w && chartRef.current) chartRef.current.applyOptions({ width: w });
          });
          resizeObserver.observe(el);
        }
      } catch {
        if (!cancelled) setState({ status: "error", reason: "Chart unavailable" });
      }
    })();

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [ticker, height, days, isValid]);

  if (state.status === "error") return <ChartFallback ticker={ticker} height={height} reason={state.reason} />;

  const tvHref = tvSymbolUrl(ticker);
  return (
    <div style={{ position: "relative", height, width: "100%", borderRadius: 10, overflow: "hidden", background: C.surface }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {tvHref && (
        <a href={tvHref} target="_blank" rel="noopener noreferrer"
          title={`Open ${ticker} on TradingView`}
          className="chart-tv-badge"
          style={{ position: "absolute", top: 8, left: 10, zIndex: 2, fontSize: 11, padding: "2px 6px", borderRadius: 5, background: "rgba(23,23,26,0.7)", textDecoration: "none" }}>
          {ticker} <span style={{ opacity: 0.5 }}>↗</span>
        </a>
      )}
      {state.status === "loading" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface }}>
          <LoadingLine message="Loading chart…" />
        </div>
      )}
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser  = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={isUser ? "chat-bubble-user" : "chat-bubble-assistant"} style={{ position: "relative" }}>
      <div>
        {msg.content}
        {!isUser && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            {msg.sources?.map((s, i) => (
              <span key={i} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textSec }}>
                {s}
              </span>
            ))}
            {msg.responseTime && (
              <span style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.textTer }}>
                {msg.responseTime}s
              </span>
            )}
            <button
              onClick={handleCopy}
              title="Copy response"
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: copied ? C.pos : C.textTer, padding: "2px 4px", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontFamily: "'DM Sans',sans-serif", transition: "color 150ms" }}
            >
              {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auth screen ───────────────────────────────────────────
function AuthModal({ onSuccess }) {
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

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

  const initial = email?.length > 0 ? email[0].toUpperCase() : "F";

  return (
    <div className="auth-page">
      <div className="auth-card fade-up">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: C.surface2, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <Aperture size={28} color={C.text} />
          </div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.accent }}>Fintrest</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec, marginTop: 4 }}>Money, made clear.</div>
        </div>

        <div className="auth-tabs">
          {[["login","Sign In"],["register","Create Account"]].map(([m, lbl]) => (
            <button key={m} className={`auth-tab${mode === m ? " active" : ""}`}
              onClick={() => { setMode(m); setError(""); }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Email</div>
            <input className="input-line" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Password</div>
            <input className="input-line" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password"
              onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          {error && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.neg }}>{error}</div>}
          <button className="auth-submit" onClick={submit} disabled={loading || !email || !password}>
            {loading ? "…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [windowW, setWindowW]   = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const isMobile  = windowW < 640;
  const isTablet  = windowW >= 640 && windowW < 1024;

  // Section state
  const [activeSection, setActiveSection] = useState("market");
  const [mobileTab, setMobileTab]         = useState("market"); // mobile bottom nav highlight

  // Auth
  const devBypass = process.env.REACT_APP_DEV_BYPASS === "1";
  const [userState, setUserState] = useState(devBypass ? { email: "dev@local" } : getUser());
  const [showAuth, setShowAuth]   = useState(devBypass ? false : !getToken());
  const handleAuthSuccess = () => { setUserState(getUser()); setShowAuth(false); };
  const handleLogout      = () => { removeToken(); removeUser(); setUserState(null); setShowAuth(true); };

  // Watchlist & market
  const [watchlist, setWatchlist]           = useState(WATCHLIST_DEFAULT);
  const [selectedStock, setSelectedStock]   = useState(WATCHLIST_DEFAULT[0]);
  const [chartDays, setChartDays]           = useState(180);

  // Chat
  const [messages, setMessages]   = useState([mkMsg("assistant", "Hi, I'm Fintrest. Ask me about NSE/BSE stocks, mutual funds, SIPs, or anything else about investing in India — and I'll tell you what the numbers actually say.", { sources: [] })]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [timeRange, setTimeRange] = useState("7d");
  const bottomRef                 = useRef(null);

  // Portfolio (simple — ticker-only, used by chat flow)
  const [portfolio, setPortfolio]               = useState([]);
  const [portfolioInput, setPortfolioInput]     = useState("");
  const [portfolioData, setPortfolioData]       = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Portfolio (full analysis — holdings with qty + avg price)
  const [holdings, setHoldings]               = useState([]);
  const [holdingInput, setHoldingInput]       = useState({ ticker: "", quantity: "", avgPrice: "" });
  const [holdingError, setHoldingError]       = useState("");
  const [analysisResult, setAnalysisResult]   = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [portMode, setPortMode]               = useState("analyze"); // "analyze" | "simple"

  // Compare
  const [compareA, setCompareA]             = useState("");
  const [compareB, setCompareB]             = useState("");
  const [compareData, setCompareData]       = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Alerts
  const [alerts, setAlerts]                   = useState([]);
  const [alertTicker, setAlertTicker]         = useState("");
  const [alertThreshold, setAlertThreshold]   = useState("");
  const [alertDirection, setAlertDirection]   = useState("above");
  const [alertCreating, setAlertCreating]     = useState(false);
  const [alertError, setAlertError]           = useState("");
  const [triggeredNotifs, setTriggeredNotifs] = useState([]);

  // Sentiment
  const [sentiments, setSentiments]             = useState({});
  const [sentimentLoading, setSentimentLoading] = useState({});
  const fetchedSentiments                       = useRef(new Set());

  // News
  const [newsData, setNewsData]       = useState({});
  const [newsLoading, setNewsLoading] = useState({});
  const fetchedNews                   = useRef(new Set());
  const fetchedNewsOrder              = useRef([]);  // LRU eviction for fetchedNews

  // ── Effects ────────────────────────────────────────────
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
        const hist = (data.messages || []).map(m => mkMsg(m.role, m.content, { sources: [] }));
        if (hist.length) setMessages([mkMsg("assistant", "Welcome back. Resuming your previous conversation.", { sources: [] }), ...hist]);
      } catch {}
    })();
  }, []);

  // Enrich watchlist prices — skip refresh when tab hidden
  useEffect(() => {
    const fetchPrices = async () => {
      if (document.hidden) return;
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
          if (!live || live.error || live.price == null) return stock;
          return { ...stock, price: live.price, change: live.change_5d_pct ?? null, base: live.price, sparkline: live.sparkline ?? null };
        });
        setWatchlist(updated);
        setSelectedStock(prev => updated.find(s => s.ticker === prev.ticker) ?? prev);
        items.forEach(item => {
          if (item.sentiment_score != null) {
            fetchedSentiments.current.add(item.ticker);
            setSentiments(prev => ({ ...prev, [item.ticker]: { ticker: item.ticker, score: item.sentiment_score, label: item.sentiment_label, headline_count: 0, headlines: [] } }));
          }
        });
      } catch {}
    };
    fetchPrices();
    const t = setInterval(fetchPrices, 60_000);
    return () => clearInterval(t);
  }, []);

  const fetchSentiment = useCallback(async (ticker, name = "") => {
    if (fetchedSentiments.current.has(ticker)) return;
    fetchedSentiments.current.add(ticker);
    setSentimentLoading(prev => ({ ...prev, [ticker]: true }));
    try {
      const res  = await fetch(`${API_URL}/sentiment/${ticker}?company=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSentiments(prev => ({ ...prev, [ticker]: normalizeSentimentPayload(data) }));
    } catch {
      fetchedSentiments.current.delete(ticker);
      setSentiments(prev => ({ ...prev, [ticker]: null }));
    }
    setSentimentLoading(prev => ({ ...prev, [ticker]: false }));
  }, []);

  const fetchNews = useCallback(async (ticker, name = "") => {
    if (fetchedNews.current.has(ticker)) return;
    // Evict oldest when over 50 unique tickers
    if (fetchedNewsOrder.current.length >= 50) {
      const evict = fetchedNewsOrder.current.shift();
      fetchedNews.current.delete(evict);
    }
    fetchedNews.current.add(ticker);
    fetchedNewsOrder.current.push(ticker);
    setNewsLoading(prev => ({ ...prev, [ticker]: true }));
    try {
      const res  = await fetch(`${API_URL}/news/${ticker}?company=${encodeURIComponent(name)}`);
      const data = await res.json();
      setNewsData(prev => ({ ...prev, [ticker]: data }));
    } catch {
      fetchedNews.current.delete(ticker);
      fetchedNewsOrder.current = fetchedNewsOrder.current.filter(t => t !== ticker);
      setNewsData(prev => ({ ...prev, [ticker]: null }));
    }
    setNewsLoading(prev => ({ ...prev, [ticker]: false }));
  }, []);

  useEffect(() => { watchlist.forEach(s => fetchSentiment(s.ticker, s.name)); }, [watchlist, fetchSentiment]);
  useEffect(() => {
    fetchSentiment(selectedStock.ticker, selectedStock.name);
    fetchNews(selectedStock.ticker, selectedStock.name);
  }, [selectedStock.ticker, fetchSentiment, fetchNews]);

  // Alert polling — pauses when tab hidden to avoid wasted requests
  useEffect(() => {
    const poll = async () => {
      if (document.hidden) return;
      const sid = getSessionId();
      if (!sid) return;
      try {
        const res  = await fetch(`${API_URL}/check_alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.triggered?.length) { setTriggeredNotifs(prev => [...prev, ...data.triggered]); fetchAlerts(); }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 300_000);
    return () => clearInterval(t);
  }, []);

  // ── Handlers ───────────────────────────────────────────
  const fetchAlerts = async () => {
    const sid = getSessionId();
    if (!sid) return;
    try {
      const res  = await fetch(`${API_URL}/get_alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {}
  };

  const createAlert = async () => {
    const ticker    = alertTicker.toUpperCase().trim();
    const threshold = parseFloat(alertThreshold);
    if (!ticker || !Number.isFinite(threshold) || threshold <= 0) { setAlertError("Enter a valid ticker and positive price threshold."); return; }
    setAlertError(""); setAlertCreating(true);
    try {
      const sid = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/create_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, ticker, threshold, direction: alertDirection }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAlertTicker(""); setAlertThreshold(""); await fetchAlerts();
    } catch { setAlertError("Failed to create alert. Please try again."); }
    setAlertCreating(false);
  };

  const deleteAlert = async (id) => {
    const sid = getSessionId();
    if (!sid) return;
    try {
      await fetch(`${API_URL}/delete_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, alert_id: id }) });
      await fetchAlerts();
    } catch {}
  };

  const addToPortfolio      = (t) => { const v = t.trim().toUpperCase(); if (v) setPortfolio(prev => prev.includes(v) ? prev : [...prev, v]); };
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
      const raw = await res.json();
      console.debug("[compare]", ta, tb, raw);
      const data = normalizeComparePayload(raw, ta, tb);
      if (data.session_id) setSessionId(data.session_id);
      setCompareData(data);
      fetchSentiment(ta); fetchSentiment(tb);
    } catch { setCompareData({ error: "Comparison failed." }); }
    setCompareLoading(false);
  };

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return;
    const lower       = question.toLowerCase();
    const isCompare   = lower.includes(" vs ") || lower.includes("compare ");
    const isPortfolio = lower.includes("portfolio") || lower.includes("analyze my");
    const isForex     = /\b(usd|eur|gbp|jpy|inr|cny|forex|currency|exchange rate|rupee|dollar|euro|pound)\b/.test(lower) && lower.includes("rate");
    setLoading(true);
    setMessages(prev => { const next = [...prev, mkMsg("user", question)]; return next.length > 100 ? next.slice(-100) : next; });
    setInput("");
    // Navigate to chat on mobile
    setMobileTab("chat");
    setActiveSection("chat");

    const sid      = getSessionId() || await startSession();
    let endpoint   = "/ask";
    if (isCompare)        endpoint = "/compare/from-chat";
    else if (isPortfolio) endpoint = "/portfolio/from-chat";
    else if (isForex)     endpoint = "/forex/from-chat";

    try {
      const res  = await fetch(`${API_URL}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, query: question, session_id: sid, time_range: timeRange }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages(prev => [...prev, mkMsg("assistant", data?.detail || data?.error || `Request failed (${res.status}).`, { sources: [] })]);
      } else {
        if (data.session_id) setSessionId(data.session_id);
        if (isCompare && data.ticker_a) {
          const normalized = normalizeComparePayload(data, data.ticker_a, data.ticker_b);
          setCompareA(normalized.ticker_a); setCompareB(normalized.ticker_b); setCompareData(normalized);
          setMessages(prev => [...prev, mkMsg("assistant", normalized.verdict || "Comparison data loaded.", { sources: ["Yahoo Finance"] })]);
        } else if (isPortfolio && data.tickers) {
          setPortfolio(data.tickers); setPortfolioData(data);
          setMessages(prev => [...prev, mkMsg("assistant", data.summary, { sources: ["Yahoo Finance"] })]);
        } else {
          const answer = typeof data.answer === "string" ? data.answer : data.detail || data.error || "No response received.";
          setMessages(prev => [...prev, mkMsg("assistant", answer, { sources: data.sources || [], responseTime: data.response_time })]);
        }
      }
    } catch {
      setMessages(prev => [...prev, mkMsg("assistant", "Connection error.", { sources: [] })]);
    }
    setLoading(false);
  };

  const handleNewChat = async () => {
    await clearSession();
    setMessages([mkMsg("assistant", "New conversation started. What would you like to know?", { sources: [] })]);
  };

  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setActiveSection("market");
    if (isMobile) setMobileTab("market");
  };

  const activeAlerts    = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  // ── Sidebar ────────────────────────────────────────────
  const sidebarCollapsed = isTablet;
  const userInitial = userState?.email?.length > 0 ? userState.email[0].toUpperCase() : "?";

  function Sidebar() {
    return (
      <div className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="sidebar-brand">
          <Aperture size={24} color={C.text} />
          <span className="sidebar-brand-name">Fintrest</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ id, label, Icon: Icon_ }) => (
            <button key={id}
              className={`nav-item${activeSection === id ? " active" : ""}`}
              onClick={() => { setActiveSection(id); if (MORE_SECTIONS.includes(id) && isMobile) setMobileTab("more"); }}
              title={sidebarCollapsed ? label : undefined}>
              <Icon_ size={18} />
              <span className="nav-item-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-avatar">{userInitial}</div>
          <div className="sidebar-email">{userState?.email || ""}</div>
          <button className="sidebar-logout" onClick={handleLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Mobile bottom nav ─────────────────────────────────
  function MobileNav() {
    return (
      <div className="mobile-nav">
        {MOBILE_TABS.map(({ id, label, Icon: Icon_ }) => (
          <button key={id} className={`mobile-nav-btn${mobileTab === id ? " active" : ""}`}
            onClick={() => {
              setMobileTab(id);
              if (id === "more") {
                if (!MORE_SECTIONS.includes(activeSection)) setActiveSection("compare");
              } else {
                setActiveSection(id);
              }
              if (id === "alerts" || (id === "more" && activeSection === "alerts")) fetchAlerts();
            }}>
            <Icon_ size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    );
  }

  // ── Market view ────────────────────────────────────────
  function MarketView() {
    const stockDetailWidth = isMobile ? "100%" : "calc(100% - 280px)";
    return (
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        {/* Stock list */}
        {!isMobile && (
          <div style={{ width: 280, minWidth: 280, borderRight: `1px solid ${C.border}`, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {watchlist.map((s, idx) => (
              <StockCard key={s.ticker} stock={s}
                isSelected={selectedStock.ticker === s.ticker}
                onClick={() => handleSelectStock(s)}
                sentiment={sentiments[s.ticker] ?? null}
                sentimentLoading={sentimentLoading[s.ticker] ?? false}
              />
            ))}
          </div>
        )}

        {/* Chart + detail */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stock header */}
          <div className="card" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  {selectedStock.ticker} · {selectedStock.type}
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: C.text, marginBottom: 8 }}>{selectedStock.name}</div>
                <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 36, color: C.text, lineHeight: 1 }}>
                  {selectedStock.price == null ? "—" : `${currencySymbol(selectedStock.type)}${selectedStock.price.toLocaleString()}`}
                </div>
              </div>
              <div style={{ textAlign: "right", paddingTop: 4 }}>
                {selectedStock.change != null && (
                  <span className={(selectedStock.change ?? 0) >= 0 ? "pill-pos" : "pill-neg"}>
                    {(selectedStock.change ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(selectedStock.change ?? 0).toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            {/* Time range pills */}
            <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
              {TIME_RANGES.map(tr => (
                <button key={tr.label} className={`time-range-pill${chartDays === tr.days ? " active" : ""}`}
                  onClick={() => setChartDays(tr.days)}>
                  {tr.label}
                </button>
              ))}
            </div>

            <TradingViewChart ticker={selectedStock.ticker} height={isMobile ? 180 : 240} days={chartDays} />
          </div>

          <SentimentGauge ticker={selectedStock.ticker} sentiment={sentiments[selectedStock.ticker] ?? null} loading={sentimentLoading[selectedStock.ticker] ?? false} />
          <NewsFeed ticker={selectedStock.ticker} news={newsData[selectedStock.ticker] ?? null} loading={newsLoading[selectedStock.ticker] ?? false} />

          {/* Suggestions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="btn-ghost" style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20 }} onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Chat view ──────────────────────────────────────────
  function ChatView() {
    return (
      <div className="chat-wrap">
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: C.text }}>Fintrest Advisor</div>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={handleNewChat} disabled={loading}>+ New conversation</button>
        </div>
        <div className="chat-messages">
          {messages.map((msg) => <ChatBubble key={msg._id} msg={msg} />)}
          {loading && (
            <div className="chat-bubble-assistant">
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[0.1, 0.2, 0.3].map(d => (
                  <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: C.textSec, animation: `fadeUp 0.8s ${d}s ease-in-out infinite alternate` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-bar">
          <input className="chat-input-field" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about any NSE/BSE stock or market trend…" />
          <button className="chat-send-btn" onClick={() => sendMessage(input)} disabled={loading}>
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Watchlist view ────────────────────────────────────
  function WatchlistView() {
    return (
      <div style={{ height: "100%", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.text }}>Watchlist</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec, marginTop: 4 }}>Live prices refresh every 60 seconds.</div>
        </div>
        <WatchlistTable watchlist={watchlist} sentiments={sentiments} sentimentLoading={sentimentLoading} onSelect={handleSelectStock} />
      </div>
    );
  }

  // ── Compare view ──────────────────────────────────────
  function CompareView() {
    const sideLayout = !isMobile && compareData && !compareData.error && compareData.ticker_a;
    return (
      <div style={{ height: "100%", overflowY: "auto", padding: isMobile ? 16 : 24 }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.text, marginBottom: 20 }}>Compare</div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr", gap: 12, marginBottom: 16 }}>
          <input className="input-box" value={compareA} onChange={e => setCompareA(e.target.value.toUpperCase())} placeholder="TICKER A — e.g. RELIANCE.NS" />
          {!isMobile && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Serif Display',serif", fontSize: 20, color: C.border, padding: "0 4px" }}>VS</div>}
          <input className="input-box" value={compareB} onChange={e => setCompareB(e.target.value.toUpperCase())} placeholder="TICKER B — e.g. TCS.NS" />
        </div>

        <button className="btn-gold" style={{ width: "100%", marginBottom: 20 }} disabled={compareLoading || !compareA || !compareB} onClick={() => runComparison()}>
          {compareLoading ? "Fetching market data…" : "Compare"}
        </button>

        {/* Quick picks */}
        <div className="label" style={{ marginBottom: 10 }}>Quick picks</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
          {[
            { label: "Reliance vs TCS",    a: "RELIANCE.NS",  b: "TCS.NS"        },
            { label: "HDFC vs ICICI",      a: "HDFCBANK.NS",  b: "ICICIBANK.NS"  },
            { label: "Infosys vs Wipro",   a: "INFY.NS",      b: "WIPRO.NS"      },
            { label: "SBI vs Kotak",       a: "SBIN.NS",      b: "KOTAKBANK.NS"  },
            { label: "Bajaj vs M&M",       a: "BAJFINANCE.NS",b: "M&M.NS"        },
            { label: "Adani vs Tata",      a: "ADANIENT.NS",  b: "TATAMOTORS.NS" },
          ].map(pick => (
            <button key={pick.label} className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20 }}
              disabled={compareLoading}
              onClick={() => { setCompareA(pick.a); setCompareB(pick.b); runComparison(pick.a, pick.b); }}>
              {pick.label}
            </button>
          ))}
        </div>

        {compareData?.error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.neg }}>{compareData.error}</span>
            <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => runComparison()}>Retry</button>
          </div>
        )}

        {compareData && !compareData.error && compareData.ticker_a && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Charts side by side */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.textSec, marginBottom: 10 }}>{compareData.ticker_a}</div>
                <TradingViewChart ticker={compareData.ticker_a} height={180} days={chartDays} />
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.textSec, marginBottom: 10 }}>{compareData.ticker_b}</div>
                <TradingViewChart ticker={compareData.ticker_b} height={180} days={chartDays} />
              </div>
            </div>
            {/* Comparison table */}
            <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />
            {/* Verdict */}
            {compareData.verdict && (
              <div className="card card-accent">
                <div className="label" style={{ marginBottom: 10 }}>Verdict</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{compareData.verdict}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Portfolio view ────────────────────────────────────
  function PortfolioView() {
    const SEVERITY_COLOR = { high: C.neg, medium: C.neutral, low: C.pos };
    const SEVERITY_BG    = { high: "#2A1515", medium: "#1E1A0F", low: "#0F1E14" };

    const addHolding = () => {
      const t = holdingInput.ticker.trim().toUpperCase();
      const q = parseInt(holdingInput.quantity, 10);
      const p = parseFloat(holdingInput.avgPrice);
      if (!t)            return setHoldingError("Ticker is required.");
      if (!q || q <= 0)  return setHoldingError("Quantity must be a positive number.");
      if (!p || p <= 0)  return setHoldingError("Avg buy price must be a positive number.");
      if (holdings.some(h => h.ticker === t)) return setHoldingError(`${t} already in holdings.`);
      setHoldingError("");
      setHoldings(prev => [...prev, { ticker: t, quantity: q, avg_buy_price: p }]);
      setHoldingInput({ ticker: "", quantity: "", avgPrice: "" });
    };

    const removeHolding = (ticker) => setHoldings(prev => prev.filter(h => h.ticker !== ticker));

    const runAnalysis = async () => {
      if (!holdings.length) return;
      setAnalysisLoading(true);
      try {
        const res  = await fetch(`${API_URL}/analyze-portfolio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdings, user_context: "" }),
        });
        const data = await res.json();
        setAnalysisResult(data);
      } catch {
        setAnalysisResult({ error: "Portfolio analysis failed. Try again." });
      }
      setAnalysisLoading(false);
    };

    const sym = (ticker) => ticker && (ticker.endsWith(".NS") || ticker.endsWith(".BO")) ? "₹" : "$";
    const fmtVal = (v) => v >= 1e7 ? `₹${(v / 1e7).toFixed(2)}Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)}L` : `₹${v.toLocaleString()}`;

    return (
      <div style={{ height: "100%", overflowY: "auto", padding: isMobile ? 16 : 24 }}>

        {/* Header + mode toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.text }}>Portfolio Intelligence</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec, marginTop: 2 }}>Add your holdings → get risk alerts + AI brief</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["analyze", "Full Analysis"], ["simple", "Quick"]].map(([id, label]) => (
              <button key={id} onClick={() => setPortMode(id)}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${portMode === id ? C.accent : C.border}`, background: portMode === id ? `${C.accent}18` : "transparent", color: portMode === id ? C.accent : C.textSec, fontFamily: "'DM Sans',sans-serif", fontSize: 12, cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── FULL ANALYSIS MODE ── */}
        {portMode === "analyze" && (
          <>
            {/* Holdings input form */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 12 }}>Add Holding</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <div>
                  <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>Ticker</div>
                  <input className="input-box" value={holdingInput.ticker}
                    onChange={e => setHoldingInput(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                    onKeyDown={e => e.key === "Enter" && addHolding()}
                    placeholder="e.g. INFY.NS" />
                </div>
                <div>
                  <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>Quantity</div>
                  <input className="input-box" type="number" min="1" value={holdingInput.quantity}
                    onChange={e => setHoldingInput(p => ({ ...p, quantity: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addHolding()}
                    placeholder="100" />
                </div>
                <div>
                  <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>Avg Buy Price</div>
                  <input className="input-box" type="number" min="0.01" step="0.01" value={holdingInput.avgPrice}
                    onChange={e => setHoldingInput(p => ({ ...p, avgPrice: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addHolding()}
                    placeholder="1500.00" />
                </div>
                <button className="btn-gold" style={{ padding: "0 16px", height: 40 }} onClick={addHolding}>
                  <Plus size={16} />
                </button>
              </div>
              {holdingError && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.neg, marginTop: 8 }}>
                  {holdingError}
                </div>
              )}
            </div>

            {/* Holdings table */}
            {holdings.length > 0 && (
              <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Ticker", "Qty", "Avg Price", ""].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textSec, fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h, i) => (
                      <tr key={h.ticker} style={{ borderBottom: i < holdings.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.text }}>{h.ticker}</td>
                        <td style={{ padding: "10px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>{h.quantity.toLocaleString()}</td>
                        <td style={{ padding: "10px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>{sym(h.ticker)}{h.avg_buy_price.toLocaleString()}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <button onClick={() => removeHolding(h.ticker)} style={{ background: "none", border: "none", color: C.textTer, cursor: "pointer", padding: 4, display: "flex" }}
                            onMouseEnter={e => e.currentTarget.style.color = C.neg}
                            onMouseLeave={e => e.currentTarget.style.color = C.textTer}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {holdings.length > 0 && (
              <button className="btn-gold" style={{ width: "100%", marginBottom: 24 }}
                disabled={analysisLoading} onClick={runAnalysis}>
                {analysisLoading ? "Analyzing portfolio…" : `Analyze ${holdings.length} Holding${holdings.length > 1 ? "s" : ""}`}
              </button>
            )}

            {holdings.length === 0 && !analysisResult && (
              <EmptyState Icon={PieChart} title="No holdings added." subtitle="Enter ticker, quantity, and avg buy price above to get your AI portfolio brief." />
            )}

            {analysisResult?.error && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.neg }}>{analysisResult.error}</span>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={runAnalysis}>Retry</button>
              </div>
            )}

            {/* Analysis results */}
            {analysisResult && !analysisResult.error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Summary cards row */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10 }}>
                  <div className="card" style={{ textAlign: "center" }}>
                    <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>Total Value</div>
                    <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: C.text }}>
                      {fmtVal(analysisResult.total_value_inr)}
                    </div>
                  </div>
                  <div className="card" style={{ textAlign: "center" }}>
                    <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>Holdings</div>
                    <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: C.text }}>
                      {analysisResult.holdings_summary?.length ?? 0}
                    </div>
                  </div>
                  <div className="card" style={{ textAlign: "center" }}>
                    <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>Risk Flags</div>
                    <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: analysisResult.risk_flags?.length ? C.neg : C.pos }}>
                      {analysisResult.risk_flags?.length ?? 0}
                    </div>
                  </div>
                </div>

                {/* Risk flags */}
                {analysisResult.risk_flags?.length > 0 && (
                  <div>
                    <div className="label" style={{ marginBottom: 10 }}>Risk Flags</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {analysisResult.risk_flags.map((flag, i) => (
                        <div key={i} style={{ background: SEVERITY_BG[flag.severity] || C.surface, border: `1px solid ${SEVERITY_COLOR[flag.severity] || C.border}33`, borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 600, color: SEVERITY_COLOR[flag.severity] || C.textSec, textTransform: "uppercase", letterSpacing: "0.06em" }}>{flag.severity}</span>
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.text }}>{flag.flag}</span>
                          </div>
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textSec }}>→ {flag.action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Narrative Brief */}
                {analysisResult.narrative_brief && (
                  <div className="card card-accent">
                    <div className="label" style={{ marginBottom: 10 }}>Weekly Intelligence Brief — Fintrest AI</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: C.text, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                      {analysisResult.narrative_brief}
                    </div>
                    {analysisResult.response_time && (
                      <div style={{ marginTop: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textTer }}>
                        Generated in {analysisResult.response_time}s
                      </div>
                    )}
                  </div>
                )}

                {/* Holdings breakdown */}
                {analysisResult.holdings_summary?.length > 0 && (
                  <>
                    <div className="label">Holdings Breakdown</div>
                    <div className="port-grid">
                      {analysisResult.holdings_summary.map((item, idx) => {
                        const isUp = (item.pnl_pct ?? 0) >= 0;
                        return (
                          <div key={item.ticker} className={`port-mini-card stagger-${Math.min(idx + 1, 6)}`}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.textSec }}>{item.ticker}</div>
                              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: C.textTer }}>{item.weight?.toFixed(1)}%</span>
                            </div>
                            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: C.text }}>
                              {sym(item.ticker)}{item.current_price?.toLocaleString() ?? "—"}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              <span className={isUp ? "pill-pos" : "pill-neg"} style={{ fontSize: 10, display: "inline-flex" }}>
                                {isUp ? "▲" : "▼"} {Math.abs(item.pnl_pct ?? 0).toFixed(2)}%
                              </span>
                              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: C.textTer }}>
                                {item.quantity?.toLocaleString()} shares
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── SIMPLE / QUICK MODE (existing ticker-only flow) ── */}
        {portMode === "simple" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input className="input-box" style={{ flex: 1 }} value={portfolioInput}
                onChange={e => setPortfolioInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { addToPortfolio(portfolioInput); setPortfolioInput(""); } }}
                placeholder="Add ticker — e.g. AAPL, BTC, INFY.NS" />
              <button className="btn-gold" style={{ padding: "0 18px" }} onClick={() => { addToPortfolio(portfolioInput); setPortfolioInput(""); }}>
                <Plus size={18} />
              </button>
            </div>
            {portfolio.length > 0 && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {portfolio.map(t => (
                    <div key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 12px 4px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.text }}>
                      {t}
                      <button onClick={() => removeFromPortfolio(t)} style={{ background: "none", border: "none", color: C.textSec, padding: 0, display: "flex", alignItems: "center", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.color = C.neg}
                        onMouseLeave={e => e.currentTarget.style.color = C.textSec}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn-gold" style={{ width: "100%", marginBottom: 24 }} disabled={portfolioLoading} onClick={() => runPortfolioAnalysis()}>
                  {portfolioLoading ? "Analyzing portfolio…" : "Analyze Portfolio"}
                </button>
              </>
            )}
            {portfolio.length === 0 && !portfolioData && (
              <EmptyState Icon={PieChart} title="No tickers added." subtitle="Add tickers above to begin quick portfolio analysis." />
            )}
            {portfolioData?.error && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.neg }}>{portfolioData.error}</span>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => runPortfolioAnalysis()}>Retry</button>
              </div>
            )}
            {portfolioData && !portfolioData.error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {portfolioData.summary && (
                  <div className="card card-accent">
                    <div className="label" style={{ marginBottom: 10 }}>AI Analysis</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{portfolioData.summary}</div>
                  </div>
                )}
                {portfolioData.breakdown && Object.keys(portfolioData.breakdown).length > 0 && (
                  <>
                    <div className="label">Holdings</div>
                    <div className="port-grid">
                      {Object.entries(portfolioData.breakdown).map(([ticker, info], idx) => {
                        const price  = info?.stock?.price ?? info?.price ?? null;
                        const change = info?.stock?.five_day_change ?? info?.change ?? null;
                        const isUp   = (change ?? 0) >= 0;
                        return (
                          <div key={ticker} className={`port-mini-card stagger-${Math.min(idx + 1, 6)}`}>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.textSec, marginBottom: 4 }}>{ticker}</div>
                            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: C.text }}>
                              {price != null ? `${sym(ticker)}${price.toLocaleString()}` : "—"}
                            </div>
                            {change != null && (
                              <span className={isUp ? "pill-pos" : "pill-neg"} style={{ fontSize: 10, marginTop: 6, display: "inline-flex" }}>
                                {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Alerts view ───────────────────────────────────────
  function AlertsView() {
    useEffect(() => { fetchAlerts(); setAlertError(""); }, []);
    return (
      <div style={{ height: "100%", overflowY: "auto", padding: isMobile ? 16 : 24 }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.text, marginBottom: 20 }}>Price Alerts</div>

        {/* Create form */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="label" style={{ marginBottom: 16 }}>New Alert</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 8, fontSize: 10 }}>Ticker</div>
              <input className="input-box" value={alertTicker} onChange={e => setAlertTicker(e.target.value.toUpperCase())} placeholder="e.g. RELIANCE.NS" />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 8, fontSize: 10 }}>Price Threshold</div>
              <input className="input-box" value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)} placeholder="0.00" type="number" min="0" step="any" />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 8, fontSize: 10 }}>Direction</div>
              <div className="dir-toggle">
                {["above", "below"].map(dir => (
                  <button key={dir} className={`dir-toggle-btn${alertDirection === dir ? " active" : ""}`} onClick={() => setAlertDirection(dir)}>{dir}</button>
                ))}
              </div>
            </div>
            {alertError && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.neg }}>{alertError}</div>}
            <button className="btn-gold" onClick={createAlert} disabled={alertCreating}>
              {alertCreating ? "Creating…" : "+ Add Alert"}
            </button>
          </div>
        </div>

        {/* Active alerts */}
        {activeAlerts.length > 0 ? (
          <>
            <div className="label" style={{ marginBottom: 10 }}>Active Alerts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {activeAlerts.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  <div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.text }}>{a.ticker}</span>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textSec, marginLeft: 10 }}>
                      price {a.direction} {a.threshold}
                    </span>
                  </div>
                  <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "none", color: C.textTer, cursor: "pointer", padding: 4, display: "flex", transition: "color 150ms" }}
                    onMouseEnter={e => e.currentTarget.style.color = C.neg}
                    onMouseLeave={e => e.currentTarget.style.color = C.textTer}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState Icon={Bell} title="No alerts set." subtitle="Set a price threshold above to get notified." />
        )}

        {/* Triggered alerts */}
        {triggeredAlerts.length > 0 && (
          <>
            <div className="label" style={{ marginBottom: 10 }}>Triggered</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {triggeredAlerts.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", opacity: 0.65 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.text, textDecoration: "line-through" }}>{a.ticker}</span>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textSec }}>triggered at {a.threshold}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Mobile "More" sub-nav ─────────────────────────────
  function MobileMoreNav() {
    const sections = [{ id: "compare", label: "Compare" }, { id: "portfolio", label: "Portfolio" }, { id: "alerts", label: "Alerts" }];
    return (
      <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
        {sections.map(({ id, label }) => (
          <button key={id} className={`btn-ghost${activeSection === id ? " active" : ""}`}
            style={{ flex: 1, padding: "8px 0", fontSize: 13, textAlign: "center", background: activeSection === id ? C.surface2 : "transparent", color: activeSection === id ? C.text : C.textSec, borderColor: activeSection === id ? C.borderA : C.border }}
            onClick={() => { setActiveSection(id); if (id === "alerts") fetchAlerts(); }}>
            {label}
          </button>
        ))}
      </div>
    );
  }

  // ── Render active section ──────────────────────────────
  function renderSection() {
    switch (activeSection) {
      case "market":    return <MarketView />;
      case "chat":      return <ChatView />;
      case "watchlist": return <WatchlistView />;
      case "compare":   return <CompareView />;
      case "portfolio": return <PortfolioView />;
      case "alerts":    return <AlertsView />;
      default:          return <MarketView />;
    }
  }

  // ── Root render ────────────────────────────────────────
  return (
    <>
      {showAuth && <AuthModal onSuccess={handleAuthSuccess} />}

      {/* Triggered notifications */}
      {triggeredNotifs.length > 0 && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
          {triggeredNotifs.map((n, i) => (
            <div key={i} className="card fade-up" style={{ borderColor: C.accent, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.accent, marginBottom: 2 }}>{n.ticker}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textSec }}>Alert triggered at {n.threshold}</div>
              </div>
              <button onClick={() => setTriggeredNotifs(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.textTer, cursor: "pointer", padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, overflow: "hidden" }}>
        {/* Sidebar (non-mobile) */}
        {!isMobile && <Sidebar />}

        {/* Main area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Mobile "more" sub-nav */}
          {isMobile && mobileTab === "more" && <MobileMoreNav />}

          {/* Content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderSection()}
          </div>

          {/* Mobile bottom nav */}
          {isMobile && <MobileNav />}
        </div>
      </div>
    </>
  );
}
