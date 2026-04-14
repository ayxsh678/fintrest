import { useState, useRef, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const API_URL = process.env.REACT_APP_API_URL || "https://quantiq-go.onrender.com";

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
function TradingViewChart({ ticker, height = 220 }) {
  const ref = useRef(null);

  const tvSymbol = (t) => {
    const map = {
      BTC:  "BINANCE:BTCUSDT",
      ETH:  "BINANCE:ETHUSDT",
      SOL:  "BINANCE:SOLUSDT",
      BNB:  "BINANCE:BNBUSDT",
      DOGE: "BINANCE:DOGEUSDT",
    };
    if (map[t]) return map[t];
    if (t.endsWith(".NS")) return "NSE:" + t.replace(".NS", "");
    if (t.endsWith(".BO")) return "BSE:" + t.replace(".BO", "");
    return t.includes(":") ? t : `NASDAQ:${t}`;
  };

  useEffect(() => {
    if (!ref.current) return;

    while (ref.current.firstChild) {
      ref.current.removeChild(ref.current.firstChild);
    }

    const container = document.createElement("div");
    container.style.height = "100%";
    container.style.width  = "100%";
    ref.current.appendChild(container);

    const s    = document.createElement("script");
    s.src      = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.type     = "text/javascript";
    s.async    = true;
    s.innerHTML = JSON.stringify({
      autosize:            true,
      symbol:              tvSymbol(ticker),
      interval:            "D",
      timezone:            "Etc/UTC",
      theme:               "dark",
      style:               "1",
      locale:              "en",
      enable_publishing:   false,
      allow_symbol_change: false,
      calendar:            false,
      support_host:        "https://www.tradingview.com",
      backgroundColor:     "rgba(13,17,23,1)",
      gridColor:           "rgba(33,38,45,1)",
    });
    ref.current.appendChild(s);

    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [ticker]);

  // ✅ key on wrapper forces full React remount when ticker changes
  // ✅ ref on inner div so React doesn't conflict with key
  return (
    <div key={ticker} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}>
      <div ref={ref} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// ── Compare Table ───────────────────────────────────────
function CompareTable({ data, ticker_a, ticker_b }) {
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
        <div style={{ padding: "10px 10px", fontSize: 10, color: "#8b949e" }} />
        {[ticker_a, ticker_b].map(t => (
          <div key={t} style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#f7c843", fontWeight: 700 }}>{t}</div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: i < rows.length - 1 ? "1px solid #21262d" : "none", background: i % 2 === 0 ? "#0d1117" : "#0a0f16" }}>
          <div style={{ padding: "7px 10px", fontSize: 10, color: "#8b949e" }}>{row.label}</div>
          {[row.a, row.b].map((val, j) => (
            <div key={j} style={{ padding: "7px 8px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: row.label === "5D Change" ? (isDown(val) ? "#f85149" : "#3fb950") : "#e6edf3" }}>{val}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => active && payload?.length
  ? <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#e6edf3" }}>${payload[0].value.toLocaleString()}</div>
  : null;

// ── Stock Card ──────────────────────────────────────────
function StockCard({ stock, isSelected, onClick, sentiment, sentimentLoading }) {
  const data = generateChartData(stock.base);
  const isUp = stock.change >= 0;
  const ts   = TYPE_STYLES[stock.type] || TYPE_STYLES.US;
  return (
    <div onClick={onClick} style={{ background: isSelected ? "#161b22" : "#0d1117", border: `1px solid ${isSelected ? "#f7c843" : "#21262d"}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>{stock.ticker}</div>
            {stock.type && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, padding: "1px 6px", borderRadius: 4, background: ts.bg, color: ts.color }}>{stock.type}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#8b949e" }}>{stock.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
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
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#e6edf3", fontWeight: 700 }}>${stock.price?.toLocaleString() ?? "—"}</div>
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
            <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `$${v.toLocaleString()}`} />
            <Tooltip content={<CustomTooltip />} />
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
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Quantiq</div>
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
  const [activeTab, setActiveTab] = useState("watchlist");

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [userState, setUserState] = useState(getUser());
  const [showAuth, setShowAuth]   = useState(!getToken());
  const handleAuthSuccess = () => { setUserState(getUser()); setShowAuth(false); };
  const handleLogout      = () => { removeToken(); removeUser(); setUserState(null); setShowAuth(true); };

  const [watchlist, setWatchlist]               = useState(WATCHLIST_DEFAULT);
  const [selectedStock, setSelectedStock]       = useState(WATCHLIST_DEFAULT[0]);
  const [messages, setMessages]                 = useState([{ role: "assistant", content: "Hello! I'm Quantiq, your AI-powered financial advisor. Ask about US stocks, Indian stocks (NSE/BSE), or crypto.", sources: [] }]);
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
  const [triggeredNotifs, setTriggeredNotifs]   = useState([]);

  const [sentiments, setSentiments]             = useState({});
  const [sentimentLoading, setSentimentLoading] = useState({});
  const fetchedSentiments                       = useRef(new Set());

  const bottomRef = useRef(null);

  useEffect(() => { if (!getSessionId()) startSession(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const fetchPrices = async () => {
      const updated = await Promise.all(
        WATCHLIST_DEFAULT.map(async (stock) => {
          try {
            const res  = await fetch(`${API_URL}/stock/${stock.ticker}`);
            if (!res.ok) return stock;
            const json = await res.json();
            const raw  = typeof json.data === "string" ? json.data : "";
            const priceMatch = raw.match(/Current Price:\s*\$?([\d,.]+)/);
            const prevMatch  = raw.match(/Previous Close:\s*\$?([\d,.]+)/);
            const price  = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : null;
            const prev   = prevMatch  ? parseFloat(prevMatch[1].replace(/,/g, "")) : null;
            const change = (price !== null && prev !== null && prev !== 0)
              ? parseFloat(((price - prev) / prev * 100).toFixed(2))
              : null;
            return { ...stock, price, change, base: price ?? stock.base };
          } catch { return stock; }
        })
      );
      setWatchlist(updated);
      setSelectedStock(prev => updated.find(s => s.ticker === prev.ticker) ?? prev);
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

  useEffect(() => { watchlist.forEach(s => fetchSentiment(s.ticker, s.name)); }, [watchlist, fetchSentiment]);
  useEffect(() => { fetchSentiment(selectedStock.ticker, selectedStock.name); }, [selectedStock.ticker, fetchSentiment]);

  useEffect(() => {
    const poll = async () => {
      const sid = getSessionId();
      if (!sid) return;
      try {
        const res  = await fetch(`${API_URL}/check_alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
        const data = await res.json();
        if (data.triggered?.length) { setTriggeredNotifs(prev => [...prev, ...data.triggered]); fetchAlerts(); }
      } catch {}
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
    } catch {}
  };

  const createAlert = async () => {
    if (!alertTicker.trim() || !alertThreshold) return;
    setAlertCreating(true);
    try {
      const sid = getSessionId() || await startSession();
      await fetch(`${API_URL}/create_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, ticker: alertTicker.toUpperCase().trim(), threshold: parseFloat(alertThreshold), direction: alertDirection }) });
      setAlertTicker(""); setAlertThreshold(""); fetchAlerts();
    } catch {}
    setAlertCreating(false);
  };

  const deleteAlert = async (id) => {
    const sid = getSessionId();
    if (!sid) return;
    try {
      await fetch(`${API_URL}/delete_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, alert_id: id }) });
      fetchAlerts();
    } catch {}
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
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);

      if (isCompare && data.ticker_a) {
        setCompareA(data.ticker_a); setCompareB(data.ticker_b); setCompareData(data);
        setMessages(prev => [...prev, { role: "assistant", content: data.verdict, sources: ["Yahoo Finance"] }]);
      } else if (isPortfolio && data.tickers) {
        setPortfolio(data.tickers); setPortfolioData(data);
        setMessages(prev => [...prev, { role: "assistant", content: data.summary, sources: ["Yahoo Finance"] }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.answer || data.detail, sources: data.sources || [], responseTime: data.response_time }]);
      }
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Connection error.", sources: [] }]); }
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
      {activeTab === "watchlist" && (
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

      {activeTab === "compare" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={compareA} onChange={e => setCompareA(e.target.value.toUpperCase())} placeholder="Ticker A (e.g. RELIANCE.NS)"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
          <input value={compareB} onChange={e => setCompareB(e.target.value.toUpperCase())} placeholder="Ticker B (e.g. TCS.NS)"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
          <button onClick={() => runComparison()} disabled={compareLoading || !compareA || !compareB}
            style={{ background: "#f7c843", color: "#0d1117", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {compareLoading ? "..." : "Compare"}
          </button>
          {compareData && !compareData.error && (
            <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />
          )}
        </div>
      )}

      {activeTab === "portfolio" && (
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
        </div>
      )}

      {activeTab === "alerts" && (
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
      {!isMobile && <div style={{ padding: 15, borderBottom: "1px solid #21262d", fontWeight: 700 }}>Quantiq Advisor</div>}
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

        <header style={{ borderBottom: "1px solid #21262d", padding: "12px 32px", display: "flex", justifyContent: "space-between", background: "#0d1117" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#f7c843", padding: "4px 8px", borderRadius: 8, color: "#0d1117" }}>💹</div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Quantiq</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleNewChat} style={{ background: "#161b22", color: "#8b949e", border: "1px solid #21262d", padding: "6px 15px", borderRadius: 20 }}>+ New</button>
            {userState && <button onClick={handleLogout} style={{ color: "#f85149", background: "none", border: "none" }}>Sign Out</button>}
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
            <div style={{ display: "flex", borderTop: "1px solid #21262d", background: "#0d1117", padding: 10 }}>
              {["market", "chat", "watchlist", "more"].map(t => (
                <button key={t} onClick={() => setMobileTab(t)}
                  style={{ flex: 1, background: "none", border: "none", color: mobileTab === t ? "#f7c843" : "#8b949e", fontSize: 11, textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}