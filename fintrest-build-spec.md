# Fintrest — Build-Ready UI Spec v1.0

*Engineering handoff. Everything below is implementable as-is. Source of truth for design decisions: `fintrest-product-design.md` and `fintrest-aperture-spec.md`.*

**Assumed stack:** React Native (iOS-first) + TypeScript. Tokens also provided as CSS custom properties for the marketing site.

---

## 1. Screen-by-Screen UI Breakdown

### 1.1 Home Dashboard

```
HomeScreen
├── SafeAreaView (bg: carbon)
├── ScrollView (contentInsets: top 0, bottom 24)
│   │
│   ├── Section: Header  ────────────────────── pt: 32, ph: 24
│   │   ├── Text.SmallCaps "OVERVIEW"          mb: 8
│   │   └── Text.Body "Good morning, Ayush"    color: mist, size: 14
│   │
│   ├── Section: Hero  ────────────────────── pt: 48, ph: 24
│   │   ├── Odometer                           size: 56, color: pearl
│   │   │   props: value=128402.18, currency="USD"
│   │   └── Text.Mono "+$412.80 today"         size: 14, color: pearl, mt: 8
│   │
│   ├── Section: Sparkline  ────────────────── pt: 32, ph: 24
│   │   └── Sparkline                          height: 120
│   │       props: data=[90 days], stroke=pearl, strokeWidth=1.5
│   │
│   ├── Section: Accounts  ────────────────── pt: 48, ph: 24
│   │   ├── Text.SmallCaps "ACCOUNTS"          mb: 16
│   │   └── HorizontalScrollView (gap: 12)
│   │       └── AccountCard × n                w: 200, h: 140
│   │
│   ├── Section: Activity  ────────────────── pt: 48, ph: 24
│   │   ├── Row (align: space-between)         mb: 16
│   │   │   ├── Text.SmallCaps "RECENT ACTIVITY"
│   │   │   └── Text.Link "See all"            onPress → ActivityScreen
│   │   └── ListRow.Transaction × 3            height: 64 each
│   │
│   └── Bottom spacer                           h: 96 (clears tab bar)
│
└── TabBar (floating, bottom)                   h: 64
```

**Typography map:**
| Element | Family | Size | Weight | Color |
|---------|--------|------|--------|-------|
| Section labels | GT Super | 10 | Regular small-caps, ls+200 | mist |
| Greeting | NHG | 14 | Regular | mist |
| Hero (balance) | JetBrains Mono | 56 | Regular, tabular | pearl |
| Hero delta | JetBrains Mono | 14 | Regular, tabular | pearl |
| Account name | NHG | 13 | Regular | mist |
| Account balance | JetBrains Mono | 22 | Regular, tabular | pearl |
| "See all" link | NHG | 13 | Medium, underline | pearl |

**Alignment:**
- All text left-aligned by default
- Amounts right-aligned in rows and columns (always tabular-nums)
- Hero number is *left-aligned to screen padding*, not centered

---

### 1.2 Portfolio

```
PortfolioScreen
├── SafeAreaView
├── ScrollView
│   │
│   ├── Section: Hero  ────────────────────── pt: 32, ph: 24
│   │   ├── Text.SmallCaps "PORTFOLIO"        mb: 8
│   │   ├── Odometer                           size: 52, color: pearl
│   │   └── DeltaStack                         mt: 8
│   │       ├── Text.Mono line 1              size: 14, color: pearl
│   │       └── Text.Mono line 2              size: 11, color: mist
│   │
│   ├── Section: Time range  ──────────────── pt: 24, ph: 24
│   │   └── SegmentedToggle.Text               h: 32, gap: 16
│   │       items: ["1D","1W","1M","1Y","ALL"]
│   │       type: text-only (no pill bg)
│   │
│   ├── Section: Chart  ────────────────────── pt: 16, ph: 0
│   │   └── Chart                              height: 240
│   │       props: line=pearl 1.5px, halo=evergreen (see 4.2)
│   │
│   ├── Section: Allocation  ──────────────── pt: 32, ph: 24
│   │   ├── Text.SmallCaps "ALLOCATION"        mb: 12
│   │   └── AllocationBar                      h: 8, mb: 16
│   │   └── Row (wrap, gap: 16)                labels below bar
│   │       └── Text.SmallCaps × categories    size: 9
│   │
│   ├── Section: Holdings  ─────────────────── pt: 48, ph: 24
│   │   ├── Text.SmallCaps "HOLDINGS"          mb: 16
│   │   └── ListRow.Holding × n                h: 64
│   │
│   ├── Text.Link "+ Add a position"           alignSelf: center, pt: 32
│   └── Bottom spacer                           h: 96
```

**Typography map:** identical pattern to Home (section labels = GT Super small-caps, numbers = Mono, body = NHG).

---

### 1.3 Insights

```
InsightsScreen
├── SafeAreaView
├── ScrollView (ph: 24)
│   │
│   ├── Section: Week header  ─────────────── pt: 32
│   │   ├── Text.SmallCaps "THIS WEEK"         size: 10, color: mist, mb: 4
│   │   └── Text.SmallCaps "Week of April 20"  size: 12, color: mist
│   │
│   ├── Section: Insight  ──────────────────── pt: 32
│   │   └── EditorialBlock                     maxWidth: 560
│   │       font: GT Super 18, lineHeight: 1.5, color: pearl
│   │       inline numbers rendered as Text.Mono 18
│   │
│   ├── Section: Signals  ──────────────────── pt: 32
│   │   └── Row (wrap, gap: 24)
│   │       └── SignalPill × 3                 font: GT Super small-caps 10, underline
│   │
│   ├── Section: Pinned  ────────────────────── pt: 48
│   │   ├── Text.SmallCaps "PINNED"            mb: 16
│   │   └── HorizontalScrollView (gap: 12)
│   │       └── InsightCard × 3–5              w: 280, h: 180, p: 24
│   │           ├── Text.Body                  serif 15, color: pearl
│   │           └── V3BladeGlyph                pos: top-right, size: 16
│   │
│   └── Bottom spacer                           h: 96
│
└── AskBar (sticky bottom, above tab bar)      h: 56, bg: carbon-lifted
    └── TextInput "Ask Fintrest something"
```

---

### 1.4 Activity

```
ActivityScreen
├── SafeAreaView
├── Header  ────────────────────────────────── pt: 32, ph: 24
│   ├── Text.SmallCaps "ACTIVITY"              mb: 16
│   ├── Input.Search                           h: 48, mb: 12
│   │   placeholder: "Search transactions"
│   └── HorizontalScrollView (gap: 16)
│       └── Chip.Filter × n                    active state: pearl + underline
│
├── FlatList  ───────────────────────────────── ph: 24, pt: 24
│   ├── sectionHeader: DateGroupHeader          h: 32, sticky
│   │   Text.SmallCaps, size: 10, color: mist
│   └── renderItem: ListRow.Transaction         h: 64, gap: 4 between rows
│
└── TabBar
```

**Transaction row:**
```
ListRow.Transaction (h: 64)
├── Left (flex: 1)
│   ├── Row (align: center, gap: 8)
│   │   ├── Icon.Category (optional)           size: 12, color: mist
│   │   └── Text.SmallCaps categoryLabel       size: 9, color: mist
│   └── Text.Body merchant                     size: 15, color: pearl, mt: 2
└── Right
    └── Text.Mono amount                       size: 15, color: pearl, align: right, tabular
```

**Open behavior:** on press, row expands in place via Aperture Iris Reveal (see §4.3). Detail view replaces list contents.

---

### 1.5 Onboarding

```
OnboardingStack (SwiftUI-style step container)
│
├── Step 01: Welcome  ─────────────────────── bg: carbon, full-screen
│   ├── Aperture.V1 (centered)                 y: 40%, size: 120, animates open on mount
│   ├── Text.Wordmark "fintrest"               NHG 28, pearl, mt: 24
│   ├── Text.Display "Grow what you have. Quietly."  GT Super 24, pearl, mt: 48
│   └── Button.Primary "Get started"           pos: bottom, mb: 48 from safe area
│
├── Step 02: Sign In  ───────────────────────
│   ├── Text.SmallCaps "STEP 1"                 pt: 32, ph: 24, mb: 8
│   ├── Text.Display "Sign in"                  GT Super 32, pearl, mb: 48
│   ├── Button.Outline "Continue with Apple"    h: 48, mb: 16
│   ├── Button.Outline "Continue with Google"   h: 48, mb: 16
│   ├── Button.Outline "Continue with email"    h: 48
│   └── Text.Legal "Privacy and terms"          NHG 11, mist, underline, bottom
│
├── Step 03: Connect  ───────────────────────
│   ├── Text.SmallCaps "STEP 2"                 pt: 32, ph: 24, mb: 8
│   ├── Text.Display "Let's read the last 90 days."
│   │                                           GT Super 32, pearl, mb: 24
│   ├── Text.Body explanation                   NHG 15, mist, mb: 48
│   ├── Button.Primary "Connect an account"     mb: 16
│   └── Text.Link "Skip for now"                pearl, underline
│
├── Step 04: The Read  ────────────────────── V2 feature — omit for MVP
│   └── Aperture.V1 rotates continuously while processing
│       text appears word-by-word via stagger
│
└── Step 05: First Insight  ────────────────── V2 feature — omit for MVP
```

**Step transitions:** aperture-close (200ms) → black frame (40ms) → aperture-open on next (240ms). Total 480ms between steps.

---

## 2. Component Library

### 2.1 Button

```ts
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'default' | 'small';  // default h:48, small h:36
  fullWidth?: boolean;
};
```

| Variant | Background | Border | Text color | Use case |
|---------|-----------|--------|-----------|----------|
| primary | `evergreen` | none | `pearl` | 1 per screen max |
| secondary | transparent | `1px pearl` | `pearl` | Stacked options |
| tertiary | transparent | none | `pearl` (underline) | Inline text links |
| destructive | transparent | `1px ember` | `ember` | Delete, sign out |

**States:**

| State | Style change |
|-------|--------------|
| default | base styles |
| pressed | scale 0.98, duration 80ms, ease-out |
| disabled | opacity 0.35, pointer-events none |
| loading | label → Spinner (V2 aperture, 16px), rest unchanged |

**Common styles (all variants):**
```
height: 48
paddingHorizontal: 24
borderRadius: 12
fontFamily: NHG-Medium
fontSize: 15
letterSpacing: -0.5%
textAlign: center
```

---

### 2.2 Card

```ts
type CardProps = {
  variant?: 'default' | 'emphasized' | 'interactive';
  children: ReactNode;
  onPress?: () => void;  // only interactive
  padding?: number;  // default 24
};
```

| Variant | Style |
|---------|-------|
| default | bg: `carbon-lifted`, border: `1px carbon-border`, radius: 16, p: 24 |
| emphasized | default + borderLeft: `2px evergreen`, paddingLeft: 22 |
| interactive | default + `:pressed` state: borderColor → `pearl @ 20%`, 160ms ease-out |

**No shadow. No hover state. Mobile-first.**

---

### 2.3 ListRow

```ts
type ListRowProps = {
  variant: 'transaction' | 'holding' | 'account';
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: string;  // Mono, right-aligned
  trailingSubtitle?: string;  // Mono, right-aligned, size 11
  onPress?: () => void;
};
```

**Shared rules (all variants):**
- height: 64
- paddingHorizontal: 0 (screen owns horizontal padding)
- flex row, justify: space-between, align: center
- divider: 1px `carbon-border` below each row (last row omits divider)

| Variant | Leading | Title style | Subtitle style | Trailing style |
|---------|---------|-------------|----------------|----------------|
| transaction | optional Icon.Category | NHG 15 pearl | SmallCaps 9 mist | Mono 15 pearl |
| holding | — | NHG 15 pearl | Mono 11 mist (ticker) | Mono 15 pearl |
| account | Institution mark 24px | NHG 13 mist | — | Mono 22 pearl |

---

### 2.4 Input

```ts
type InputProps = {
  variant: 'text' | 'search' | 'amount';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
};
```

**Shared:**
- height: 48
- paddingHorizontal: 16
- backgroundColor: `carbon-lifted`
- borderRadius: 12
- fontFamily (text/search): NHG-Regular 14
- fontFamily (amount): JetBrainsMono-Regular 16
- placeholder color: `mist`
- value color: `pearl`

| Variant | Notable |
|---------|---------|
| text | Default |
| search | Same as text. No leading icon. |
| amount | Mono font, right-aligned, prefix "$" static |

| State | Style |
|-------|-------|
| default | as above |
| focused | border: `2px evergreen`, inset (no layout shift) |
| error | border: `2px ember` |
| disabled | opacity 0.35 |

---

### 2.5 Chip

```ts
type ChipProps = {
  variant: 'filter' | 'category';
  label: string;
  active?: boolean;
  onPress?: () => void;
};
```

**Filter chip (Activity screen):**
- No background
- font: GT Super small-caps 10, letter-spacing +200
- color: `mist` default, `pearl` when active
- active adds: `borderBottom: 1px pearl`, `paddingBottom: 2`
- height: 24
- paddingHorizontal: 0
- gap between chips: 16

**Category chip (inline under merchant):**
- No background
- font: GT Super small-caps 9
- color: `mist`
- non-interactive (label only)

---

### 2.6 TabBar

```ts
type TabBarProps = {
  activeTab: 'home' | 'activity';  // MVP: only 2 tabs
  onChange: (tab) => void;
};
```

**Structure:**
- height: 64 + bottom safe area
- backgroundColor: `carbon` with 1px top border `carbon-border`
- flex row, justify: space-around, align: center
- per tab:
  - V2 Aperture (20px) when Home active; Phosphor `List` (20px) for Activity
  - Inactive: `mist`
  - Active: `pearl`
  - Label below icon: NHG 10, mist/pearl, mt: 4

**V1 MVP has exactly 2 tabs: Home, Activity.** Portfolio and Insights tabs land in V2.

---

## 3. Developer Tokens

### 3.1 `tokens.ts` (React Native + web-compatible)

```ts
export const colors = {
  // Surfaces
  carbon:         '#0F0F10',
  carbonLifted:   '#14181A',
  carbonBorder:   '#1C1F22',
  obsidian:       '#0A0B0C',

  // Text & marks
  pearl:          '#FAFAF7',
  mist:           '#A6ADB4',
  fog:            '#6B7178',

  // Accent
  evergreen:      '#1F5C46',
  evergreenGlow:  'rgba(31, 92, 70, 0.35)',

  // Alert
  ember:          '#B24A2A',

  // Light mode (V3+)
  bone:           '#EDE6D6',
  boneLifted:     '#F5F1EA',
  boneBorder:     '#E3DBC8',
} as const;

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
  s9: 96,
  s10: 128,
} as const;

export const radii = {
  sm: 8,
  md: 12,    // buttons, inputs
  lg: 16,    // cards
  pill: 999,
  icon: 229, // iOS app-icon corner radius on 1024
} as const;

export const typography = {
  fontFamily: {
    serif:  'GTSuperDisplay-Regular',
    sans:   'NeueHaasGroteskDisplay-Regular',
    sansMd: 'NeueHaasGroteskDisplay-Medium',
    mono:   'JetBrainsMono-Regular',
  },
  size: {
    // Display
    hero:       56,
    heroSm:     52,
    display:    32,
    displaySm:  24,
    // Body
    h1:         18,
    body:       15,
    bodySm:     14,
    bodyXs:     13,
    caption:    12,
    label:      11,
    micro:      10,
    nano:       9,
  },
  lineHeight: {
    tight:      1.1,
    numbers:    1.2,
    body:       1.5,
    editorial:  1.45,
  },
  letterSpacing: {
    tight:      -0.5,    // percent, applied via platform-specific API
    smallCaps:  200,     // thousandths of an em
  },
} as const;

export const motion = {
  durations: {
    micro:    80,
    tap:      160,
    short:    240,
    medium:   280,
    long:     480,
    slow:     800,
  },
  easings: {
    standard:   [0.4, 0, 0.2, 1],
    quintOut:   [0.22, 1, 0.36, 1],
    cubicInOut: [0.65, 0, 0.35, 1],
  },
} as const;

export const elevation = {
  none: {
    // No shadows in Fintrest. Elevation = carbonLifted + 1px border.
    // This object exists to lock it explicitly for reviewers.
  },
} as const;
```

### 3.2 CSS custom properties (marketing site)

```css
:root {
  /* surfaces */
  --carbon: #0F0F10;
  --carbon-lifted: #14181A;
  --carbon-border: #1C1F22;
  --obsidian: #0A0B0C;

  /* text */
  --pearl: #FAFAF7;
  --mist: #A6ADB4;
  --fog: #6B7178;

  /* accent */
  --evergreen: #1F5C46;
  --evergreen-glow: rgba(31, 92, 70, 0.35);
  --ember: #B24A2A;

  /* spacing */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;
  --s-9: 96px; --s-10: 128px;

  /* radii */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;

  /* motion */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-quint-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-cubic-inout: cubic-bezier(0.65, 0, 0.35, 1);

  --d-micro: 80ms; --d-tap: 160ms; --d-short: 240ms;
  --d-medium: 280ms; --d-long: 480ms; --d-slow: 800ms;
}
```

---

## 4. Interaction Logic

### 4.1 Balance Odometer

- **Trigger:** `value` prop changes on `<Odometer>` component.
- **Algorithm:**
  1. Format old and new values with same digit count (pad with spaces).
  2. Diff digit-by-digit, right to left.
  3. For each changed digit at index `i` (right-indexed), start animation at `t = i × 40ms`.
  4. Each digit animates through intermediate values (0→9 wheel), resolving at final value after **280ms**, ease-out-quint.
- **Implementation:** single vertically-scrolling column per digit. Column height = `lineHeight × 10`. Animate `translateY` to target offset.
- **Edge cases:**
  - Digit count grows (e.g. $999 → $1,042): new leading digit fades in over first 120ms of its scroll; existing digits animate normally.
  - Digit count shrinks: trailing digits fade out over last 120ms.
  - Decimal separator and `$` are static; do not animate.
  - If delta > 50% of current value (likely data error): skip animation, cut to new value.
  - Rapid successive updates (< 300ms apart): cancel in-flight animation, start new one from current position.

### 4.2 Chart Interaction

- **States:** `idle` (no interaction), `hover` (crosshair visible, passive), `scrubbing` (user dragging).
- **Triggers:**
  - Single tap → enter `hover` at tap point, hold for 2000ms, auto-exit to `idle`.
  - Long-press (300ms) → enter `scrubbing`; track finger horizontally; on release → `idle`.
- **Crosshair rendering:**
  - 1px vertical line `pearl @ 30%`
  - Dot at line-chart intersection: 6px circle, `pearl`
  - Floating label above point: Mono 12, `pearl`, shows value. Positioned to avoid screen edges.
- **Haptic:** `.soft` on entering `scrubbing`, nothing during scrub (would be jittery).
- **Evergreen halo:**
  - Rendered as a `LinearGradient` mask below the chart line, anchored bottom.
  - Opacity = `Math.min(0.40, magnitude × 0.01)` where `magnitude` is % gain over range.
  - Opacity tweens over 600ms when data refreshes.
  - Losses: no halo at all. Do not show a red/ember version.
- **Edge cases:**
  - No data: show `Text.Body "Not enough history yet." mist`, omit chart entirely.
  - Single data point: render dot only, no line.
  - All-flat data: render flat line at midheight, halo opacity 0.

### 4.3 Aperture Transitions

Three separate uses of the aperture in motion:

**(a) App launch** — see `fintrest-aperture-spec.md §4`, 480ms total sequence.

**(b) Onboarding step transition:**
- On `next()`: aperture-close on current screen (200ms, ease-in-quint) → 40ms black hold → aperture-open on next (240ms, ease-out-quint).
- Interruption: if user taps during close, skip remainder, jump to open of next.
- Edge case: pop gesture (back-swipe) during transition → cancel, restore current.

**(c) Transaction iris reveal (V2 — omit for MVP):**
- Trigger: press on `ListRow.Transaction`.
- Expand circular mask from tap point `(x, y)` at **480 px/sec** radially.
- Detail view is the content revealed by the mask.
- At 180ms, render V1 aperture at 20% opacity centered at `(x, y)`, scale 0.4, fade to 0 over next 180ms.
- Easing: `ease-in-out-cubic`.
- Close: reverse, iris collapses to `(x, y)`. 240ms.
- Edge case: if user taps another row during expansion, cancel first, start second.

### 4.4 Focus Mode (long-press on any Mono number) — V2

- **Trigger:** long-press any `<Text.Mono>` with `focusable` prop = true for 800ms.
- **On trigger:**
  - Haptic `.soft`.
  - Rest of screen (everything except target) animates opacity → 0.4 over 200ms.
  - Target scales to 1.1× with 1px `evergreen` underline appearing.
  - `FocusPanel` (bottom sheet, `carbonLifted` bg, radius 16) slides up from bottom, 320ms, ease-out-quint.
- **While held:** panel remains open. Content inside panel updates if user drags to a different focusable number.
- **On release:**
  - Haptic `.soft`.
  - Panel slides down (240ms).
  - Screen opacity returns to 1.0 (200ms).
  - Target scales back to 1.0.
- **Edge cases:**
  - Finger lifts off target but stays on screen mid-hold: still trigger if 800ms elapsed.
  - Release before 800ms: cancel, no haptic, no panel.
  - Panel content still loading: show V2 aperture loader (rotating, 2.4s/rev) in panel.
  - User scrolls during hold: cancel.

---

## 5. MVP Scope (ruthless cut)

### V1 — Launch (target: 8 weeks)

**Ship:**

| Area | Included |
|------|----------|
| Screens | Onboarding (Steps 1–3), Home, Activity, Activity Detail |
| Navigation | 2-tab TabBar: Home, Activity |
| Design system | All tokens, all 6 components (Button, Card, ListRow, Input, Chip, TabBar) |
| Motion | App launch aperture (§4 of aperture spec), Odometer (§4.1), Onboarding step transitions (§4.3b) |
| Data | Plaid connection for banks (no brokerage yet) |
| Mode | Dark mode only |
| Platform | iOS only (React Native build) |

**Home screen V1 cut:**
- Header ✅
- Hero balance + delta ✅
- Sparkline ❌ (defer — requires 90 days of stored history)
- Accounts strip ✅
- Today's Insight card ❌ (defer — requires AI pipeline)
- Recent Activity (3 rows) ✅

**Activity screen V1 cut:**
- Search ✅
- Filter chips ✅ (categories + date only; account filter in V2)
- Date-grouped list ✅
- Transaction tap → detail (modal, NOT aperture iris) ✅
- Aperture iris reveal ❌ (defer)

**Onboarding V1 cut:**
- Step 1 Welcome ✅
- Step 2 Sign In (Apple + email only; Google in V2) ✅
- Step 3 Connect Plaid ✅
- Step 4 The Read ❌ (defer — requires AI)
- Step 5 First Insight + Goal ❌ (defer)
- Replace post-Plaid with: brief "Setting up…" state with V2 aperture rotating, then land on Home.

**Components V1:**
- Button (primary, secondary only — tertiary/destructive in V2)
- Card (default + emphasized only — interactive in V2)
- ListRow (transaction + account — holding in V2)
- Input (text + search — amount in V2)
- Chip (filter only — category in V2)
- TabBar (2 items)
- Odometer
- Aperture.V1 (launch only)
- Aperture.V2 (loading spinner)

---

### V2 — Round two (target: +8 weeks)

- Portfolio screen + brokerage integration
- Insights screen + AI pipeline
- Onboarding Step 4 "The Read"
- Onboarding Step 5 Goal setup
- Sparkline on Home
- Today's Insight card on Home
- Inverted chart halo (§4.2)
- Transaction iris reveal (§4.3c)
- Focus mode (§4.4)
- Haptic weight system
- Weekly Opening notification
- Tertiary + destructive Button variants
- Interactive Card variant
- Amount Input variant
- Category Chip variant
- Google sign-in
- TabBar → 4 items (Home, Portfolio, Insights, Activity)
- V3 blade glyph in InsightCard

---

### V3+ — Polish & expansion

- Light mode
- Apple Watch complication (V3 blade)
- iOS 18 tinted icon variant
- Android build
- V3 blade uses in account tiers
- Optional shutter sound on app launch

---

### What we are NOT building (ever, or until proven otherwise)

- Social features (sharing, leaderboards, friends)
- Streaks, badges, achievements
- In-app chat / support bubble
- Candlestick charts
- Crypto trading
- Credit score features (if added, must pass the Fintrest filter — no gamification)
- Referral rewards with confetti

---

## 6. Engineering Checklist (day-1 setup)

- [ ] RN project initialized with TypeScript strict mode
- [ ] `tokens.ts` committed; design-token linter rule added (ESLint rule: reject hardcoded hex, reject hardcoded px values outside spacing scale)
- [ ] Fonts licensed + bundled: GT Super Display, Neue Haas Grotesk Display (Regular + Medium), JetBrains Mono
- [ ] Font preload via `expo-font` or `react-native-asset` to prevent FOUT on cold launch
- [ ] Aperture SVGs imported as RN components via `react-native-svg` (V1, V2, V3 from `fintrest-aperture-marks.svg`)
- [ ] Haptics wrapper module created (even if unused in V1 — land the API)
- [ ] Centralized `motion.ts` with easing arrays and duration constants
- [ ] Dark status bar enforced at app root; no per-screen overrides allowed
- [ ] Storybook or equivalent "ShowcaseScreen" rendering all components in all states
- [ ] Odometer tested at 60fps on iPhone 12 (the floor device)
- [ ] App icon assets exported at 9 sizes per `fintrest-aperture-spec.md §3.7`

---

*v1.0 — locked for V1 build kickoff. File bugs against this doc, do not fork.*
