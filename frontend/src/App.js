import { useState, useRef, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const API_URL = "https://quantiq-go.onrender.com";

// ── Auth helpers ────────────────────────────────────────
const getToken = () => localStorage.getItem("quantiq_token");
const setToken = (t) => localStorage.setItem("quantiq_token", t);
const removeToken = () => localStorage.removeItem("quantiq_token");
const getUser = () => { try { return JSON.parse(localStorage.getItem("quantiq_user")); } catch { return null; } };
const setUser = (u) => localStorage.setItem("quantiq_user", JSON.stringify(u));
const removeUser = () => localStorage.removeItem("quantiq_user");

// ── Chart data ──────────────────────────────────────────
const generateChartData = (base, points = 30) => {
  let price = base;
  return Array.from({ length: points }, (_, i) => {
    price = price + (Math.random() - 0.48) * (base * 0.008);
    return { day: `D${i + 1}`, price: parseFloat(price.toFixed(2)) };
  });
};

const WATCHLIST = [
  { ticker: "AAPL",        name: "Apple Inc.",    price: 255.92, change: +2.86, base: 248,   type: "US"     },
  { ticker: "NVDA",        name: "NVIDIA Corp.",  price: 887.3,  change: +3.51, base: 860,   type: "US"     },
  { ticker: "RELIANCE.NS", name: "Reliance Ind.", price: 2987,   change: +1.24, base: 2950,  type: "India"  },
  { ticker: "TCS.NS",      name: "TCS",           price: 3842,   change: -0.87, base: 3900,  type: "India"  },
  { ticker: "BTC",         name: "Bitcoin",       price: 83200,  change: +2.14, base: 81000, type: "Crypto" },
  { ticker: "ETH",         name: "Ethereum",      price: 3820,   change: -1.05, base: 3900,  type: "Crypto" },
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

// ── Breakpoints ─────────────────────────────────────────
const getBreakpoint = (w) => {
  if (w < 768) return "mobile";
  if (w < 1100) return "tablet";
  return "desktop";
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
  const score = sentiment?.score ?? null;
  const label = sentiment?.label ?? "—";
  const color = sentimentColor(score);
  const count = sentiment?.headline_count ?? 0;
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
const getSessionId = () => localStorage.getItem("quantiq_session_id");
const setSessionId = (id) => localStorage.setItem("quantiq_session_id", id);
const removeSessionId = () => localStorage.removeItem("quantiq_session_id");
const startSession = async () => {
  try {
    const res = await fetch(`${API_URL}/session/new`, { method: "POST" });
    const data = await res.json();
    setSessionId(data.session_id);
    return data.session_id;
  } catch { return null; }
};
const clearSession = async () => {
  const sid = getSessionId();
  if (sid) { try { await fetch(`${API_URL}/session/${sid}`, { method: "DELETE" }); } catch { } }
  removeSessionId();
  return startSession();
};

// ── TradingView ─────────────────────────────────────────
function TradingViewChart({ ticker, height = 220 }) {
  const ref = useRef(null);
  const tvSymbol = (t) => ({ BTC: "BINANCE:BTCUSDT", ETH: "BINANCE:ETHUSDT", SOL: "BINANCE:SOLUSDT", BNB: "BINANCE:BNBUSDT", DOGE: "BINANCE:DOGEUSDT" }[t] || t);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.type = "text/javascript"; s.async = true;
    s.innerHTML = JSON.stringify({ autosize: true, symbol: tvSymbol(ticker), interval: "D", timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en", allow_symbol_change: false, calendar: false, support_host: "https://www.tradingview.com", backgroundColor: "rgba(13,17,23,1)", gridColor: "rgba(33,38,45,1)" });
    ref.current.appendChild(s);
  }, [ticker]);
  return <div ref={ref} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }} />;
}

// ── Compare Table ───────────────────────────────────────
function CompareTable({ data, ticker_a, ticker_b }) {
  const parse = (s, f) => { const m = s?.match(new RegExp(`${f}: ([^\\n]+)`)); return m ? m[1].trim() : "—"; };
  const sA = data?.data_a?.stock || "", sB = data?.data_b?.stock || "";
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
        {[ticker_a, ticker_b].map(t => <div key={t} style={{ padding: "10px 8px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#f7c843", fontWeight: 700 }}>{t}</div>)}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: i < rows.length - 1 ? "1px solid #21262d" : "none", background: i % 2 === 0 ? "#0d1117" : "#0a0f16" }}>
          <div style={{ padding: "7px 10px", fontSize: 10, color: "#8b949e" }}>{row.label}</div>
          {[row.a, row.b].map((val, j) => <div key={j} style={{ padding: "7px 8px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: row.label === "5D Change" ? (isDown(val) ? "#f85149" : "#3fb950") : "#e6edf3" }}>{val}</div>)}
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
  const ts = TYPE_STYLES[stock.type] || TYPE_STYLES.US;
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
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#e6edf3", fontWeight: 600 }}>{stock.price >= 1000 ? `$${stock.price.toLocaleString()}` : `$${stock.price}`}</div>
          <div style={{ fontSize: 11, color: isUp ? "#3fb950" : "#f85149", marginTop: 2 }}>{isUp ? "▲" : "▼"} {Math.abs(stock.change)}%</div>
        </div>
      </div>
      <div style={{ marginTop: 12, height: 50 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs><linearGradient id={`g-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.3} /><stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} /></linearGradient></defs>
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
  const isUp = stock.change >= 0;
  const ts = TYPE_STYLES[stock.type] || TYPE_STYLES.US;
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
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#e6edf3", fontWeight: 700 }}>${stock.price.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: isUp ? "#3fb950" : "#f85149" }}>{isUp ? "▲" : "▼"} {Math.abs(stock.change)}% today</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <defs><linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.25} /><stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} interval={9} />
          <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `$${v.toLocaleString()}`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="price" stroke={isUp ? "#3fb950" : "#f85149"} strokeWidth={2} fill="url(#mainGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
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
          {msg.sources.map((s, i) => <span key={i} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#8b949e" }}>📡 {s}</span>)}
          {msg.responseTime && <span style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#8b949e" }}>⚡ {msg.responseTime}s</span>}
        </div>
      )}
    </div>
  );
}

// ── Auth Modal ──────────────────────────────────────────
function AuthModal({ onSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
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

// ── Tablet Chat Drawer ──────────────────────────────────
function TabletChatDrawer({ open, onClose, children }) {
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(1,4,9,0.6)", zIndex: 200, backdropFilter: "blur(2px)" }}
        />
      )}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(400px, 92vw)",
        background: "#0d1117",
        borderLeft: "1px solid #21262d",
        zIndex: 201,
        display: "flex",
        flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Quantiq Advisor</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        {children}
      </div>
    </>
  );
}

// ── Main App ────────────────────────────────────────────
export default function App() {
  // ── Responsive ────────────────────────────────────────
  const [bp, setBp] = useState(() => getBreakpoint(window.innerWidth));
  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";
  const isDesktop = bp === "desktop";

  useEffect(() => {
    const onResize = () => setBp(getBreakpoint(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Mobile bottom nav: "market" | "chat" | "watchlist" | "more"
  const [mobileTab, setMobileTab] = useState("market");
  // ── Desktop/Tablet left panel tab
  const [activeTab, setActiveTab] = useState("watchlist");
  // ── Tablet chat drawer
  const [tabletChatOpen, setTabletChatOpen] = useState(false);

  // ── Auth ───────────────────────────────────────────────
  const [userState, setUserState] = useState(getUser());
  const [showAuth, setShowAuth]   = useState(!getToken());
  const handleAuthSuccess = () => { setUserState(getUser()); setShowAuth(false); };
  const handleLogout = () => { removeToken(); removeUser(); setUserState(null); setShowAuth(true); };

  // ── Core state ─────────────────────────────────────────
  const [selectedStock, setSelectedStock]       = useState(WATCHLIST[0]);
  const [messages, setMessages]                 = useState([{ role: "assistant", content: "Hello! I'm Quantiq, your AI-powered financial advisor. Ask about US stocks, Indian stocks (NSE/BSE), or crypto.", sources: [] }]);
  const [input, setInput]                       = useState("");
  const [loading, setLoading]                   = useState(false);
  const [timeRange, setTimeRange]               = useState("7d");

  // ── Portfolio ──────────────────────────────────────────
  const [portfolio, setPortfolio]               = useState([]);
  const [portfolioInput, setPortfolioInput]     = useState("");
  const [portfolioData, setPortfolioData]       = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // ── Compare ────────────────────────────────────────────
  const [compareA, setCompareA]                 = useState("");
  const [compareB, setCompareB]                 = useState("");
  const [compareData, setCompareData]           = useState(null);
  const [compareLoading, setCompareLoading]     = useState(false);

  // ── Alerts ─────────────────────────────────────────────
  const [alerts, setAlerts]                     = useState([]);
  const [alertTicker, setAlertTicker]           = useState("");
  const [alertThreshold, setAlertThreshold]     = useState("");
  const [alertDirection, setAlertDirection]     = useState("above");
  const [alertCreating, setAlertCreating]       = useState(false);
  const [triggeredNotifs, setTriggeredNotifs]   = useState([]);

  // ── Sentiment ──────────────────────────────────────────
  const [sentiments, setSentiments]             = useState({});
  const [sentimentLoading, setSentimentLoading] = useState({});

  const bottomRef = useRef(null);

  useEffect(() => { if (!getSessionId()) startSession(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchSentiment = useCallback(async (ticker, name = "") => {
    if (sentiments[ticker] !== undefined) return;
    setSentimentLoading(prev => ({ ...prev, [ticker]: true }));
    try {
      const res = await fetch(`${API_URL}/sentiment/${ticker}?company=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSentiments(prev => ({ ...prev, [ticker]: data }));
    } catch { setSentiments(prev => ({ ...prev, [ticker]: null })); }
    setSentimentLoading(prev => ({ ...prev, [ticker]: false }));
  }, [sentiments]);

  useEffect(() => { WATCHLIST.forEach(s => fetchSentiment(s.ticker, s.name)); }, []); // eslint-disable-line
  useEffect(() => { fetchSentiment(selectedStock.ticker, selectedStock.name); }, [selectedStock.ticker]); // eslint-disable-line

  useEffect(() => {
    const poll = async () => {
      const sid = getSessionId();
      if (!sid) return;
      try {
        const res = await fetch(`${API_URL}/check_alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
        const data = await res.json();
        if (data.triggered?.length) { setTriggeredNotifs(prev => [...prev, ...data.triggered]); fetchAlerts(); }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  const fetchAlerts = async () => {
    const sid = getSessionId();
    if (!sid) return;
    try {
      const res = await fetch(`${API_URL}/get_alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {}
  };

  const createAlert = async () => {
    if (!alertTicker.trim() || !alertThreshold) return;
    const threshold = parseFloat(alertThreshold);
    if (isNaN(threshold) || threshold <= 0) return;
    setAlertCreating(true);
    try {
      const sid = getSessionId() || await startSession();
      await fetch(`${API_URL}/create_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, ticker: alertTicker.toUpperCase().trim(), threshold, direction: alertDirection }) });
      setAlertTicker(""); setAlertThreshold(""); await fetchAlerts();
    } catch {}
    setAlertCreating(false);
  };

  const deleteAlert = async (id) => {
    const sid = getSessionId();
    if (!sid) return;
    try { await fetch(`${API_URL}/delete_alert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, alert_id: id }) }); await fetchAlerts(); } catch {}
  };

  const dismissNotif = (i) => setTriggeredNotifs(prev => prev.filter((_, j) => j !== i));
  const addToPortfolio = (t) => { const v = t.trim().toUpperCase(); if (v && !portfolio.includes(v)) setPortfolio(prev => [...prev, v]); };
  const removeFromPortfolio = (t) => setPortfolio(prev => prev.filter(x => x !== t));

  const runPortfolioAnalysis = async (over = null) => {
    const tickers = over || portfolio;
    if (!tickers.length) return;
    setPortfolioLoading(true);
    try {
      const sid = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/portfolio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers, session_id: sid }) });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setPortfolioData(data);
    } catch { setPortfolioData({ error: "Failed to fetch portfolio data." }); }
    setPortfolioLoading(false);
  };

  const runComparison = async (a = null, b = null) => {
    const ta = (a || compareA).trim(), tb = (b || compareB).trim();
    if (!ta || !tb) return;
    setCompareLoading(true); setCompareData(null);
    try {
      const sid = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/compare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker_a: ta, ticker_b: tb, session_id: sid }) });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setCompareData(data);
      if (isMobile) setMobileTab("market");
      fetchSentiment(ta); fetchSentiment(tb);
    } catch { setCompareData({ error: "Comparison failed." }); }
    setCompareLoading(false);
  };

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return;
    const lower = question.toLowerCase();
    const isCompare   = lower.includes(" vs ") || lower.includes(" versus ") || lower.includes("compare ");
    const isPortfolio = lower.includes("portfolio") || lower.startsWith("track ") || lower.includes("analyze my") || lower.includes("analyze portfolio");
    setLoading(true);
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");
    if (isMobile) setMobileTab("chat");
    if (isTablet) setTabletChatOpen(true);

    if (isCompare) {
      try {
        const sid = getSessionId() || await startSession();
        const res = await fetch(`${API_URL}/compare/from-chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: question, session_id: sid }) });
        const data = await res.json();
        if (data.session_id) setSessionId(data.session_id);
        if (data.ticker_a && data.ticker_b) {
          setCompareA(data.ticker_a); setCompareB(data.ticker_b); setCompareData(data);
          fetchSentiment(data.ticker_a); fetchSentiment(data.ticker_b);
          setMessages(prev => [...prev, { role: "assistant", content: data.verdict, sources: ["Yahoo Finance (real-time)"] }]);
        } else { setMessages(prev => [...prev, { role: "assistant", content: data.detail || "Try: 'compare AAPL vs TSLA'", sources: [] }]); }
      } catch { setMessages(prev => [...prev, { role: "assistant", content: "Comparison failed.", sources: [] }]); }
      setLoading(false); return;
    }

    if (isPortfolio) {
      try {
        const sid = getSessionId() || await startSession();
        const res = await fetch(`${API_URL}/portfolio/from-chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: question, session_id: sid }) });
        const data = await res.json();
        if (data.session_id) setSessionId(data.session_id);
        if (data.tickers) {
          setPortfolio(data.tickers); setPortfolioData(data);
          data.tickers.forEach(t => fetchSentiment(t));
          setMessages(prev => [...prev, { role: "assistant", content: data.summary, sources: ["Yahoo Finance (real-time)"] }]);
        } else { setMessages(prev => [...prev, { role: "assistant", content: data.detail || "Try: 'analyze portfolio AAPL BTC INFY.NS'", sources: [] }]); }
      } catch { setMessages(prev => [...prev, { role: "assistant", content: "Portfolio analysis failed.", sources: [] }]); }
      setLoading(false); return;
    }

    try {
      const sid = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, include_sources: true, session_id: sid, time_range: timeRange }) });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources, responseTime: data.response_time }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Connection error.", sources: [] }]); }
    setLoading(false);
  };

  const handleNewChat = async () => {
    await clearSession();
    setMessages([{ role: "assistant", content: "New conversation started. What would you like to know?", sources: [] }]);
  };

  const activeAlerts    = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  // ── Header height ref for dvh calc ────────────────────
  const HEADER_H = isMobile ? 57 : 65;

  // ── Tab styles ─────────────────────────────────────────
  const tabStyle = (tab) => ({
    flex: 1, padding: "7px 0", fontSize: 10, fontWeight: 600,
    letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer",
    border: "none", fontFamily: "'DM Sans', sans-serif",
    background: activeTab === tab ? "#161b22" : "transparent",
    color: activeTab === tab ? "#f7c843" : "#8b949e",
    borderBottom: activeTab === tab ? "2px solid #f7c843" : "2px solid transparent",
    transition: "all 0.15s",
  });

  // ── Left panel content ─────────────────────────────────
  const renderLeftPanelContent = () => (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      {activeTab === "watchlist" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WATCHLIST.map(stock => (
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
          <div style={{ fontSize: 11, color: "#8b949e" }}>Works with US, India (.NS/.BO) and crypto</div>
          <input value={compareA} onChange={e => setCompareA(e.target.value.toUpperCase())} placeholder="Ticker A (e.g. RELIANCE.NS)"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
          <div style={{ textAlign: "center", fontSize: 11, color: "#8b949e" }}>vs</div>
          <input value={compareB} onChange={e => setCompareB(e.target.value.toUpperCase())} placeholder="Ticker B (e.g. TCS.NS)"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }}
            onKeyDown={e => e.key === "Enter" && runComparison()} />
          <button onClick={() => runComparison()} disabled={compareLoading || !compareA || !compareB}
            style={{ width: "100%", background: (compareLoading || !compareA || !compareB) ? "#21262d" : "#f7c843", color: (compareLoading || !compareA || !compareB) ? "#8b949e" : "#0d1117", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {compareLoading ? "Comparing..." : "Compare"}
          </button>
          {compareData && !compareData.error && (
            <div style={{ marginTop: 8 }}>
              <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />
              {compareData.verdict && <div style={{ marginTop: 10, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 12, fontSize: 11, color: "#8b949e", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{compareData.verdict}</div>}
            </div>
          )}
          {compareData?.error && <div style={{ fontSize: 11, color: "#f85149" }}>{compareData.error}</div>}
        </div>
      )}

      {activeTab === "portfolio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#8b949e" }}>Mix US stocks, India (.NS) and crypto</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={portfolioInput} onChange={e => setPortfolioInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { addToPortfolio(portfolioInput); setPortfolioInput(""); } }}
              placeholder="e.g. AAPL, BTC, INFY.NS"
              style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Sans', sans-serif" }} />
            <button onClick={() => { addToPortfolio(portfolioInput); setPortfolioInput(""); }}
              style={{ background: "#21262d", border: "none", borderRadius: 8, padding: "10px 14px", color: "#f7c843", fontSize: 18, cursor: "pointer", fontWeight: 700 }}>+</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {portfolio.map(t => (
              <div key={t} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#f7c843", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 6 }}>
                {t}<span onClick={() => removeFromPortfolio(t)} style={{ color: "#8b949e", cursor: "pointer", fontSize: 16 }}>×</span>
              </div>
            ))}
          </div>
          {portfolio.length > 0 && (
            <button onClick={() => runPortfolioAnalysis()} disabled={portfolioLoading}
              style={{ width: "100%", background: portfolioLoading ? "#21262d" : "#f7c843", color: portfolioLoading ? "#8b949e" : "#0d1117", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {portfolioLoading ? "Analyzing..." : `Analyze ${portfolio.length} asset${portfolio.length > 1 ? "s" : ""}`}
            </button>
          )}
          {portfolioData && !portfolioData.error && portfolioData.tickers && (
            <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 12 }}>
              {portfolioData.tickers.map(ticker => {
                const s = portfolioData.breakdown?.[ticker]?.stock || "";
                const assetType = portfolioData.breakdown?.[ticker]?.asset_type || "us_stock";
                const isCrypto = assetType === "crypto", isIndia = assetType === "india_stock";
                const priceMatch = isCrypto ? s.match(/Price \(USD\): \$([^\n]+)/) : s.match(/Current Price: [₹$]([^\n]+)/);
                const price = priceMatch?.[1], change = s.match(/(?:5-Day|24h) Change: ([^\n]+)/)?.[1];
                const pe = s.match(/P\/E Ratio: ([^\n]+)/)?.[1], mcap = s.match(/Market Cap: [₹$]?([^\n]+)/)?.[1];
                const sent = sentiments[ticker];
                const ts = isCrypto ? TYPE_STYLES.Crypto : isIndia ? TYPE_STYLES.India : TYPE_STYLES.US;
                const tl = isCrypto ? "Crypto" : isIndia ? "India" : "US";
                return (
                  <div key={ticker} style={{ padding: "8px 0", borderBottom: "1px solid #21262d" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>{ticker}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: ts.bg, color: ts.color }}>{tl}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }}>{price ? (isIndia ? `₹${price}` : `$${price}`) : "—"}</div>
                        <div style={{ fontSize: 11, color: change?.includes("-") ? "#f85149" : "#3fb950" }}>{change || "—"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      {pe && <span style={{ fontSize: 10, color: "#8b949e" }}>P/E {pe}</span>}
                      {mcap && <span style={{ fontSize: 10, color: "#8b949e" }}>MCap {mcap.slice(0, 12)}</span>}
                      {sent && <span style={{ fontSize: 10, color: sentimentColor(sent.score), fontWeight: 600 }}>● {sent.label} {sent.score}</span>}
                    </div>
                    <SentimentBar score={sent?.score ?? null} loading={sentimentLoading[ticker] ?? false} />
                  </div>
                );
              })}
              {portfolioData.summary && <div style={{ marginTop: 10, fontSize: 11, color: "#8b949e", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 140, overflowY: "auto" }}>{portfolioData.summary}</div>}
            </div>
          )}
          {portfolioData?.error && <div style={{ fontSize: 11, color: "#f85149" }}>{portfolioData.error}</div>}
        </div>
      )}

      {activeTab === "alerts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {triggeredNotifs.map((n, i) => (
            <div key={i} className="alert-notif">
              <span style={{ fontSize: 14 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#f7c843", fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>{n.ticker} triggered</div>
                <div style={{ color: "#8b949e", fontSize: 11 }}>{n.direction === "above" ? "Rose above" : "Fell below"} ${n.threshold} — hit ${n.triggered_price}</div>
              </div>
              <button onClick={() => dismissNotif(i)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#8b949e" }}>Set a price alert — works for stocks, India & crypto</div>
          <input value={alertTicker} onChange={e => setAlertTicker(e.target.value.toUpperCase())} placeholder="Ticker (AAPL, BTC, INFY.NS…)"
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)} placeholder="Price" type="number" min="0" step="0.01"
              style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
            <select value={alertDirection} onChange={e => setAlertDirection(e.target.value)}
              style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 10px", fontSize: 13, color: "#e6edf3", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              <option value="above">Above ↑</option>
              <option value="below">Below ↓</option>
            </select>
          </div>
          <button onClick={createAlert} disabled={alertCreating || !alertTicker.trim() || !alertThreshold}
            style={{ width: "100%", background: (alertCreating || !alertTicker.trim() || !alertThreshold) ? "#21262d" : "#f7c843", color: (alertCreating || !alertTicker.trim() || !alertThreshold) ? "#8b949e" : "#0d1117", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {alertCreating ? "Adding..." : "+ Add Alert"}
          </button>
          {alerts.length > 0 && (
            <div style={{ borderTop: "1px solid #21262d", paddingTop: 12, marginTop: 4 }}>
              {activeAlerts.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Active ({activeAlerts.length})</div>
                  {activeAlerts.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>{a.ticker}</div>
                        <div style={{ fontSize: 11, color: "#8b949e", marginTop: 1 }}>{a.direction === "above" ? "↑ above" : "↓ below"} ${a.threshold}</div>
                      </div>
                      <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "1px solid #21262d", borderRadius: 6, padding: "5px 10px", color: "#8b949e", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  ))}
                </>
              )}
              {triggeredAlerts.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", margin: "12px 0 8px" }}>Triggered</div>
                  {triggeredAlerts.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: "10px 12px", marginBottom: 6, opacity: 0.6 }}>
                      <div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#3fb950", fontWeight: 700 }}>✓ {a.ticker}</div>
                        <div style={{ fontSize: 11, color: "#8b949e", marginTop: 1 }}>hit ${a.triggered_price} ({a.direction} ${a.threshold})</div>
                      </div>
                      <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "1px solid #21262d", borderRadius: 6, padding: "5px 10px", color: "#8b949e", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {alerts.length === 0 && <div style={{ fontSize: 11, color: "#8b949e", textAlign: "center", marginTop: 8 }}>No alerts yet. Add one above.</div>}
        </div>
      )}
    </div>
  );

  // ── Center content ─────────────────────────────────────
  const renderCenterContent = () => (
    <div style={{ padding: isMobile ? 16 : 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {compareData && !compareData.error && compareData.ticker_a ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: isMobile ? 15 : 18, color: "#f7c843", fontWeight: 700 }}>{compareData.ticker_a}</span>
            <span style={{ fontSize: 12, color: "#8b949e" }}>vs</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: isMobile ? 15 : 18, color: "#f7c843", fontWeight: 700 }}>{compareData.ticker_b}</span>
            <button onClick={() => setCompareData(null)} style={{ marginLeft: "auto", background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#8b949e", cursor: "pointer" }}>← Back</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>{compareData.ticker_a}</div>
              <TradingViewChart ticker={compareData.ticker_a} height={isMobile ? 180 : 220} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>{compareData.ticker_b}</div>
              <TradingViewChart ticker={compareData.ticker_b} height={isMobile ? 180 : 220} />
            </div>
          </div>
          <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <SentimentGauge ticker={compareData.ticker_a} sentiment={sentiments[compareData.ticker_a] ?? null} loading={sentimentLoading[compareData.ticker_a] ?? false} />
            <SentimentGauge ticker={compareData.ticker_b} sentiment={sentiments[compareData.ticker_b] ?? null} loading={sentimentLoading[compareData.ticker_b] ?? false} />
          </div>
        </>
      ) : (
        <>
          <MainChart stock={selectedStock} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {[{ label: "Market Cap", value: "$3.76T" }, { label: "P/E Ratio", value: "32.35" }, { label: "EPS", value: "$7.91" }, { label: "Div Yield", value: "0.41%" }].map((stat, i) => (
              <div key={i} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#f7c843", fontWeight: 700 }}>{stat.value}</div>
              </div>
            ))}
          </div>
          <SentimentGauge ticker={selectedStock.ticker} sentiment={sentiments[selectedStock.ticker] ?? null} loading={sentimentLoading[selectedStock.ticker] ?? false} />
        </>
      )}
      {/* Quick Ask — desktop + tablet */}
      {!isMobile && (
        <div>
          <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Quick Ask</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)}
                style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 20, padding: "7px 14px", fontSize: 12, color: "#8b949e", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.target.style.borderColor = "#f7c843"; e.target.style.color = "#f7c843"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#21262d"; e.target.style.color = "#8b949e"; }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Chat panel content ─────────────────────────────────
  const renderChatContent = () => (
    <>
      {/* Header only on desktop — tablet has its own drawer header */}
      {isDesktop && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Quantiq Advisor</span>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
            style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#8b949e", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            <option value="24h">24h</option><option value="3d">3d</option><option value="7d">7d</option><option value="30d">30d</option><option value="1y">1y</option>
          </select>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 0" : "20px" }}>
        {/* Quick ask pills on mobile — with fade mask */}
        {isMobile && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 8, WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)", maskImage: "linear-gradient(to right, black 85%, transparent 100%)" }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)}
                style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "6px 12px", fontSize: 11, color: "#8b949e", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && (
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", fontSize: 13, color: "#8b949e", display: "inline-block" }}>
            Quantiq is analyzing market data...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: isMobile ? "12px 16px" : "16px 20px", borderTop: "1px solid #21262d", display: "flex", gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask about stocks, crypto, Indian markets…"
          style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "11px 14px", fontSize: 15, color: "#e6edf3", fontFamily: "'DM Sans', sans-serif" }} />
        <button onClick={() => sendMessage(input)} disabled={loading}
          style={{ background: loading ? "#21262d" : "#f7c843", color: loading ? "#8b949e" : "#0d1117", border: "none", borderRadius: 12, padding: "11px 16px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          {loading ? "..." : "Ask"}
        </button>
      </div>
    </>
  );

  // ── Mobile bottom nav items ────────────────────────────
  const mobileNavItems = [
    { id: "market",    icon: "📈", label: "Market"    },
    { id: "chat",      icon: "💬", label: "Chat"      },
    { id: "watchlist", icon: "⭐", label: "Watch"     },
    { id: "more",      icon: "⋯",  label: "More"      },
  ];

  return (
    <>
      {showAuth && <AuthModal onSuccess={handleAuthSuccess} />}
      <div style={{ minHeight: "100dvh", background: "#010409", fontFamily: "'DM Sans', sans-serif", color: "#e6edf3", display: "flex", flexDirection: "column" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #010409; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
          textarea:focus, input:focus, select { outline: none; }
          .alert-notif { display: flex; align-items: flex-start; gap: 8px; background: #1a2332; border: 1px solid #2d4a6e; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #79c0ff; margin-bottom: 8px; animation: slideIn 0.2s ease; }
          @keyframes slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {/* Alert toasts */}
        {triggeredNotifs.length > 0 && (
          <div style={{ position: "fixed", top: 70, right: 12, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: isMobile ? "calc(100vw - 24px)" : 300 }}>
            {triggeredNotifs.map((n, i) => (
              <div key={i} style={{ background: "#1a2332", border: "1px solid #2d4a6e", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#79c0ff", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "slideIn 0.2s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 3, color: "#f7c843", fontFamily: "'DM Mono', monospace" }}>🔔 {n.ticker} Alert</div>
                    <div style={{ color: "#8b949e" }}>Price {n.direction} ${n.threshold} — hit ${n.triggered_price}</div>
                  </div>
                  <button onClick={() => dismissNotif(i)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Header ── */}
        <header style={{ borderBottom: "1px solid #21262d", padding: isMobile ? "12px 16px" : "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "#f7c843", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💹</div>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: isMobile ? 14 : 16, fontWeight: 700, color: "#e6edf3" }}>Quantiq</div>
              {!isMobile && <div style={{ fontSize: 11, color: "#8b949e" }}>US · India · Crypto · Real-time</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "5px 12px", fontSize: 11, color: "#3fb950", display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3fb950" }} />Live
            </div>
            {/* Tablet: Chat button in header */}
            {isTablet && (
              <button onClick={() => setTabletChatOpen(true)}
                style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#f7c843", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                💬 Chat
              </button>
            )}
            {!isMobile && (
              <button onClick={handleNewChat} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#8b949e", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                onMouseEnter={e => { e.target.style.borderColor = "#f7c843"; e.target.style.color = "#f7c843"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#21262d"; e.target.style.color = "#8b949e"; }}>
                + New chat
              </button>
            )}
            {userState && !isMobile && (
              <button onClick={handleLogout} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#f85149", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Sign out
              </button>
            )}
            {isMobile && userState && (
              <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>Out</button>
            )}
          </div>
        </header>

        {/* ── DESKTOP LAYOUT ── */}
        {isDesktop && (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) minmax(320px, 380px)", overflow: "hidden", height: `calc(100dvh - ${HEADER_H}px)` }}>
            {/* Left panel */}
            <div style={{ borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", background: "#0d1117", overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #21262d", flexShrink: 0 }}>
                <button style={tabStyle("watchlist")} onClick={() => setActiveTab("watchlist")}>Watch</button>
                <button style={tabStyle("compare")}   onClick={() => setActiveTab("compare")}>Compare</button>
                <button style={tabStyle("portfolio")} onClick={() => setActiveTab("portfolio")}>Portfolio</button>
                <button style={{ ...tabStyle("alerts"), position: "relative" }} onClick={() => { setActiveTab("alerts"); fetchAlerts(); }}>
                  Alerts
                  {activeAlerts.length > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: "#f7c843", color: "#0d1117", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeAlerts.length}</span>}
                </button>
              </div>
              {renderLeftPanelContent()}
            </div>
            {/* Center */}
            <div style={{ overflowY: "auto" }}>{renderCenterContent()}</div>
            {/* Right / Chat */}
            <div style={{ borderLeft: "1px solid #21262d", display: "flex", flexDirection: "column", background: "#0d1117", overflow: "hidden" }}>
              {renderChatContent()}
            </div>
          </div>
        )}

        {/* ── TABLET LAYOUT ── */}
        {isTablet && (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)", overflow: "hidden", height: `calc(100dvh - ${HEADER_H}px)` }}>
            {/* Left panel */}
            <div style={{ borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", background: "#0d1117", overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #21262d", flexShrink: 0 }}>
                <button style={tabStyle("watchlist")} onClick={() => setActiveTab("watchlist")}>Watch</button>
                <button style={tabStyle("compare")}   onClick={() => setActiveTab("compare")}>⇄</button>
                <button style={tabStyle("portfolio")} onClick={() => setActiveTab("portfolio")}>Port</button>
                <button style={{ ...tabStyle("alerts"), position: "relative" }} onClick={() => { setActiveTab("alerts"); fetchAlerts(); }}>
                  🔔
                  {activeAlerts.length > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: "#f7c843", color: "#0d1117", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeAlerts.length}</span>}
                </button>
              </div>
              {renderLeftPanelContent()}
            </div>
            {/* Center only — chat is a drawer */}
            <div style={{ overflowY: "auto" }}>{renderCenterContent()}</div>
            {/* Chat drawer */}
            <TabletChatDrawer open={tabletChatOpen} onClose={() => setTabletChatOpen(false)}>
              {renderChatContent()}
            </TabletChatDrawer>
          </div>
        )}

        {/* ── MOBILE LAYOUT ── */}
        {isMobile && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: `calc(100dvh - ${HEADER_H}px)` }}>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              {mobileTab === "market" && (
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {renderCenterContent()}
                </div>
              )}

              {mobileTab === "chat" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {renderChatContent()}
                </div>
              )}

              {mobileTab === "watchlist" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {WATCHLIST.map(stock => (
                      <StockCard key={stock.ticker} stock={stock}
                        isSelected={selectedStock.ticker === stock.ticker}
                        onClick={() => { setSelectedStock(stock); setMobileTab("market"); }}
                        sentiment={sentiments[stock.ticker] ?? null}
                        sentimentLoading={sentimentLoading[stock.ticker] ?? false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {mobileTab === "more" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", borderBottom: "1px solid #21262d", background: "#0d1117", flexShrink: 0 }}>
                    {["compare", "portfolio", "alerts"].map(t => (
                      <button key={t} onClick={() => setActiveTab(t)}
                        style={{ flex: 1, padding: "10px 0", fontSize: 11, fontWeight: 600, textTransform: "capitalize", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: activeTab === t ? "#161b22" : "transparent", color: activeTab === t ? "#f7c843" : "#8b949e", borderBottom: activeTab === t ? "2px solid #f7c843" : "2px solid transparent" }}>
                        {t === "alerts" && activeAlerts.length > 0 ? `Alerts (${activeAlerts.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  {(activeTab === "compare" || activeTab === "portfolio" || activeTab === "alerts") && renderLeftPanelContent()}
                </div>
              )}
            </div>

            {/* Mobile bottom navigation */}
            <div style={{ borderTop: "1px solid #21262d", background: "#0d1117", display: "flex", flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
              {mobileNavItems.map(item => (
                <button key={item.id}
                  onClick={() => {
                    setMobileTab(item.id);
                    if (item.id === "more" && !["compare","portfolio","alerts"].includes(activeTab)) setActiveTab("compare");
                    if (item.id === "more") fetchAlerts();
                  }}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 8px", border: "none", background: "transparent", cursor: "pointer", position: "relative" }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: mobileTab === item.id ? "#f7c843" : "#8b949e", fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>
                  {item.id === "more" && activeAlerts.length > 0 && (
                    <span style={{ position: "absolute", top: 6, right: "calc(50% - 18px)", width: 8, height: 8, background: "#f7c843", borderRadius: "50%" }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}