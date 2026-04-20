# Fintrest — Product Design Spec v1.0

*Translating the Aperture brand into the actual product. Dark mode first, editorial restraint throughout. Source of truth for the brand: `fintrest-aperture-spec.md`. This doc is the source of truth for the product.*

---

## Design Philosophy (the filter every decision passes through)

Three sentences to keep on the wall:

1. **One number per screen.** Every screen has a single hero metric. Everything else is a supporting detail. If a screen has two heroes, it has none.
2. **Color is information, not decoration.** Evergreen only appears when it means something. A green button is a specific communication. A green number is a specific communication. Never decorative.
3. **Calm is the feature.** Users don't open Fintrest to feel excited. They open it to feel in control. Every interaction should leave them calmer than it found them.

---

## 1. Core App Screens

### 1.1 Home Dashboard

**What it's for:** The user's one-glance answer to "how am I doing?"

**Layout hierarchy (top → bottom):**

1. **Status bar + greeting** (32px top) — "Good morning, Ayush" in 14px NHG, Mist. No avatar, no notification bell (notifications live in Activity). Serif small-caps section label "OVERVIEW" sits 12px above the greeting for structural rhythm.
2. **Net Worth — the hero** (96px tall) — JetBrains Mono, 56pt, tabular. Format: `$128,402.18`. Cents are 0.6× the size of dollars (visual de-emphasis). Color: Pearl, always. Never green when up, never red when down — the value is the fact, the delta is the opinion.
3. **Delta strip** (24px below hero) — `+$412.80 today` in Mono, 14pt. Delta sign color: Pearl by default. Evergreen ONLY if user has manually toggled "show color" in Settings. Default-off is a feature.
4. **Sparkline** (120px tall, full-width with 24px h-padding) — single 1.5px Pearl line, no axis, no gridlines, no labels, no fill below. Last 90 days of net worth. The only chart on the home screen.
5. **Accounts strip** (horizontal scroll, 140px tall cards) — 3-4 cards, each: account name (NHG 13pt Mist), balance (Mono 22pt Pearl), tiny institution mark bottom-right. Swipe horizontally.
6. **Today's Insight** (single card, full-width, 24px padding, 160px minimum height) — 1 paragraph of serif prose (GT Super 17pt, line-height 1.45), 2-3 sentences. Numbers in the prose set in Mono inline. Tiny V3 single-blade glyph top-right.
7. **Recent Activity** (3 rows, collapsed) — "See all" link right-aligned in Pearl with 1px underline.

**Typography map:**
- Section labels (OVERVIEW, ACCOUNTS, etc.): GT Super small-caps, 10pt, letter-spacing +200, Mist
- All numbers: JetBrains Mono, tabular, Pearl
- Everything else (greetings, account names, insight prose): NHG for UI, GT Super for editorial moments (insight prose, section labels)

**Aperture usage:** Bottom nav tab indicator when Home is active — a 20px V2 outlined aperture above the "Home" label, Pearl. Nowhere else. No big logo anywhere on this screen.

---

### 1.2 Portfolio / Investments

**What it's for:** A calm read on investment performance without turning the user into a day trader.

**Layout hierarchy:**

1. **Portfolio value** — hero number, Mono 52pt, Pearl. Same treatment as Home net worth.
2. **Delta row** — two stacked lines of Mono:
   - Line 1: `+$1,240.18` today (14pt, Pearl)
   - Line 2: `+2.4% · YTD +18.2%` (11pt, Mist)
   Color follows the same "neutral by default" rule as Home. Only the *Evergreen glow halo* (see §3.2) signals gains.
3. **Time range toggle** — `1D · 1W · 1M · 1Y · ALL` in GT Super small-caps, 10pt, letter-spacing +200. Active range is Pearl; inactive is Mist. No pill background, no border — just color shift. One of those micro-details that moves the product upmarket.
4. **Chart** (240px tall) — single Pearl line, no grid, no axes, no labels until user taps. On tap: a crosshair appears with the value at that point floating in Mono. Long-press to drag through history.
5. **Asset allocation strip** (80px tall, horizontal bar) — a single horizontal bar divided into segments by asset class (Stocks, Bonds, Cash, etc.). Each segment is a different shade of Pearl→Mist→Carbon. No color coding by class. Labels below segments in GT Super small-caps.
6. **Holdings list** — rows with:
   - Left: company name (NHG 15pt Pearl)
   - Below name: ticker (Mono 11pt Mist)
   - Right: position value (Mono 15pt Pearl, right-aligned, tabular)
   - Below value: delta (Mono 11pt Mist, right-aligned)
   - Row height: 64px, 16px vertical rhythm
   - Divider: 1px `#1C1F22` between rows
7. **Add position** — text link at bottom, `+ Add a position`, Pearl, centered. Not a floating action button. Not a prominent CTA.

**Typography map:**
- Company names: NHG
- Tickers: Mono (signals "terminal of your money" — Mercury does this, works)
- All prices and percentages: Mono
- Time ranges and labels: GT Super small-caps

**Aperture usage:** When a holding crosses a meaningful threshold (configurable, default ±5%), a 1px Evergreen glow appears on the *left edge* of that row — 48px tall, 2px wide, blurred. Whisper of signal.

---

### 1.3 Insights / AI Recommendations

**What it's for:** The "smart" part of Fintrest. This is the editorial room. Not a chatbot.

**Layout hierarchy:**

1. **Week header** — "Week of April 20" in GT Super small-caps, 12pt, Mist. Above it: the text "THIS WEEK" in the same treatment but 10pt.
2. **The Insight** (hero editorial block) — 3-4 paragraphs of GT Super 18pt prose, line-height 1.5, Pearl. Max width: 560pt centered. Numbers in Mono inline at the same size. This is the only screen where serif is the body copy.
3. **Signal row** (below the insight) — 3 pills showing what Fintrest noticed: `Spending ↓ · Cash flow +12% · Goal on track`. Each pill: GT Super small-caps 10pt, Mist, 1px Mist underline. No pill background.
4. **Pinned insights carousel** — 3-5 cards, horizontal scroll. Each card: 280pt × 180pt, Carbon Lifted bg, 16px radius, 24px padding. Each card has a V3 single-blade glyph top-right — filled blade = high-confidence insight, outlined blade = exploratory.
5. **Ask bar** (bottom, sticky) — a quiet text input: "Ask Fintrest something". NHG 14pt placeholder in Mist. No sparkle icon. No "AI" label. The product is AI; it doesn't need to advertise.

**Typography map:**
- Editorial prose: GT Super 18pt (the only screen where serif is body)
- Numbers in prose: JetBrains Mono 18pt (matches the serif's optical weight)
- Signal pills and small labels: GT Super small-caps 10pt
- Ask bar: NHG 14pt

**Aperture usage:** On scroll-enter, the insight block does a one-time aperture-reveal: it fades in from an iris mask centered on the first character. 400ms, ease-out-quint. Only the first time the card enters viewport per session.

---

### 1.4 Transaction / Activity

**What it's for:** Finding the $47 charge. Should feel like a well-designed statement, not a feed.

**Layout hierarchy:**

1. **Search bar** (top, sticky, 48px tall) — Carbon Lifted bg, 12px radius. No icon. Placeholder: "Search transactions" in NHG 14pt Mist. Entering search dims the rest of the screen to 40% and shows results inline.
2. **Filter row** (beneath search, horizontal scroll) — chips for categories, accounts, date range, amount range. Chip style: GT Super small-caps 10pt, Mist by default, Pearl when active, 1px Pearl underline when active (no bg fill).
3. **Date-grouped list**:
   - Date header: GT Super small-caps 10pt, letter-spacing +200, Mist, sticky on scroll
   - Row: 64px tall, 4px between rows (not 0 — breathing room matters)
   - Row contents:
     - Left: Merchant name (NHG 15pt Pearl), below: category chip (GT Super small-caps 9pt Mist)
     - Right: Amount (Mono 15pt, tabular, right-aligned). Negative amounts (outgoing) are Pearl; positive (incoming) are Pearl; never colored by default.
4. **Tap on a transaction** → the row "opens" via aperture iris expansion (see §3.5). The opened state shows: map thumbnail (if location), category edit, split/refund options, notes field. No modal.

**Typography map:**
- Merchant names: NHG (sans, because merchants are brands)
- Category labels: GT Super small-caps (editorial feel for taxonomy)
- All amounts: JetBrains Mono, tabular, right-aligned (critical — numbers must line up in columns)
- Date headers: GT Super small-caps

**Aperture usage:** The transaction-open animation is an aperture iris expansion — 260ms ease-out-quint, the detail view emerges from the tap point like a blade opening outward. This is the single most-used branded interaction in the app.

---

### 1.5 Onboarding (first-time user)

**What it's for:** The brand's first impression. Don't over-explain. Let the aperture do the work.

**Sequence (5 screens max, one concept per screen):**

**Screen 01 — Welcome**
- Carbon background, full screen
- Aperture V1 mark centered, starts closed, slowly opens over 1200ms on mount
- Wordmark "fintrest" fades in below mark, 400ms after open completes (NHG 28pt, -2% tracking, Pearl)
- Single line of GT Super 24pt below wordmark: **"Grow what you have. Quietly."**
- CTA at bottom: `Get started` — Evergreen bg, Pearl text, 48px tall, 12px radius, bottom-padded 48px from safe area

**Screen 02 — Sign In**
- Three buttons stacked: `Continue with Apple`, `Continue with Google`, `Continue with email`
- Each 48px tall, 12px radius, Pearl border (1px), Pearl text, transparent bg
- No social logins (no Facebook, no Twitter) — signals a different user profile
- 16px between buttons
- "Privacy and terms" link at bottom in 11pt NHG Mist with underline

**Screen 03 — Connect your accounts**
- Section label top: "STEP 2" in GT Super small-caps 10pt Mist
- Large editorial headline: GT Super 32pt, Pearl: **"Let's read the last 90 days."**
- Paragraph below in NHG 15pt Mist: `Fintrest needs to see your accounts to find patterns. We don't store your bank login. Powered by Plaid.`
- CTA: `Connect an account` (Evergreen primary)
- Secondary link: `Skip for now` (Pearl text, underlined on tap)

**Screen 04 — The Read (the magic moment)**
- Triggered when Plaid finishes
- Aperture V1 rotates slowly in the center (2s loop, 1 full revolution)
- Single line of editorial serif text appears, letters fading in one word at a time (60ms stagger):
  **"We've read 812 transactions across 3 accounts."**
- 1200ms pause
- Second line appears: **"Here's the first thing we noticed."**
- Transitions to the first insight (same format as the Insights screen)
- This is the moment that earns the "smart like AI" positioning. No loading spinner, no progress bar — the aperture IS the loader.

**Screen 05 — First Insight + Goal**
- The AI's first observation, framed as editorial prose (GT Super 18pt, same as Insights screen)
- Below: `Let's set one goal.` — simple 3-option picker: `Save for something specific · Grow my investments · Just track for now`
- No gamification, no streaks to unlock, no reward preview
- Final CTA: `Open Fintrest` (Evergreen primary)

**Typography map throughout onboarding:**
- Headlines: GT Super 24-32pt (editorial gravitas)
- Body: NHG 15pt
- Buttons: NHG 15pt, weight 500

**Aperture usage:** The aperture is the glue between steps. Each step transition: aperture closes (200ms), black frame (40ms), aperture opens on the new step (240ms). Feels like pages turning in a well-made book.

---

## 2. Design System

### 2.1 Color tokens

```
/* Surfaces — dark mode (default) */
--carbon            #0F0F10   Background (all screens)
--carbon-lifted     #14181A   Cards, elevated surfaces
--carbon-border     #1C1F22   Hairline dividers, card borders
--obsidian          #0A0B0C   Deepest surface (modal underlays)

/* Text & marks */
--pearl             #FAFAF7   Primary text, primary mark
--mist              #A6ADB4   Secondary text, muted labels
--fog               #6B7178   Tertiary text, disabled states

/* Accent — use with restraint */
--evergreen         #1F5C46   Primary CTA, confirmed states, brand moments
--evergreen-glow    #1F5C46 @ 35%   Subtle glow/halo overlays

/* Alert — use very rarely */
--ember             #B24A2A   Destructive actions, real warnings (not "stock down")

/* Light mode (alternate) */
--bone              #EDE6D6   Light mode background (warm, never pure white)
--bone-lifted       #F5F1EA   Light mode cards
```

### 2.2 When to use Evergreen (the most abused token in fintech)

**Use Evergreen when:**
- Primary CTA buttons (1 per screen max — there is always exactly one primary action visible)
- Confirmation of a completed action (deposit confirmed, goal met, transfer sent)
- The tiny inner glow in the aperture icon (app icon only)
- The signal glow on portfolio rows crossing thresholds (§1.2)
- Focus state on form fields (2px outline)
- The left border of the "Today's Insight" card

**Never use Evergreen for:**
- Any positive number ("you made money" green). Numbers are Pearl. Always.
- Chart lines. Chart lines are Pearl.
- Success toasts (toasts shouldn't be Evergreen — they should be Carbon Lifted with a 2px Evergreen left border at most)
- Icons in the tab bar
- Backgrounds of cards
- Badges, pills, tags
- "New" indicators
- Decorative accents

Rule of thumb: there should be **at most one Evergreen element visible per screen at any time**. If you have two, one is wrong.

### 2.3 Spacing system

Base unit: **4px**. Everything is a multiple of 4.

```
--space-1    4px     Hairline gaps
--space-2    8px     Tight inline elements
--space-3    12px    Icon + label, pill padding
--space-4    16px    Between related items in a list
--space-5    24px    Card internal padding, screen h-padding on mobile
--space-6    32px    Between sections of a screen
--space-7    48px    Between major sections / vertical CTA anchoring
--space-8    64px    Screen-top spacing, hero areas
--space-9    96px    Reserved for the "breath" around hero numbers
--space-10   128px   Onboarding hero spacing
```

**Screen-level defaults:**
- Mobile screen h-padding: **24px**
- Mobile screen v-padding (top): **32px** below status bar
- Card padding: **24px**
- Section vertical rhythm: **48px** between logical sections

### 2.4 Card styles

**Default card:**
```
background:        var(--carbon-lifted)   #14181A
border:            1px solid var(--carbon-border)   #1C1F22
border-radius:     16px
padding:           24px
box-shadow:        none
```

Critical detail: the 1px `#1C1F22` border is almost invisible against the `#14181A` fill, but it picks up ambient light from the environment and gives the card an edge. This is the difference between "floating" (cheap) and "crafted" (premium).

**Emphasized card** (Today's Insight, onboarding hero):
```
+ left-border:     2px solid var(--evergreen)
+ padding-left:    22px   /* preserves content alignment */
```

**Interactive card** (tap-to-expand):
```
transition:        border-color 160ms ease-out
:active {
  border-color:    var(--pearl) @ 20%
}
```

No hover state. This is mobile-first.

### 2.5 Button styles

**Primary (Evergreen)**
```
height:            48px
padding:           0 24px
background:        var(--evergreen)
color:             var(--pearl)
border-radius:     12px
font:              NHG Medium, 15pt, letter-spacing -0.5%
shadow:            none
```
Use exactly once per screen.

**Secondary (outline)**
```
height:            48px
padding:           0 24px
background:        transparent
border:            1px solid var(--pearl)
color:             var(--pearl)
border-radius:     12px
font:              NHG Medium, 15pt
```

**Tertiary (text link)**
```
color:             var(--pearl)
font:              NHG Medium, 15pt
text-decoration:   underline
text-underline-offset: 4px
```

**Destructive**
```
Same as secondary, but border and text are var(--ember).
Do NOT fill with Ember. Destructive actions are quiet; the weight is in the confirm dialog, not the button.
```

**Disabled (any variant):**
```
opacity:  0.35   (no color shift, just opacity — preserves brand tokens)
```

No icons inside buttons by default. Buttons with leading icons are permitted only for third-party logos (Apple, Google login).

### 2.6 Icon usage

Three icon systems coexist; use the right one:

1. **Aperture marks (brand)** — only where the brand speaks:
   - V2 outline: bottom-nav active tab indicator, loading spinners, favicon
   - V3 single blade: Insights card confidence indicator, account-tier badges, Apple Watch complication
   - V1 solid: app icon only

2. **UI icons (system)** — Phosphor Icons (outline/regular weight) at 20px default:
   - Navigation glyphs (chevrons, search, close)
   - Category icons in filter chips
   - Merchant category icons (category icons in Activity — a subtle Phosphor outline icon to the *left* of the merchant category chip at 12px)
   - Color: Mist by default, Pearl when active
   - Stroke weight: 1.5px

3. **Merchant logos** — real brand logos for merchants (Stripe, Starbucks, etc.) at 32px, masked to 8px radius. Never replace with an emoji.

### 2.7 Dark mode behavior

**Dark mode is the default, not an alternate.** Light mode is the exception.

- System preference respected on first launch, but user can override
- When the user manually toggles, it persists and does not follow system
- Status bar always matches the app's background (no mismatch ever)
- Pure white (`#FFFFFF`) is banned — always use Pearl `#FAFAF7` or Bone `#EDE6D6`
- Pure black (`#000000`) is banned — always use Carbon `#0F0F10` or Obsidian `#0A0B0C`
- The reason: pure white/black shock the eye on OLED displays; Pearl/Carbon have slight warmth that reads as considered rather than default

**Light mode adjustments:**
- Backgrounds: Bone `#EDE6D6` (warm off-white, not clinical)
- Text: Carbon `#0F0F10`
- Cards: Bone Lifted `#F5F1EA` with 1px `#E3DBC8` border
- Evergreen stays the same — it works on both
- Aperture marks invert: V1 Carbon on Bone

---

## 3. Signature UX Moments

*Five "calm wow" interactions. Each is subtle enough that users might not consciously notice, but they'd notice if it were missing.*

### 3.1 The Balance Odometer

When any balance updates (new transaction, market tick, deposit lands), the number doesn't cut. Each digit transitions independently, flipping through the intermediate values like an airport split-flap display — but rendered in JetBrains Mono, not imagery.

- Duration: 280ms per digit
- Stagger: 40ms between digits (rightmost first, then propagates left)
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint — matches the aperture)
- No audio, no haptic
- Digits that don't change don't animate (only the digits that changed flip)

This is the single most-seen animation in the app. It needs to be perfect at 60fps, never janky.

### 3.2 The Inverted Chart

**Industry-standard:** chart line turns green when gains, red when losses.

**Fintrest:** the chart line is always Pearl. Gains are signaled by a faint Evergreen *halo* that lives UNDER the line, rendered as a vertical gradient fading down. Halo opacity = magnitude of gain, capped at 40%. Losses get no color — the line just goes down. Losses are not something to color-code; they're something to notice.

- Halo color: `--evergreen @ variable alpha`
- Halo blur: 24px Gaussian
- Halo anchors: bottom of chart container
- Updates: halo opacity tweens over 600ms when data refreshes

Why this works: it removes the dopamine loop of "green means good." Users stop checking the app to see green. The app becomes a tool, not a slot machine.

### 3.3 The Weekly Opening

Monday mornings at 7am local, the Fintrest app-icon badge shows a single V3 blade glyph in Evergreen (no number). When the user opens the app, the home screen's Insight card plays a one-time perimeter glow: a 2px Evergreen light travels around the card's border, completing a full loop over **800ms**, then vanishes. Once per week. Never repeats.

- This is the only "notification" visual in the product
- No push notifications for balance changes, no "your spending went up" alerts
- One signal per week, timed, perimeter glow, done

### 3.4 Haptic Weight

Every new transaction arriving in the app triggers a haptic scaled to the amount:

| Amount | Haptic |
|--------|--------|
| Under $10 | None |
| $10–$100 | `UIImpactFeedbackGenerator(.soft)` |
| $100–$1,000 | `.light` |
| $1,000–$10,000 | `.medium` |
| $10,000+ | `.rigid` (one short pulse, not heavy) |

Users feel the scale of their money. Over time, this teaches proportion — the app becomes embodied, not visual. No visual treatment needed; the haptic is the signal.

Settings toggle to disable (default ON).

### 3.5 Focus on a Number

Long-press any number anywhere in the app (800ms) to enter **Focus mode**:
- The rest of the screen dims to 40% opacity
- The held number scales to 1.1× with a subtle 1px Evergreen underline
- A contextual panel slides up from the bottom (Carbon Lifted card, 16px radius) with breakdowns, source transactions, calculations, time-range pivots
- Release finger: panel slides down, screen restores
- Haptic: `.soft` on enter, `.soft` on exit

This is the universal "tell me more" gesture in Fintrest. Works on net worth, balances, stock prices, category totals, insight numbers — any Mono number in the product.

### 3.6 Transaction Aperture Open

Tapping a transaction row in Activity plays a branded iris-wipe reveal:
- A circular mask centered on the tap point expands outward at **480px/sec**
- The mask reveals the transaction detail view (which replaces the list in place)
- During expansion, the 6-blade aperture mark flashes at 20% opacity in the mask's center for 180ms, then fades
- Easing: `cubic-bezier(0.65, 0, 0.35, 1)` (ease-in-out-cubic)

Back-swipe reverses: the detail collapses into the tapped row's position via the same iris.

---

## 4. What to AVOID

### 4.1 Fintech UI mistakes that break the Fintrest filter

Do not ship any of these. If a designer proposes one, push back.

**Color & decoration mistakes:**
- Green numbers by default for positive values (the Robinhood disease — users develop obsessive-checking behavior)
- Red numbers for losses (panic response, drives over-checking)
- Purple gradients (2019 neobank tell — Revolut, N26 original palette)
- Rainbow gradient charts (crypto tell)
- Gradient text
- Text shadows or strokes on numbers
- Emoji as category icons (🛒 for groceries) — reads as "shipped in 2 weeks"
- Colorful category chips with bespoke palette per category — inconsistent, noisy

**Gamification & dopamine loops:**
- Streaks ("You've saved 12 days in a row!") — creates anxiety, not discipline
- Progress bars for every goal — infantilizes the user
- Confetti or celebration animations — patronizing in a finance context
- Badges / achievements — this is not Duolingo
- Leaderboards, rankings, social comparisons ("You saved more than 73% of users") — weaponizes money against self-esteem
- Motivational copy ("You're crushing it this week!") — this is the user's money, not their CrossFit
- "Share your win" buttons on any screen — nobody should post "I saved $50 today"
- Mascot characters — unserious

**Structural UI mistakes:**
- More than 4 tab-bar items
- Floating action buttons (FABs) — Material Design 2018, reads as Google not Apple
- Bottom sheets for every secondary action (lazy default, overused)
- Tilted isometric card illustrations — fintech landing page 2020
- Hero photos of smiling diverse people — stock-photo tell
- Auto-playing video on app open
- Skeleton loaders everywhere (often janky, rarely better than a proper empty state)
- Pulsing "LIVE" indicators or ticker tape — crypto exchange tell
- Candlestick charts by default — trading bro aesthetic; reserve for Pro view only if ever
- Notification badges on every tab — "everything is urgent" = nothing is urgent

**Motion mistakes:**
- Spring physics / bounce easing — reads as consumer/toy, not tool
- Parallax scrolling on marketing surfaces that leaks into product
- Animations longer than 600ms for non-reveal interactions
- Lottie confetti anywhere

**Copy mistakes:**
- Exclamation points in product copy (reserve for errors only, and even then use periods)
- "Oops!" or "Uh oh!" in error messages — patronizing
- "AI-powered" or "Powered by AI" anywhere — if the user can tell, you don't need to say it
- Numbers written as words in running copy ("three hundred dollars") — always digits in Mono
- Emoji in headers or marketing copy

### 4.2 Things that quietly erode premium feel

These are subtle, but they compound:

- **Inconsistent corner radius.** 8px in one card, 12px in another. Lock it: all cards 16px, all buttons 12px, all pills 999px (fully rounded). Nothing else.
- **Unaligned number columns.** Any table or list where amounts aren't right-aligned in tabular Mono. Users *feel* misaligned numbers even when they can't name it.
- **Pure white or pure black.** Kills the warmth. Always Pearl/Carbon.
- **Inconsistent icon stroke weight.** Phosphor outline throughout, 1.5px. No 2px icons mixed in.
- **Web fonts without a proper loading strategy.** FOUT (flash of unstyled text) in the first second of app launch kills the brand before it starts.
- **Shadows used to indicate elevation.** Use Carbon Lifted + border instead.
- **"Back" buttons as chevrons only.** Include a word ("Back") — it's more considered.
- **System alerts for confirmations** ("Are you sure?"). Use in-app bottom sheets styled to brand.

### 4.3 Example patterns to explicitly reject

If a PM asks for any of these, show this list:

| Bad pattern | Why it's wrong for Fintrest | What to do instead |
|-------------|------------------------------|---------------------|
| "Your portfolio is up 📈 +4.2%" push notification | Gamifies checking, colors default | The weekly aperture badge (§3.3), one per week |
| Animated confetti when user hits a savings goal | Infantilizes, breaks calm | A quiet one-time aperture-open on the goal card, with the word "Done." in serif |
| "Compete with friends" feature | Weaponizes money socially | Don't build it. Ever. |
| Ticker tape at top of investments screen | Crypto exchange aesthetic | The time-range toggle and single chart line (§1.2) |
| Floating chat bubble for customer support | Breaks hierarchy, Intercom-era UI | A "Help" item in the account menu; a dedicated Support screen if needed |
| Streak counter for days of tracked spending | Streak anxiety, not discipline | Nothing — the absence is the feature |
| Dark mode as an alternate to light default | Gets the positioning backwards | Dark default; light is the alternate |

---

## 5. Implementation Handoff Checklist

Before engineering cuts the first screen:

- [ ] Design tokens imported (§2.1) — all colors, spacing, type scale
- [ ] Fonts licensed and loaded: GT Super Display, Neue Haas Grotesk Display + Text, JetBrains Mono
- [ ] Font-loading strategy prevents FOUT (use `font-display: optional` or preload)
- [ ] Aperture SVG assets imported (V1, V2, V3) — see `fintrest-aperture-marks.svg`
- [ ] Base component library built: Button (4 variants), Card (3 variants), Text (serif / sans / mono), Input, List Row, Chip
- [ ] One "ShowcaseScreen" rendering every component in every state, for QA
- [ ] Odometer component built and tested at 60fps on lowest supported device (§3.1)
- [ ] Haptic scaling service centralized (§3.4) so any transaction-event consumer can call one function
- [ ] Aperture launch animation implemented per `fintrest-aperture-spec.md` §4

---

*Spec v1.0 — product design source of truth. Update in place as decisions are made. Anything not specified here is a designer judgment call; anything specified here is locked unless revised with changelog.*
