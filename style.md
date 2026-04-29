# Fintrest — Google Stitch UI Prompt

## 🎨 Design Direction: Refined Minimalism

**Design Philosophy:** Clean, data-first financial interface. Every pixel earns its place. Inspired by Bloomberg Terminal's density, distilled through the restraint of Swiss graphic design. Dark neutral base with precise typographic hierarchy. No chrome, no noise — just data and clarity.

---

## 📐 Typography

**Primary Display Font:** `DM Serif Display` — for headings, ticker names, and prominent numbers. Gives warmth and authority to financial data.

**Secondary / Body Font:** `DM Sans` — clean, geometric, highly legible for data labels, descriptions, and UI copy.

**Monospace (for prices/numbers):** `JetBrains Mono` — tabular numbers, price tickers, percentage changes. Ensures perfect numerical alignment.

**Font Scale:**
- Hero/Ticker Price: 48px DM Serif Display, weight 400
- Section Heading: 20px DM Sans, weight 600
- Body/Description: 14px DM Sans, weight 400
- Data Label: 12px DM Sans, weight 500, letter-spacing 0.08em UPPERCASE
- Price/Number: 16–32px JetBrains Mono, weight 500

---

## 🎨 Color Palette

```
Background (Base):        #0F0F11   — Near-black, slightly warm
Surface (Cards):          #17171A   — 1-level elevation
Surface 2 (Hover/Input):  #1E1E24   — 2-level elevation
Border (Subtle):          #2A2A32   — Hairline dividers
Border (Active):          #3D3D4A   — Focused elements

Text Primary:             #F0EEE8   — Warm off-white (not harsh white)
Text Secondary:           #8C8A9A   — Muted lavender-gray
Text Tertiary:            #5A5868   — Disabled / timestamps

Accent (Brand):           #C8A96E   — Warm gold — used ONLY for key highlights
                                       (price changes +, CTA buttons, active tabs)

Positive (Bullish):       #4CAF7D   — Muted green
Negative (Bearish):       #E05C5C   — Muted red
Neutral:                  #B8A860   — Warm amber

Sentiment Gauge:
  Bearish gradient:       #E05C5C → #C8813A
  Neutral:                #C8813A → #C8A96E
  Bullish gradient:       #C8A96E → #4CAF7D
```

**Rule:** Gold accent `#C8A96E` appears on maximum 3 elements per screen. Everything else is monochromatic. This makes accent moments feel precious.

---

## 📱 Layout & Structure

### Overall Shell
- Full-height app, two-panel on desktop (sidebar nav + main content)
- Bottom tab bar on mobile (4 tabs: Market, Chat, Watchlist, More)
- No top navbar — branding is in the sidebar only
- Max content width: 1200px, centered
- Sidebar width: 220px (collapsed: 64px icon-only)
- Content padding: 24px desktop / 16px mobile

### Grid System
- 12-column grid inside content area
- Gutter: 16px
- Cards use 4-col / 6-col / 12-col spans depending on context

---

## 🧩 Component Specifications

### 1. Sidebar Navigation
- Dark `#0F0F11` background — blends with page
- Brand mark: Aperture icon (SVG) + "Fintrest" in DM Serif Display 18px gold
- Nav items: icon + label, 44px height, 12px horizontal padding
- Active state: left border 2px solid `#C8A96E`, background `#17171A`, text white
- Hover state: background `#17171A`, 200ms ease transition
- Bottom of sidebar: user avatar + email (truncated) + logout icon

### 2. Stock / Asset Card
- Background: `#17171A`, border-radius 12px, border 1px solid `#2A2A32`
- Header: ticker symbol in JetBrains Mono 13px uppercase muted, company name in DM Sans 16px white
- Price: DM Serif Display 36px, color white
- Change badge: pill shape, +2.34% in JetBrains Mono 13px
  - Positive: background `rgba(76,175,125,0.12)`, text `#4CAF7D`
  - Negative: background `rgba(224,92,92,0.12)`, text `#E05C5C`
- Metadata row: PE Ratio · Market Cap · 52W Range — DM Sans 12px muted, separated by `·`
- Hover: border-color elevates to `#3D3D4A`, subtle shadow `0 4px 24px rgba(0,0,0,0.4)`
- Transition: all 180ms ease

### 3. OHLC Candlestick Chart
- Background: transparent (sits on card)
- Grid lines: `#2A2A32`, 1px dashed
- Candle up: `#4CAF7D`
- Candle down: `#E05C5C`
- Crosshair: `#5A5868`, 1px dotted
- Time axis: JetBrains Mono 11px `#5A5868`
- Price axis: JetBrains Mono 11px `#8C8A9A`, right-aligned
- Volume bars: 30% opacity, same color as candle
- Time range pills above chart: "1W · 1M · 3M · 6M · 1Y" — DM Sans 12px, active pill gets gold underline

### 4. Sentiment Gauge
- Arc gauge, 180° half-circle
- Width: 200px, centered in card
- Track: `#2A2A32`
- Fill: gradient per score (Bearish red → Neutral amber → Bullish green)
- Needle: thin white line, 2px, with small circle tip
- Center below arc: Score number in DM Serif Display 32px, Label in DM Sans 12px UPPERCASE muted
- Below gauge: scrollable headline list
  - Each headline: 13px DM Sans, 1 line truncated, impact score badge (1–10 pill) on right
  - Positive impact (7–10): `#4CAF7D` pill
  - Negative impact (1–3): `#E05C5C` pill
  - Neutral (4–6): `#8C8A9A` pill

### 5. Chat Interface
- Full-height scrollable message list
- User bubble: right-aligned, background `#C8A96E` at 15% opacity, border `1px solid rgba(200,169,110,0.3)`, DM Sans 14px text white, border-radius 16px 16px 4px 16px
- Assistant bubble: left-aligned, background `#17171A`, border `1px solid #2A2A32`, border-radius 4px 16px 16px 16px, DM Sans 14px text `#F0EEE8`
- Typing indicator: 3 dots animation, `#8C8A9A`
- Input bar: fixed at bottom, background `#17171A`, border-top `1px solid #2A2A32`, padding 12px 16px
  - Input field: DM Sans 14px, no border, transparent background, placeholder `#5A5868`
  - Send button: gold icon, hover scale 1.05

### 6. Watchlist Table
- Full-width, no outer card border
- Column headers: DM Sans 11px UPPERCASE letter-spacing 0.1em, `#5A5868`
- Columns: Ticker · Name · Price · Change · Sentiment
- Each row: 52px height, border-bottom `1px solid #1E1E24`
- Row hover: background `#17171A`
- Ticker: JetBrains Mono 13px white
- Name: DM Sans 13px `#8C8A9A`
- Price: JetBrains Mono 14px white
- Change: colored pill (same as card)
- Sentiment: mini horizontal bar (64px wide), colored by label
- Row click: opens stock detail panel or navigates to Market tab

### 7. Portfolio Breakdown
- Header: "Portfolio Overview" DM Serif Display 22px
- Summary card: full-width, gradient left border 3px (green-to-gold), AI-generated text in DM Sans 14px line-height 1.7
- Per-ticker grid: 3 columns (desktop), each is a mini card with ticker + price + mini sparkline
- Sparkline: 48px tall Recharts AreaChart, no axes, green/red fill based on change direction

### 8. Comparison Panel
- Two cards side by side with a VS divider in center
- VS: DM Serif Display 24px `#2A2A32`, vertically centered
- Each card: same as stock card but compact
- Verdict section below: full-width card with gold left border, LLM text

### 9. Forex Card
- Currency pair: "EUR / USD" — DM Serif Display 28px
- Flag icons (emoji fallback acceptable): 24px
- Rate: JetBrains Mono 36px
- Trend: small Recharts LineChart, 80px tall, no axes
- AI insight text below in DM Sans 13px `#8C8A9A`

### 10. Price Alert Form
- Inline form (not modal), slides in from right on mobile
- Input: ticker symbol + threshold price + direction toggle (Above/Below)
- Direction toggle: pill toggle, selected = gold background
- Active alerts list: each as a row with ticker, threshold, direction, delete icon
- Triggered alerts: gold dot indicator + strikethrough styling

### 11. Auth Screens (Login / Register)
- Centered card, max-width 400px
- Background: `#0F0F11` full page
- Card: `#17171A`, border `1px solid #2A2A32`, border-radius 16px, padding 40px
- Brand mark at top, centered
- Inputs: border-bottom only style (no box), DM Sans 14px, focus: border-color gold
- Submit button: full-width, background `#C8A96E`, text `#0F0F11` DM Sans 15px weight 600, border-radius 8px, hover: brightness 1.1

---

## ✨ Micro-interactions & Motion

- **Page load:** Cards fade-in with staggered 60ms delay per card, translateY(12px) → 0
- **Tab switch:** Content crossfades, 150ms ease
- **Price update (live refresh):** Number flashes — positive: brief green glow, negative: red glow, 400ms animation
- **Chat message send:** User bubble slides in from right, 200ms ease-out
- **Watchlist row add:** Row slides in from top, height expands from 0
- **Sentiment gauge:** Arc draws from 0 to score value on mount, 800ms ease-in-out
- **Chart tooltip:** Smooth follow crosshair, appears without jank
- **Hover on cards:** Subtle lift via `transform: translateY(-2px)`, 180ms ease
- **Button press:** `transform: scale(0.97)`, 80ms — snappy, tactile feel

---

## 📊 Data Density Rules

- **Market tab:** High density — show as much data as possible without clutter
- **Chat tab:** Low density — wide open, generous spacing, readable
- **Watchlist tab:** Medium density — table rows compact but not cramped
- **More tab (Compare/Portfolio/Alerts):** Variable — each sub-section breathes

**Empty states:** When no data (empty watchlist, no alerts), show a minimal centered message — icon + 1 line DM Serif Display 18px + 1 line DM Sans 14px muted. No illustrations.

---

## 🔤 Copy Tone

- Headings: Precise and data-driven. "Portfolio Overview" not "Your Investments"
- AI responses: Professional analyst tone. No emojis.
- Error states: Direct. "Unable to fetch data for AAPL." Not "Oops!"
- Empty states: Minimal. "No alerts set." not "You haven't created any alerts yet, get started by..."
- Loading: "Fetching market data…" in DM Sans 13px muted, with a thin progress line (not spinner)

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| < 640px (Mobile) | Single column, bottom tab nav, no sidebar |
| 640–1024px (Tablet) | Two column, icon-only sidebar (64px) |
| > 1024px (Desktop) | Full sidebar (220px) + content |

---

## 🧱 Spacing System (8px Base Grid)

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Inline gaps, icon padding |
| `space-2` | 8px | Tight component padding |
| `space-3` | 12px | Form field padding |
| `space-4` | 16px | Card padding (mobile) |
| `space-6` | 24px | Card padding (desktop) |
| `space-8` | 32px | Section gaps |
| `space-12` | 48px | Large section gaps |

---

## ✅ What to Build First (Priority Order for Stitch)

1. **App Shell** — sidebar + main content area + mobile bottom tabs
2. **Market Tab** — stock card + OHLC chart + sentiment gauge
3. **Chat Tab** — message list + input bar
4. **Watchlist Tab** — data table with live enrichment
5. **Auth Screens** — login + register
6. **More Tab** — compare + portfolio + alerts

---

## 🚫 Do NOT

- No purple gradients anywhere
- No white backgrounds
- No rounded buttons with shadow (flat design only)
- No loading spinners — use skeleton loaders or progress lines
- No modal popups — use slide-in panels or inline expansion
- No bold colors on large areas — only accents
- No Inter or Roboto fonts
- No dark mode toggle — app is dark-only
- No card drop shadows with color — only `rgba(0,0,0,X)` shadows