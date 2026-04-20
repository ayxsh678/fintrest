# Fintrest — Marketing Landing Page Spec v1.0

*The public-facing surface of the brand. Single-page, long-scroll, pre-launch waitlist. Deployable as a static site to Vercel/Netlify in under an hour. Paired with a working HTML prototype: `fintrest-landing.html`.*

---

## 1. Strategy (30-second summary)

**Goal:** Collect qualified waitlist signups from Gen Z and young professionals. Secondary: convince investors the brand and team are serious.

**Constraints:**
- No product to demo yet (pre-launch)
- No App Store link yet
- One primary CTA: **Join the waitlist**
- Must load in under 1 second, score ≥95 on Lighthouse, be inarguably designed

**What this page is not:**
- Not a sign-up flow. Not a product tour. Not a feature list.
- No customer testimonials (we don't have customers).
- No press logos ("As seen in…"). No social proof carousel.
- No newsletter signup distinct from the waitlist.

---

## 2. Information Architecture (section order)

Single long-scroll page, 6 sections, no nav links jumping to anchors, no hamburger menu, no secondary pages except legal.

```
01. Nav          (sticky, minimal)
02. Hero         (aperture + thesis + waitlist CTA)
03. The Thesis   (editorial prose, what Fintrest is)
04. How it works (3 stacked steps)
05. What you won't see  (anti-features — the voice statement)
06. Waitlist     (second CTA, centered, large)
07. Footer       (legal, contact)
```

Legal pages are separate: `/privacy`, `/terms`. No other URLs in V1.

---

## 3. Section-by-Section Spec

### 3.1 Nav (sticky top)

- Height: 64px mobile, 80px desktop
- Background: `carbon @ 0.85` with `backdrop-filter: blur(20px)` — becomes more opaque on scroll
- Inside: flex row, space-between
  - **Left:** `fintrest` wordmark in NHG Medium 18, Pearl, kerning -2%
  - **Right:** Button `Join the waitlist` — Evergreen primary, 40px tall, 16px horizontal padding, 11 radius
- Mobile: same, button shrinks to 36px and just reads `Waitlist`

### 3.2 Hero

- Height: 100vh minimum, 720px minimum (whichever is larger)
- Centered vertically, left-aligned horizontally on desktop (`padding-left: 96px`), centered on mobile

**Structure:**

```
Hero
├── Aperture V1 mark (top, 80px high)
│   └── plays launch animation on mount (matches aperture-spec §4)
├── Thesis              Fraunces 72 (desktop) / 48 (mobile)
│                       "Grow what you have. Quietly."
├── Subhead             Inter 20 / 17, color Mist, max-width 480px
│                       "A calm finance app that reads your accounts
│                       and tells you what matters."
└── Form inline
    ├── Email input     (see 3.5 — same component as the bottom form)
    └── Button "Join the waitlist" (primary)
    └── Micro label     Inter 12 Mist: "Early access this summer. No spam, one email at launch."
```

**Background:** the same radial gradient from the app icon (§3.2 aperture-spec) — `#14181A` at center top, `#0A0B0C` at edges.

**Motion:** aperture opens on page load. 80ms hold, 240ms open (quintOut). No parallax on scroll for V1 — keep it static and fast.

### 3.3 The Thesis (editorial block)

- Padding: 160px top/bottom desktop, 96px mobile
- Max width: 720px, centered
- Section label above: `About` in GT Super small-caps 11 Mist, letter-spacing +200
- Body: **3 paragraphs** in Fraunces 22 (desktop) / 18 (mobile), Pearl, line-height 1.5

**Copy (ship):**

> Fintrest is a quieter kind of finance app. It doesn't ping you when your portfolio moves. It doesn't show green numbers to make you feel good about gains, or red ones to panic you about losses. It doesn't gamify your savings.
>
> It reads the last 90 days of your accounts, finds the patterns you'd miss, and tells you what matters in a single paragraph every Monday.
>
> That's the entire product. It's enough.

**Pull quote (optional, below prose):**
- Giant Fraunces 96 number: `$0`
- Caption below in Mono 13 Mist: `monthly fee, forever`
- Only add if product has committed to free-forever (business-model decision outside this spec)

### 3.4 How it works (three stacked steps)

Three blocks, vertically stacked, each with a number, a headline, a paragraph. No icons, no illustrations. Keep the editorial style from the thesis.

- Padding between blocks: 96px desktop, 64px mobile
- Each block: max-width 560px, centered

**Block 01**
- Number: `01` in Fraunces 96, Evergreen, margin-bottom 16
- Headline: `Connect your accounts.` — Fraunces 32 Pearl
- Body: `Fintrest connects to your bank, brokerage, and cards through Plaid. Your credentials stay between you and your bank — we never see them.` — Inter 17 Mist

**Block 02**
- Number: `02` Evergreen
- Headline: `We read them.`
- Body: `The last 90 days. Every transaction, every position, every movement. Fintrest looks for patterns humans miss — the small ones that compound.`

**Block 03**
- Number: `03` Evergreen
- Headline: `You get one insight a week.`
- Body: `Monday morning, a single paragraph. What changed, what it means, what (if anything) to do. Nothing more.`

### 3.5 What you won't see (the anti-feature statement)

This is the section that separates Fintrest from every other fintech landing page. It's where the brand earns trust by saying what it refuses to do.

- Padding: 160px top/bottom
- Max-width: 560px
- Center-aligned

**Structure:**

```
SmallCaps label:  "What you won't see"
Heading:          "Fintrest is made of what it doesn't do."   (Fraunces 32)

Two-column list on desktop, single column mobile:
  ── No push notifications about your balance.
  ── No streaks or savings challenges.
  ── No green for gains, no red for losses.
  ── No social features or leaderboards.
  ── No referral bonuses or confetti.
  ── No "AI-powered" anywhere.
```

Each list item: Inter 16 Pearl, with a 16px em-dash prefix `──` (horizontal bar in Mist), 12px padding between items.

### 3.6 Waitlist (second CTA)

- Padding: 160px top/bottom
- Centered, full-width container, max inner-width 480px
- Background: solid `carbon-lifted` (visually elevates this block)
- Border: 1px `carbon-border` top and bottom only (not a card — full-width band)

**Structure:**

```
Heading:      "Early access this summer." (Fraunces 32)
Subhead:      "One email when Fintrest opens. No spam." (Inter 15 Mist)
Spacer:       32px
Form inline:
  ├── Email input (h: 48, bg: carbon, border: 1px carbon-border)
  └── Button "Join the waitlist"
Success state (replaces form after submit):
  "You're on the list." (Fraunces 24 Pearl, centered)
```

The form is the same component as the hero form. See §5.4.

### 3.7 Footer

- Padding: 48px top/bottom
- Border-top: 1px `carbon-border`
- Max-width: 1200px, padded 24px horizontal

**Layout (desktop):** flex row, space-between.
**Layout (mobile):** stacked, 24px gap.

```
Left:
  fintrest wordmark (NHG Medium 16, Pearl)
  © 2026 Fintrest  (Inter 12 Mist, mt: 8)

Right (horizontal, gap: 32px, Inter 13 Mist, underline on hover):
  Privacy · Terms · hello@fintrest.{tld}
```

No social icons. No "made with ❤" line. No language selector.

---

## 4. Design Tokens (web)

Use the exact same CSS custom properties as `fintrest-build-spec.md §3.2`. Drop that block into the `:root` of the landing page stylesheet unchanged.

**Fonts used on landing page** (in priority of what the engineer actually sources):

| Token | Licensed (ideal) | Free fallback (prototype) |
|-------|------------------|--------------------------|
| Serif | GT Super Display | **Fraunces** (Google Fonts, weight 400 + 500) |
| Sans | Neue Haas Grotesk Display | **Inter** (Google Fonts, weight 400 + 500 + 600) |
| Mono | JetBrains Mono | JetBrains Mono (free) |

For V1 prototype: ship with the Google Fonts. Swap to licensed GT Super + NHG once the product launches and has budget. The prototype on day one is indistinguishable at glance distance.

Load pattern:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap">
```

`display=swap` is correct here (not `optional` as in the app) — on a marketing page, the swap flash is less costly than a delayed first paint.

---

## 5. Components

### 5.1 Button (identical to app spec)

Uses the same 4 variants from `fintrest-build-spec.md §2.1`. On the landing page, we only use `primary` and `secondary`.

- Primary: Evergreen bg, Pearl text, 40px tall (smaller than app's 48 — nav-appropriate), 11 radius
- Secondary: transparent, 1px Pearl border, Pearl text

### 5.2 Aperture mark

- Use the V1 solid variant from `fintrest-aperture-marks.svg`
- On the landing page: 80px high in hero, 16px high in nav wordmark (as dot replacement — optional, skip for simplicity in V1)
- Launch animation on mount: same timing as the app (§4 aperture-spec)

### 5.3 Editorial text block

A reusable block with max-width 720px, centered, used in §3.3 and §3.5. No border, no background.

### 5.4 Waitlist form

```html
<form class="waitlist" data-action="/api/waitlist">
  <input
    type="email"
    name="email"
    placeholder="you@email.com"
    required
    aria-label="Email address"
  />
  <button type="submit">Join the waitlist</button>
</form>
```

**States:**

| State | Behavior |
|-------|----------|
| default | input + button side-by-side (desktop), stacked (mobile) |
| focus | input border becomes `2px evergreen` |
| submitting | button label replaces with V2 outline aperture rotating; form disabled |
| success | entire form replaces with `"You're on the list."` in Fraunces 24 Pearl, centered, 600ms fade-in |
| error | inline below input: `"That didn't go through. Try again."` in Inter 13 Ember |

**Backend options (pick one):**

| Option | Setup time | Cost | Notes |
|--------|-----------|------|-------|
| **Formspree** | 5 min | Free up to 50/month | Easiest. Just set `data-action` to the Formspree URL. |
| **Tally** | 10 min | Free | Slightly prettier dashboard. |
| **Resend + simple API route** | 30 min on Vercel | Free up to 100/day | Most control; sends you an email per signup. |
| **Airtable Web API** | 20 min | Free | Signups land in a spreadsheet you can filter/invite from. |

Recommend **Formspree** for V1. Upgrade to your own endpoint once signups exceed 50/month.

---

## 6. Motion & Interactions

Keep this lean. Every motion on the page must earn its existence.

| Interaction | Behavior |
|-------------|----------|
| Page load | Aperture V1 opens (240ms quintOut) after 80ms hold. Hero text fades in with 40ms stagger per element after aperture resolves. |
| Scroll | No parallax, no fade-in on scroll, no reveal animations. The page is one piece. |
| Waitlist form submit | Button label → spinner (V2 aperture rotating, 2.4s/rev). On success: form cross-dissolves (400ms) to success message. |
| Nav on scroll | Nav background opacity increases from 0.85 → 0.95 after 100px scroll. 200ms ease-out. |
| Button hover (desktop only) | Opacity 0.85 for 120ms. No scale, no shadow. |
| Focus (keyboard) | 2px Evergreen outline, 2px offset. Always visible for accessibility. |

---

## 7. SEO & Metadata

```html
<title>Fintrest — Grow what you have. Quietly.</title>
<meta name="description" content="A calm finance app that reads your accounts and tells you what matters. Join the waitlist for early access.">

<meta property="og:title" content="Fintrest">
<meta property="og:description" content="Grow what you have. Quietly.">
<meta property="og:image" content="/og-image.png">    <!-- 1200x630, dark, aperture centered with wordmark below -->
<meta property="og:url" content="https://fintrest.{tld}">
<meta property="og:type" content="website">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="/og-image.png">

<link rel="icon" href="/favicon.svg">                 <!-- V2 outlined aperture -->
<link rel="apple-touch-icon" href="/apple-touch.png"> <!-- app icon, 180x180 -->

<meta name="theme-color" content="#0F0F10">
```

The OG image is one of the most leveraged assets — when someone shares the link, it's what they see. Design it as a 1200×630 composition: Carbon background, aperture centered, `fintrest` wordmark below, `Grow what you have. Quietly.` in Fraunces 48 small below that. No other elements.

---

## 8. Analytics (set up day 1)

Use **Plausible** (privacy-friendly, no cookie banner needed) or **Vercel Analytics** (free for Hobby plan). No Google Analytics — the cookie banner it forces will be the first thing that breaks the brand's restraint.

Events to track:

| Event | Trigger |
|-------|---------|
| `page_view` | Auto |
| `hero_cta_click` | Click on hero "Join the waitlist" button |
| `footer_cta_click` | Click on bottom "Join the waitlist" button |
| `waitlist_submit_attempt` | Form submission fired |
| `waitlist_submit_success` | Form returned success |
| `waitlist_submit_error` | Form returned error |
| `scroll_25` / `scroll_50` / `scroll_75` / `scroll_100` | Scroll depth milestones |

Primary metric: `waitlist_submit_success / page_view` = conversion rate. Target for V1: ≥3% for organic, ≥8% for invited traffic.

---

## 9. Performance Targets

These aren't aspirational — they're enforced by the architecture. Static HTML + CSS + minimal JS means all these should pass trivially.

| Metric | Target |
|--------|--------|
| Lighthouse Performance | ≥ 95 |
| Lighthouse Accessibility | = 100 |
| Lighthouse Best Practices | = 100 |
| Lighthouse SEO | = 100 |
| First Contentful Paint | < 1.0s |
| Largest Contentful Paint | < 1.5s |
| Total page weight (excluding fonts) | < 50 KB |
| JS execution on main thread | < 50ms |

Fonts load async; page renders with system fallbacks immediately.

---

## 10. Tech Stack

For the shortest path to something real:

- **Hosting:** Vercel or Netlify (both free for this scale, instant deploy from GitHub)
- **Framework:** None. Plain HTML + CSS + minimal JS. Do NOT use Next.js/Gatsby/Astro for a 6-section landing page — overkill.
- **Forms:** Formspree (§5.4)
- **Analytics:** Plausible or Vercel Analytics
- **Fonts:** Google Fonts (CDN)
- **Source control:** GitHub repo `fintrest-landing` — private for now

**Deploy in 10 minutes:**
1. Push `fintrest-landing.html` (renamed `index.html`) to a new GitHub repo
2. Connect repo to Vercel (`vercel.com/new`)
3. Import → Deploy (no build config needed)
4. You get a `*.vercel.app` URL instantly
5. Point a custom domain when ready (see §11)

---

## 11. Domain Strategy

You don't have one yet. Here's how to handle it.

**Step 1: Check availability.**
- `fintrest.com` — almost certainly taken or parked. Check at `whois.com`. If available, buy it immediately.
- If `.com` is taken at reasonable price (<$5k), buy it. In fintech, `.com` is worth the premium.
- If taken and expensive, the fallback order is:
  - `fintrest.app` (strong for mobile-first product)
  - `fintrest.co`
  - `fintrest.money` (on-nose but available)

**Step 2: Trademark check.**
- Search `uspto.gov/trademarks` for "Fintrest" in Class 36 (financial services) and Class 42 (software).
- This is free and takes 5 minutes. Critical before committing to the name.

**Step 3: Registrar.**
- **Cloudflare Registrar** — cheapest (at-cost pricing, ~$10/year for `.com`), no upselling, free WHOIS privacy. Requires domain to use Cloudflare DNS (which is also free and fast).
- Do not use GoDaddy (opaque pricing, constant upselling).

**Step 4: Defensive registrations.**
- Buy `fintrest.com`, `fintrest.app`, `fintrest.co` at minimum — prevents typosquatters and protects the brand. ~$30/year total.
- Redirect all non-primary domains to the primary one via Cloudflare Page Rules.

**Step 5: Deploy under a placeholder.**
- While you decide: deploy to `fintrest-waitlist.vercel.app` or `fintrest.webflow.io` and share that link with early investors. Vercel preview URLs are fine for private sharing — just don't publicize until the real domain is set.

**Step 6: Email.**
- Set up `hello@fintrest.{tld}` via Cloudflare Email Routing (free) forwarded to your personal inbox. Use it in the footer. Professional presence without needing Google Workspace yet.

---

## 12. MVP Cut (what to ship first)

To ship this week:

**Must have:**
- Hero with working waitlist form (Formspree)
- Thesis block (§3.3)
- How it works (§3.4, three blocks)
- Footer
- OG image

**Skip for v1:**
- Anti-feature section (§3.5) — powerful, but can ship in v2
- Pull quote in thesis (§3.3) — business-model dependent
- Bottom waitlist band (§3.6) — one form is enough; add the second after v1 data

**Absolutely no V2 features:**
- A "team" or "about" page
- A blog
- A FAQ
- Customer logos or testimonials (you have none)

---

## 13. Copy checklist (what's already written)

All landing page copy is already locked in `fintrest-ux-copy.md`:

| Surface | Location in ux-copy |
|---------|---------------------|
| Hero thesis | §13 Marketing Surface Copy |
| Button labels | §3, §7 |
| Waitlist success/error | §6 error library |
| Footer legal link text | §8 |

Do not rewrite anything. Copy is locked.

---

## 14. Investor Readiness

This page doubles as your investor-facing surface. What an investor looking at a Series A-ready fintech brand expects to see:

- [✓] Clear positioning in one sentence
- [✓] Dark, editorial design (signals "premium")
- [✓] Waitlist mechanic (signals "pre-launch demand")
- [✓] Footer with real email (signals "real operation")
- [✗] Team page — *not recommended for v1.* Adding a team page too early creates pressure to hire to fill it. Wait until you have co-founders or first hire.
- [✗] Press mentions — *don't fake it.* No "As seen in TechCrunch" without an actual article.

---

*v1.0 — locked for landing page build. Paired with working prototype: `fintrest-landing.html`.*
