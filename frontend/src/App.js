import { useState, useRef, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const API_URL = "https://quantiq-go.onrender.com";

// ── Chart data ──────────────────────────────────────────
const generateChartData = (base, points = 30) => {
  let price = base;
  return Array.from({ length: points }, (_, i) => {
    price = price + (Math.random() - 0.48) * 4;
    return { day: `D${i + 1}`, price: parseFloat(price.toFixed(2)) };
  });
};

const WATCHLIST = [
  { ticker: "AAPL", name: "Apple Inc.",   price: 255.92, change: +2.86, base: 248 },
  { ticker: "TSLA", name: "Tesla Inc.",   price: 172.4,  change: -1.24, base: 175 },
  { ticker: "NVDA", name: "NVIDIA Corp.", price: 887.3,  change: +3.51, base: 860 },
  { ticker: "MSFT", name: "Microsoft",   price: 415.6,  change: +0.92, base: 410 },
];

const SUGGESTIONS = [
  "Should I buy AAPL right now?",
  "Compare AAPL vs MSFT",
  "Analyze portfolio AAPL TSLA NVDA",
  "What is NVDA's earnings trend?",
  "Explain dollar cost averaging",
];

// ── Sentiment helpers ───────────────────────────────────
const sentimentColor = (score) => {
  if (score === null || score === undefined) return "#8b949e";
  if (score >= 62) return "#3fb950"; // Bullish — green
  if (score <= 38) return "#f85149"; // Bearish — red
  return "#e3b341";                  // Neutral  — amber
};

const sentimentLabel = (score) => {
  if (score === null || score === undefined) return "—";
  if (score >= 62) return "Bullish";
  if (score <= 38) return "Bearish";
  return "Neutral";
};

// ── Sentiment Bar (compact, for stock cards) ────────────
function SentimentBar({ score, loading }) {
  const color = sentimentColor(score);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Sentiment
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: loading ? "#8b949e" : color }}>
          {loading ? "…" : score !== null ? sentimentLabel(score) : "—"}
        </span>
      </div>
      <div style={{
        height: 3, background: "#21262d", borderRadius: 2, overflow: "hidden",
      }}>
        {!loading && score !== null && (
          <div style={{
            height: "100%", width: `${score}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 2,
            transition: "width 0.6s ease",
          }} />
        )}
      </div>
    </div>
  );
}

// ── Sentiment Gauge (full, for center panel) ────────────
function SentimentGauge({ ticker, sentiment, loading }) {
  const score  = sentiment?.score ?? null;
  const label  = sentiment?.label ?? "—";
  const color  = sentimentColor(score);
  const count  = sentiment?.headline_count ?? 0;
  const headlines = sentiment?.headlines ?? [];

  return (
    <div style={{
      background: "#0d1117", border: "1px solid #21262d",
      borderRadius: 16, padding: "20px 24px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
            News Sentiment
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>
            {ticker}
          </div>
        </div>
        {!loading && score !== null && (
          <div style={{
            background: `${color}18`, border: `1px solid ${color}44`,
            borderRadius: 20, padding: "4px 12px",
            fontFamily: "'DM Mono', monospace", fontSize: 12,
            color, fontWeight: 700,
          }}>
            {label}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "#8b949e" }}>Analyzing headlines…</div>
      ) : score !== null ? (
        <>
          {/* Score bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#f85149" }}>Bearish</span>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 20,
                fontWeight: 700, color,
              }}>
                {score}
              </span>
              <span style={{ fontSize: 10, color: "#3fb950" }}>Bullish</span>
            </div>

            {/* Track with three zones */}
            <div style={{ position: "relative", height: 8, borderRadius: 4, overflow: "hidden" }}>
              {/* Background zones */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, #f8514933 0%, #e3b34133 40%, #3fb95033 100%)",
              }} />
              {/* Fill indicator */}
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${score}%`,
                background: `linear-gradient(90deg, ${color}66, ${color})`,
                borderRadius: 4,
                transition: "width 0.8s ease",
              }} />
              {/* Needle */}
              <div style={{
                position: "absolute", top: 0, bottom: 0,
                left: `calc(${score}% - 1px)`,
                width: 2, background: color, borderRadius: 1,
                transition: "left 0.8s ease",
              }} />
            </div>

            {/* Zone labels */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginTop: 4, fontSize: 9, color: "#8b949e",
            }}>
              <span>0</span>
              <span style={{ color: "#e3b341" }}>Neutral 40–62</span>
              <span>100</span>
            </div>
          </div>

          {/* Meta */}
          <div style={{ fontSize: 10, color: "#8b949e", marginBottom: count > 0 ? 10 : 0 }}>
            Based on {count} headline{count !== 1 ? "s" : ""} from the past 3 days
          </div>

          {/* Top headlines */}
          {headlines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Top Headlines
              </div>
              {headlines.slice(0, 3).map((h, i) => {
                const _hScore = 50; // individual scoring not returned, just show neutrally
                return (
                  <div key={i} style={{
                    fontSize: 11, color: "#8b949e", lineHeight: 1.5,
                    padding: "6px 10px",
                    background: "#161b22", borderRadius: 8,
                    borderLeft: `2px solid ${color}66`,
                  }}>
                    {h.length > 110 ? h.slice(0, 110) + "…" : h}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: "#8b949e" }}>
          No sentiment data — check that NEWSAPI_KEY is set.
        </div>
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
  const sessionId = getSessionId();
  if (sessionId) {
    try { await fetch(`${API_URL}/session/${sessionId}`, { method: "DELETE" }); } catch { }
  }
  removeSessionId();
  return startSession();
};

// ── TradingView Widget ──────────────────────────────────
function TradingViewChart({ ticker, height = 220 }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true, symbol: ticker, interval: "D",
      timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en",
      allow_symbol_change: false, calendar: false,
      support_host: "https://www.tradingview.com",
      backgroundColor: "rgba(13, 17, 23, 1)",
      gridColor: "rgba(33, 38, 45, 1)",
    });
    containerRef.current.appendChild(script);
  }, [ticker]);
  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }} />;
}

// ── Compare Table ───────────────────────────────────────
function CompareTable({ data, ticker_a, ticker_b }) {
  const parse = (stockStr, field) => {
    const match = stockStr?.match(new RegExp(`${field}: ([^\\n]+)`));
    return match ? match[1].trim() : "—";
  };
  const stockA = data?.data_a?.stock || "";
  const stockB = data?.data_b?.stock || "";
  const rows = [
    { label: "Current Price",   a: parse(stockA, "Current Price"),   b: parse(stockB, "Current Price")   },
    { label: "5-Day Change",    a: parse(stockA, "5-Day Change"),    b: parse(stockB, "5-Day Change")    },
    { label: "Market Cap",      a: parse(stockA, "Market Cap"),      b: parse(stockB, "Market Cap")      },
    { label: "P/E Ratio",       a: parse(stockA, "P/E Ratio"),       b: parse(stockB, "P/E Ratio")       },
    { label: "EPS",             a: parse(stockA, "EPS"),             b: parse(stockB, "EPS")             },
    { label: "52W High",        a: parse(stockA, "52W High"),        b: parse(stockB, "52W High")        },
    { label: "52W Low",         a: parse(stockA, "52W Low"),         b: parse(stockB, "52W Low")         },
    { label: "Relative Volume", a: parse(stockA, "Relative Volume"), b: parse(stockB, "Relative Volume") },
  ];
  const isDown = (val) => val?.includes("-");
  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#161b22", borderBottom: "1px solid #21262d" }}>
        <div style={{ padding: "10px 14px", fontSize: 11, color: "#8b949e" }} />
        {[ticker_a, ticker_b].map(t => (
          <div key={t} style={{ padding: "10px 14px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#f7c843", fontWeight: 700 }}>{t}</div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: i < rows.length - 1 ? "1px solid #21262d" : "none", background: i % 2 === 0 ? "#0d1117" : "#0a0f16" }}>
          <div style={{ padding: "8px 14px", fontSize: 11, color: "#8b949e" }}>{row.label}</div>
          {[row.a, row.b].map((val, j) => (
            <div key={j} style={{ padding: "8px 14px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, color: row.label.includes("Change") ? (isDown(val) ? "#f85149" : "#3fb950") : "#e6edf3" }}>{val}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Custom Tooltip ──────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#e6edf3" }}>
        ${payload[0].value}
      </div>
    );
  }
  return null;
};

// ── Stock Card ──────────────────────────────────────────
function StockCard({ stock, isSelected, onClick, sentiment, sentimentLoading }) {
  const data = generateChartData(stock.base);
  const isUp = stock.change >= 0;
  return (
    <div onClick={onClick} style={{
      background: isSelected ? "#161b22" : "#0d1117",
      border: `1px solid ${isSelected ? "#f7c843" : "#21262d"}`,
      borderRadius: 14, padding: "16px 18px", cursor: "pointer",
      transition: "all 0.2s", overflow: "hidden",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>
            {stock.ticker}
          </div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{stock.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#e6edf3", fontWeight: 600 }}>
            ${stock.price}
          </div>
          <div style={{ fontSize: 11, color: isUp ? "#3fb950" : "#f85149", marginTop: 2 }}>
            {isUp ? "▲" : "▼"} {Math.abs(stock.change)}%
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, height: 50 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="price"
              stroke={isUp ? "#3fb950" : "#f85149"} strokeWidth={1.5}
              fill={`url(#grad-${stock.ticker})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Sentiment bar at bottom of card */}
      <SentimentBar
        score={sentiment?.score ?? null}
        loading={sentimentLoading}
      />
    </div>
  );
}

// ── Main Chart ──────────────────────────────────────────
function MainChart({ stock }) {
  const data = generateChartData(stock.base, 60);
  const isUp = stock.change >= 0;
  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#f7c843", fontWeight: 700 }}>{stock.ticker}</span>
          <span style={{ fontSize: 13, color: "#8b949e", marginLeft: 10 }}>{stock.name}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, color: "#e6edf3", fontWeight: 700 }}>${stock.price}</div>
          <div style={{ fontSize: 13, color: isUp ? "#3fb950" : "#f85149" }}>{isUp ? "▲" : "▼"} {Math.abs(stock.change)}% today</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.25} />
              <stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} interval={9} />
          <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `$${v}`} />
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
      <div style={{
        maxWidth: "82%",
        background: isUser ? "#f7c843" : "#161b22",
        color: isUser ? "#0d1117" : "#e6edf3",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        padding: "12px 16px", fontSize: 14, lineHeight: 1.6,
        border: isUser ? "none" : "1px solid #21262d",
        whiteSpace: "pre-wrap",
      }}>
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

// ── Main App ────────────────────────────────────────────
export default function App() {
  const [selectedStock, setSelectedStock]       = useState(WATCHLIST[0]);
  const [activeTab, setActiveTab]               = useState("watchlist");
  const [messages, setMessages]                 = useState([{
    role: "assistant",
    content: "Hello! I'm Quantiq, your AI-powered financial advisor. Ask me about stocks, type 'compare AAPL vs TSLA', or 'analyze portfolio AAPL TSLA NVDA'.",
    sources: [],
  }]);
  const [input, setInput]                       = useState("");
  const [loading, setLoading]                   = useState(false);
  const [timeRange, setTimeRange]               = useState("7d");

  // Portfolio state
  const [portfolio, setPortfolio]               = useState([]);
  const [portfolioInput, setPortfolioInput]     = useState("");
  const [portfolioData, setPortfolioData]       = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Compare state
  const [compareA, setCompareA]                 = useState("");
  const [compareB, setCompareB]                 = useState("");
  const [compareData, setCompareData]           = useState(null);
  const [compareLoading, setCompareLoading]     = useState(false);

  // Alerts state
  const [alerts, setAlerts]                     = useState([]);
  const [alertTicker, setAlertTicker]           = useState("");
  const [alertThreshold, setAlertThreshold]     = useState("");
  const [alertDirection, setAlertDirection]     = useState("above");
  const [alertCreating, setAlertCreating]       = useState(false);
  const [triggeredNotifs, setTriggeredNotifs]   = useState([]);

  // Sentiment state
  // sentiments: { [ticker]: { score, label, headline_count, headlines } | null }
  const [sentiments, setSentiments]             = useState({});
  const [sentimentLoading, setSentimentLoading] = useState({});

  const bottomRef = useRef(null);

  useEffect(() => {
    if (!getSessionId()) startSession();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fetch sentiment for a ticker ──────────────────────
  const fetchSentiment = useCallback(async (ticker, name = "") => {
    if (sentiments[ticker] !== undefined) return; // already fetched or loading
    setSentimentLoading(prev => ({ ...prev, [ticker]: true }));
    try {
      const company = encodeURIComponent(name);
      const res = await fetch(`${API_URL}/sentiment/${ticker}?company=${company}`);
      if (!res.ok) throw new Error("sentiment fetch failed");
      const data = await res.json();
      setSentiments(prev => ({ ...prev, [ticker]: data }));
    } catch {
      setSentiments(prev => ({ ...prev, [ticker]: null }));
    }
    setSentimentLoading(prev => ({ ...prev, [ticker]: false }));
  }, [sentiments]);

  // ── Fetch sentiment for all watchlist stocks on mount ──
  useEffect(() => {
    WATCHLIST.forEach(s => fetchSentiment(s.ticker, s.name));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch sentiment for selected stock (center panel) ──
  useEffect(() => {
    fetchSentiment(selectedStock.ticker, selectedStock.name);
  }, [selectedStock.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll for triggered alerts every 5 minutes ─────────
  useEffect(() => {
    const poll = async () => {
      const sessionId = getSessionId();
      if (!sessionId) return;
      try {
        const res = await fetch(`${API_URL}/check_alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (data.triggered?.length) {
          setTriggeredNotifs(prev => [...prev, ...data.triggered]);
          fetchAlerts();
        }
      } catch { }
    };
    poll();
    const interval = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Alert helpers ──────────────────────────────────────
  const fetchAlerts = async () => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/get_alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { }
  };

  const createAlert = async () => {
    if (!alertTicker.trim() || !alertThreshold) return;
    const threshold = parseFloat(alertThreshold);
    if (isNaN(threshold) || threshold <= 0) return;
    setAlertCreating(true);
    try {
      const sessionId = getSessionId() || await startSession();
      await fetch(`${API_URL}/create_alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          ticker: alertTicker.toUpperCase().trim(),
          threshold,
          direction: alertDirection,
        }),
      });
      setAlertTicker("");
      setAlertThreshold("");
      await fetchAlerts();
    } catch { }
    setAlertCreating(false);
  };

  const deleteAlert = async (id) => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    try {
      await fetch(`${API_URL}/delete_alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, alert_id: id }),
      });
      await fetchAlerts();
    } catch { }
  };

  const dismissNotif = (index) => setTriggeredNotifs(prev => prev.filter((_, i) => i !== index));

  // ── Portfolio helpers ──────────────────────────────────
  const addToPortfolio = (ticker) => {
    const t = ticker.toUpperCase().trim();
    if (t && !portfolio.includes(t)) setPortfolio(prev => [...prev, t]);
  };
  const removeFromPortfolio = (ticker) => setPortfolio(prev => prev.filter(t => t !== ticker));

  const runPortfolioAnalysis = async (tickersOverride = null) => {
    const tickers = tickersOverride || portfolio;
    if (tickers.length === 0) return;
    setPortfolioLoading(true);
    try {
      const sessionId = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers, session_id: sessionId }),
      });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setPortfolioData(data);
    } catch {
      setPortfolioData({ error: "Failed to fetch portfolio data." });
    }
    setPortfolioLoading(false);
  };

  // ── Compare helpers ────────────────────────────────────
  const runComparison = async (a = null, b = null) => {
    const ticker_a = (a || compareA).toUpperCase().trim();
    const ticker_b = (b || compareB).toUpperCase().trim();
    if (!ticker_a || !ticker_b) return;
    setCompareLoading(true);
    setCompareData(null);
    try {
      const sessionId = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker_a, ticker_b, session_id: sessionId }),
      });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setCompareData(data);
      setActiveTab("compare");
      // pre-fetch sentiment for compared tickers
      fetchSentiment(ticker_a);
      fetchSentiment(ticker_b);
    } catch {
      setCompareData({ error: "Comparison failed. Please try again." });
    }
    setCompareLoading(false);
  };

  // ── Send message ───────────────────────────────────────
  const sendMessage = async (question) => {
    if (!question.trim() || loading) return;
    const lower = question.toLowerCase();
    const isCompareQuery  = lower.includes(" vs ") || lower.includes(" versus ") || lower.includes("compare ");
    const isPortfolioQuery = lower.includes("portfolio") || lower.startsWith("track ") || lower.includes("analyze my") || lower.includes("analyze portfolio");

    setLoading(true);
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");

    if (isCompareQuery) {
      try {
        const sessionId = getSessionId() || await startSession();
        const res = await fetch(`${API_URL}/compare/from-chat`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: question, session_id: sessionId }),
        });
        const data = await res.json();
        if (data.session_id) setSessionId(data.session_id);
        if (data.ticker_a && data.ticker_b) {
          setCompareA(data.ticker_a); setCompareB(data.ticker_b);
          setCompareData(data); setActiveTab("compare");
          fetchSentiment(data.ticker_a); fetchSentiment(data.ticker_b);
          setMessages(prev => [...prev, { role: "assistant", content: data.verdict, sources: ["Yahoo Finance (real-time)"], responseTime: null }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: data.detail || "Could not find two tickers. Try: 'compare AAPL vs TSLA'", sources: [] }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: "assistant", content: "Comparison failed. Please try again.", sources: [] }]);
      }
      setLoading(false); return;
    }

    if (isPortfolioQuery) {
      try {
        const sessionId = getSessionId() || await startSession();
        const res = await fetch(`${API_URL}/portfolio/from-chat`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: question, session_id: sessionId }),
        });
        const data = await res.json();
        if (data.session_id) setSessionId(data.session_id);
        if (data.tickers) {
          setPortfolio(data.tickers); setPortfolioData(data);
          data.tickers.forEach(t => fetchSentiment(t));
          setMessages(prev => [...prev, { role: "assistant", content: data.summary, sources: ["Yahoo Finance (real-time)", "Yahoo Finance (earnings)"], responseTime: null }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: data.detail || "No tickers found. Try: 'analyze portfolio AAPL TSLA NVDA'", sources: [] }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: "assistant", content: "Portfolio analysis failed. Please try again.", sources: [] }]);
      }
      setLoading(false); return;
    }

    try {
      const sessionId = getSessionId() || await startSession();
      const res = await fetch(`${API_URL}/ask`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, include_sources: true, session_id: sessionId, time_range: timeRange }),
      });
      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources, responseTime: data.response_time }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Make sure the Quantiq backend is running.", sources: [] }]);
    }
    setLoading(false);
  };

  const handleNewChat = async () => {
    await clearSession();
    setMessages([{ role: "assistant", content: "New conversation started. What would you like to know?", sources: [] }]);
  };

  const tabStyle = (tab) => ({
    flex: 1, padding: "7px 0", fontSize: 10, fontWeight: 600,
    letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer",
    border: "none", fontFamily: "'DM Sans', sans-serif",
    background: activeTab === tab ? "#161b22" : "transparent",
    color: activeTab === tab ? "#f7c843" : "#8b949e",
    borderBottom: activeTab === tab ? "2px solid #f7c843" : "2px solid transparent",
    transition: "all 0.15s",
  });

  const activeAlerts   = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div style={{ minHeight: "100vh", background: "#010409", fontFamily: "'DM Sans', sans-serif", color: "#e6edf3", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #010409; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        textarea:focus, input:focus, select { outline: none; }
        .alert-notif {
          display: flex; align-items: flex-start; gap: 8px;
          background: #1a2332; border: 1px solid #2d4a6e;
          border-radius: 10px; padding: 10px 12px;
          font-size: 12px; color: #79c0ff; margin-bottom: 8px;
          animation: slideIn 0.2s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Alert toasts ── */}
      {triggeredNotifs.length > 0 && (
        <div style={{ position: "fixed", top: 80, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
          {triggeredNotifs.map((n, i) => (
            <div key={i} style={{ background: "#1a2332", border: "1px solid #2d4a6e", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#79c0ff", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "slideIn 0.2s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 3, color: "#f7c843", fontFamily: "'DM Mono', monospace" }}>🔔 {n.ticker} Alert Triggered</div>
                  <div style={{ color: "#8b949e" }}>Price {n.direction} ${n.threshold} — hit ${n.triggered_price}</div>
                </div>
                <button onClick={() => dismissNotif(i)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <header style={{ borderBottom: "1px solid #21262d", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "#f7c843", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💹</div>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: "#e6edf3" }}>Quantiq</div>
            <div style={{ fontSize: 11, color: "#8b949e" }}>Real-time market intelligence</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#3fb950", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950" }} />Live
          </div>
          <button onClick={handleNewChat} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#8b949e", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}
            onMouseEnter={e => { e.target.style.borderColor = "#f7c843"; e.target.style.color = "#f7c843"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#21262d"; e.target.style.color = "#8b949e"; }}>
            + New chat
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr 380px", overflow: "hidden", height: "calc(100vh - 69px)" }}>

        {/* ── Left Panel ── */}
        <div style={{ borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", background: "#0d1117" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #21262d" }}>
            <button style={tabStyle("watchlist")} onClick={() => setActiveTab("watchlist")}>Watch</button>
            <button style={tabStyle("compare")}   onClick={() => setActiveTab("compare")}>Compare</button>
            <button style={tabStyle("portfolio")} onClick={() => setActiveTab("portfolio")}>Portfolio</button>
            <button style={{ ...tabStyle("alerts"), position: "relative" }} onClick={() => { setActiveTab("alerts"); fetchAlerts(); }}>
              Alerts
              {activeAlerts.length > 0 && (
                <span style={{ position: "absolute", top: 4, right: 4, background: "#f7c843", color: "#0d1117", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {activeAlerts.length}
                </span>
              )}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

            {/* ── Watchlist Tab ── */}
            {activeTab === "watchlist" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {WATCHLIST.map(stock => (
                  <StockCard key={stock.ticker} stock={stock}
                    isSelected={selectedStock.ticker === stock.ticker}
                    onClick={() => setSelectedStock(stock)}
                    sentiment={sentiments[stock.ticker] ?? null}
                    sentimentLoading={sentimentLoading[stock.ticker] ?? false}
                  />
                ))}
              </div>
            )}

            {/* ── Compare Tab ── */}
            {activeTab === "compare" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Enter two tickers to compare side by side</div>
                <input value={compareA} onChange={e => setCompareA(e.target.value.toUpperCase())} placeholder="Ticker A (e.g. AAPL)"
                  style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
                <div style={{ textAlign: "center", fontSize: 11, color: "#8b949e" }}>vs</div>
                <input value={compareB} onChange={e => setCompareB(e.target.value.toUpperCase())} placeholder="Ticker B (e.g. TSLA)"
                  style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }}
                  onKeyDown={e => e.key === "Enter" && runComparison()} />
                <button onClick={() => runComparison()} disabled={compareLoading || !compareA || !compareB}
                  style={{ width: "100%", background: (compareLoading || !compareA || !compareB) ? "#21262d" : "#f7c843", color: (compareLoading || !compareA || !compareB) ? "#8b949e" : "#0d1117", border: "none", borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>
                  {compareLoading ? "Comparing..." : "Compare"}
                </button>
                {compareData && !compareData.error && (
                  <div style={{ marginTop: 8 }}>
                    <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />
                    {compareData.verdict && (
                      <div style={{ marginTop: 10, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 12, fontSize: 11, color: "#8b949e", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                        {compareData.verdict}
                      </div>
                    )}
                  </div>
                )}
                {compareData?.error && <div style={{ fontSize: 11, color: "#f85149" }}>{compareData.error}</div>}
              </div>
            )}

            {/* ── Portfolio Tab ── */}
            {activeTab === "portfolio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Add tickers to analyze your portfolio</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={portfolioInput} onChange={e => setPortfolioInput(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") { addToPortfolio(portfolioInput); setPortfolioInput(""); } }}
                    placeholder="Add ticker..."
                    style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#e6edf3", fontFamily: "'DM Sans', sans-serif" }} />
                  <button onClick={() => { addToPortfolio(portfolioInput); setPortfolioInput(""); }}
                    style={{ background: "#21262d", border: "none", borderRadius: 8, padding: "6px 10px", color: "#f7c843", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>+</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {portfolio.map(ticker => (
                    <div key={ticker} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#f7c843", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 6 }}>
                      {ticker}
                      <span onClick={() => removeFromPortfolio(ticker)} style={{ color: "#8b949e", cursor: "pointer", fontSize: 14 }}>×</span>
                    </div>
                  ))}
                </div>
                {portfolio.length > 0 && (
                  <button onClick={() => runPortfolioAnalysis()} disabled={portfolioLoading}
                    style={{ width: "100%", background: portfolioLoading ? "#21262d" : "#f7c843", color: portfolioLoading ? "#8b949e" : "#0d1117", border: "none", borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>
                    {portfolioLoading ? "Analyzing..." : `Analyze ${portfolio.length} stock${portfolio.length > 1 ? "s" : ""}`}
                  </button>
                )}
                {portfolioData && !portfolioData.error && portfolioData.tickers && (
                  <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 12 }}>
                    {portfolioData.tickers.map(ticker => {
                      const s = portfolioData.breakdown?.[ticker]?.stock || "";
                      const price  = s.match(/Current Price: \$([^\n]+)/)?.[1];
                      const change = s.match(/5-Day Change: ([^\n]+)/)?.[1];
                      const pe     = s.match(/P\/E Ratio: ([^\n]+)/)?.[1];
                      const eps    = s.match(/EPS: ([^\n]+)/)?.[1];
                      const relVol = s.match(/Relative Volume: ([^\n]+)/)?.[1];
                      const sent   = sentiments[ticker];
                      return (
                        <div key={ticker} style={{ padding: "8px 0", borderBottom: "1px solid #21262d" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#f7c843", fontWeight: 700 }}>{ticker}</span>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }}>{price ? `$${price}` : "—"}</div>
                              <div style={{ fontSize: 11, color: change?.includes("-") ? "#f85149" : "#3fb950" }}>{change || "—"}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            {pe     && <span style={{ fontSize: 10, color: "#8b949e" }}>P/E {pe}</span>}
                            {eps    && <span style={{ fontSize: 10, color: "#8b949e" }}>EPS {eps}</span>}
                            {relVol && <span style={{ fontSize: 10, color: "#8b949e" }}>Vol {relVol}</span>}
                            {sent   && <span style={{ fontSize: 10, color: sentimentColor(sent.score), fontWeight: 600 }}>● {sent.label} {sent.score}</span>}
                          </div>
                          {/* Mini sentiment bar in portfolio list */}
                          <SentimentBar score={sent?.score ?? null} loading={sentimentLoading[ticker] ?? false} />
                        </div>
                      );
                    })}
                    {portfolioData.summary && (
                      <div style={{ marginTop: 10, fontSize: 11, color: "#8b949e", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 140, overflowY: "auto" }}>
                        {portfolioData.summary}
                      </div>
                    )}
                  </div>
                )}
                {portfolioData?.error && <div style={{ fontSize: 11, color: "#f85149" }}>{portfolioData.error}</div>}
              </div>
            )}

            {/* ── Alerts Tab ── */}
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
                <div style={{ fontSize: 11, color: "#8b949e" }}>Set a price alert — get notified in-app and by email</div>
                <input value={alertTicker} onChange={e => setAlertTicker(e.target.value.toUpperCase())} placeholder="Ticker (e.g. AAPL)"
                  style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)} placeholder="Price ($)" type="number" min="0" step="0.01"
                    style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#e6edf3", fontFamily: "'DM Mono', monospace" }} />
                  <select value={alertDirection} onChange={e => setAlertDirection(e.target.value)}
                    style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#e6edf3", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    <option value="above">Above ↑</option>
                    <option value="below">Below ↓</option>
                  </select>
                </div>
                <button onClick={createAlert} disabled={alertCreating || !alertTicker.trim() || !alertThreshold}
                  style={{ width: "100%", background: (alertCreating || !alertTicker.trim() || !alertThreshold) ? "#21262d" : "#f7c843", color: (alertCreating || !alertTicker.trim() || !alertThreshold) ? "#8b949e" : "#0d1117", border: "none", borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>
                  {alertCreating ? "Adding..." : "+ Add Alert"}
                </button>
                {alerts.length > 0 && (
                  <div style={{ borderTop: "1px solid #21262d", paddingTop: 12, marginTop: 4 }}>
                    {activeAlerts.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Active ({activeAlerts.length})</div>
                        {activeAlerts.map(a => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
                            <div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#f7c843", fontWeight: 700 }}>{a.ticker}</div>
                              <div style={{ fontSize: 10, color: "#8b949e", marginTop: 1 }}>{a.direction === "above" ? "↑ above" : "↓ below"} ${a.threshold}</div>
                            </div>
                            <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "1px solid #21262d", borderRadius: 6, padding: "3px 7px", color: "#8b949e", cursor: "pointer", fontSize: 11 }}>✕</button>
                          </div>
                        ))}
                      </>
                    )}
                    {triggeredAlerts.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", margin: "12px 0 8px" }}>Triggered</div>
                        {triggeredAlerts.map(a => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: "8px 12px", marginBottom: 6, opacity: 0.6 }}>
                            <div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#3fb950", fontWeight: 700 }}>✓ {a.ticker}</div>
                              <div style={{ fontSize: 10, color: "#8b949e", marginTop: 1 }}>hit ${a.triggered_price} ({a.direction} ${a.threshold})</div>
                            </div>
                            <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "1px solid #21262d", borderRadius: 6, padding: "3px 7px", color: "#8b949e", cursor: "pointer", fontSize: 11 }}>✕</button>
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
        </div>

        {/* ── Center Panel ── */}
        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {compareData && !compareData.error && compareData.ticker_a ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: "#f7c843", fontWeight: 700 }}>{compareData.ticker_a}</span>
                <span style={{ fontSize: 13, color: "#8b949e" }}>vs</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: "#f7c843", fontWeight: 700 }}>{compareData.ticker_b}</span>
                <button onClick={() => setCompareData(null)} style={{ marginLeft: "auto", background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#8b949e", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  ← Back
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>{compareData.ticker_a}</div>
                  <TradingViewChart ticker={compareData.ticker_a} height={220} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>{compareData.ticker_b}</div>
                  <TradingViewChart ticker={compareData.ticker_b} height={220} />
                </div>
              </div>
              <CompareTable data={compareData} ticker_a={compareData.ticker_a} ticker_b={compareData.ticker_b} />

              {/* Sentiment gauges side by side for compared tickers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <SentimentGauge
                  ticker={compareData.ticker_a}
                  sentiment={sentiments[compareData.ticker_a] ?? null}
                  loading={sentimentLoading[compareData.ticker_a] ?? false}
                />
                <SentimentGauge
                  ticker={compareData.ticker_b}
                  sentiment={sentiments[compareData.ticker_b] ?? null}
                  loading={sentimentLoading[compareData.ticker_b] ?? false}
                />
              </div>
            </>
          ) : (
            <>
              <MainChart stock={selectedStock} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Market Cap", value: "$3.76T" },
                  { label: "P/E Ratio",  value: "32.35"  },
                  { label: "EPS",        value: "$7.91"  },
                  { label: "Div Yield",  value: "0.41%"  },
                ].map((stat, i) => (
                  <div key={i} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>{stat.label}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#f7c843", fontWeight: 700 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Sentiment gauge for selected stock */}
              <SentimentGauge
                ticker={selectedStock.ticker}
                sentiment={sentiments[selectedStock.ticker] ?? null}
                loading={sentimentLoading[selectedStock.ticker] ?? false}
              />
            </>
          )}

          <div>
            <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Quick Ask</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 20, padding: "7px 14px", fontSize: 12, color: "#8b949e", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.target.style.borderColor = "#f7c843"; e.target.style.color = "#f7c843"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#21262d"; e.target.style.color = "#8b949e"; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Panel — Chat ── */}
        <div style={{ borderLeft: "1px solid #21262d", display: "flex", flexDirection: "column", background: "#0d1117" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Quantiq Advisor</span>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
              style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#8b949e", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              <option value="24h">24h</option>
              <option value="3d">3d</option>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="1y">1y</option>
            </select>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
            {loading && (
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", fontSize: 13, color: "#8b949e", display: "inline-block" }}>
                Quantiq is analyzing market data...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: "16px 20px", borderTop: "1px solid #21262d", display: "flex", gap: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
              placeholder="Ask or type 'compare AAPL vs TSLA'..."
              style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#e6edf3", fontFamily: "'DM Sans', sans-serif" }} />
            <button onClick={() => sendMessage(input)} disabled={loading}
              style={{ background: loading ? "#21262d" : "#f7c843", color: loading ? "#8b949e" : "#0d1117", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif" }}>
              {loading ? "..." : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}