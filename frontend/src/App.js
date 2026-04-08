import { useState, useRef, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const API_URL = "https://quantiq-go.onrender.com";

// ── Mock stock chart data (replace with real API later) ──
const generateChartData = (base, points = 30) => {
  let price = base;
  return Array.from({ length: points }, (_, i) => {
    price = price + (Math.random() - 0.48) * 4;
    return {
      day: `D${i + 1}`,
      price: parseFloat(price.toFixed(2)),
    };
  });
};

const WATCHLIST = [
  { ticker: "AAPL", name: "Apple Inc.", price: 255.92, change: +2.86, base: 248 },
  { ticker: "TSLA", name: "Tesla Inc.", price: 172.4,  change: -1.24, base: 175 },
  { ticker: "NVDA", name: "NVIDIA Corp.", price: 887.3, change: +3.51, base: 860 },
  { ticker: "MSFT", name: "Microsoft", price: 415.6,  change: +0.92, base: 410 },
];

const SUGGESTIONS = [
  "Should I buy AAPL right now?",
  "Explain dollar cost averaging",
  "Compare ETFs vs mutual funds",
  "How to build a ₹50,000/month budget?",
  "What is NVDA's earnings trend?",
];

// ── Custom Tooltip ──────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: "#0d1117",
        border: "1px solid #30363d",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        color: "#e6edf3",
      }}>
        ${payload[0].value}
      </div>
    );
  }
  return null;
};

// ── Stock Card ──────────────────────────────────────────
function StockCard({ stock, isSelected, onClick }) {
  const data = generateChartData(stock.base);
  const isUp = stock.change >= 0;

  return (
    <div onClick={onClick} style={{
      background: isSelected ? "#161b22" : "#0d1117",
      border: `1px solid ${isSelected ? "#f7c843" : "#21262d"}`,
      borderRadius: 14,
      padding: "16px 18px",
      cursor: "pointer",
      transition: "all 0.2s",
      position: "relative",
      overflow: "hidden",
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
                <stop offset="5%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="price"
              stroke={isUp ? "#3fb950" : "#f85149"}
              strokeWidth={1.5}
              fill={`url(#grad-${stock.ticker})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main Chart ──────────────────────────────────────────
function MainChart({ stock }) {
  const data = generateChartData(stock.base, 60);
  const isUp = stock.change >= 0;

  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #21262d",
      borderRadius: 16,
      padding: "24px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#f7c843", fontWeight: 700 }}>
            {stock.ticker}
          </span>
          <span style={{ fontSize: 13, color: "#8b949e", marginLeft: 10 }}>{stock.name}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, color: "#e6edf3", fontWeight: 700 }}>
            ${stock.price}
          </div>
          <div style={{ fontSize: 13, color: isUp ? "#3fb950" : "#f85149" }}>
            {isUp ? "▲" : "▼"} {Math.abs(stock.change)}% today
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.25} />
              <stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} interval={9} />
          <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `$${v}`} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={isUp ? "#3fb950" : "#f85149"}
            strokeWidth={2}
            fill="url(#mainGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Chat Bubble ─────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
    }}>
      <div style={{
        maxWidth: "82%",
        background: isUser ? "#f7c843" : "#161b22",
        color: isUser ? "#0d1117" : "#e6edf3",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        padding: "12px 16px",
        fontSize: 14,
        lineHeight: 1.6,
        border: isUser ? "none" : "1px solid #21262d",
      }}>
        {msg.content}
      </div>
      {msg.sources?.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {msg.sources.map((s, i) => (
            <span key={i} style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: 11,
              color: "#8b949e",
            }}>
              📡 {s}
            </span>
          ))}
          {msg.responseTime && (
            <span style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: 11,
              color: "#8b949e",
            }}>
              ⚡ {msg.responseTime}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ────────────────────────────────────────────
export default function App() {
  const [selectedStock, setSelectedStock] = useState(WATCHLIST[0]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm Quantiq, your AI-powered financial advisor with real-time market data. Ask me about stocks, budgeting, investments, or anything finance-related.",
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");

    try {
      const res = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, include_sources: true }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        responseTime: data.response_time,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Connection error. Make sure the Quantiq backend is running on port 8000.",
        sources: [],
      }]);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#010409",
      fontFamily: "'DM Sans', sans-serif",
      color: "#e6edf3",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #010409; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        textarea:focus, input:focus { outline: none; }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid #21262d",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d1117",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            background: "#f7c843",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>💹</div>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: "#e6edf3" }}>
              Quantiq
            </div>
            <div style={{ fontSize: 11, color: "#8b949e" }}>Real-time market intelligence</div>
          </div>
        </div>
        <div style={{
          background: "#161b22",
          border: "1px solid #21262d",
          borderRadius: 20,
          padding: "6px 14px",
          fontSize: 12,
          color: "#3fb950",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950" }} />
          Live
        </div>
      </header>

      {/* Body */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "300px 1fr 380px",
        gap: 0,
        overflow: "hidden",
        height: "calc(100vh - 69px)",
      }}>

        {/* Left — Watchlist */}
        <div style={{
          borderRight: "1px solid #21262d",
          padding: 20,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "#0d1117",
        }}>
          <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
            Watchlist
          </div>
          {WATCHLIST.map(stock => (
            <StockCard
              key={stock.ticker}
              stock={stock}
              isSelected={selectedStock.ticker === stock.ticker}
              onClick={() => setSelectedStock(stock)}
            />
          ))}
        </div>

        {/* Center — Chart */}
        <div style={{
          padding: 24,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}>
          <MainChart stock={selectedStock} />

          {/* Stats Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}>
            {[
              { label: "Market Cap", value: "$3.76T" },
              { label: "P/E Ratio", value: "32.35" },
              { label: "EPS", value: "$7.91" },
              { label: "Div Yield", value: "0.41%" },
            ].map((stat, i) => (
              <div key={i} style={{
                background: "#0d1117",
                border: "1px solid #21262d",
                borderRadius: 12,
                padding: "14px 16px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>{stat.label}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#f7c843", fontWeight: 700 }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          <div>
            <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              Quick Ask
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} style={{
                  background: "#0d1117",
                  border: "1px solid #21262d",
                  borderRadius: 20,
                  padding: "7px 14px",
                  fontSize: 12,
                  color: "#8b949e",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.target.style.borderColor = "#f7c843"; e.target.style.color = "#f7c843"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#21262d"; e.target.style.color = "#8b949e"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Chat */}
        <div style={{
          borderLeft: "1px solid #21262d",
          display: "flex",
          flexDirection: "column",
          background: "#0d1117",
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #21262d",
            fontSize: 13,
            fontWeight: 600,
            color: "#e6edf3",
          }}>
            Quantiq Advisor
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
          }}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
            {loading && (
              <div style={{
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: "18px 18px 18px 4px",
                padding: "12px 16px",
                fontSize: 13,
                color: "#8b949e",
                display: "inline-block",
              }}>
                Quantiq is analyzing market data...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "16px 20px",
            borderTop: "1px solid #21262d",
            display: "flex",
            gap: 10,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage(input)}
              placeholder="Ask Quantiq about stocks, budgeting..."
              style={{
                flex: 1,
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                color: "#e6edf3",
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading}
              style={{
                background: loading ? "#21262d" : "#f7c843",
                color: loading ? "#8b949e" : "#0d1117",
                border: "none",
                borderRadius: 12,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}