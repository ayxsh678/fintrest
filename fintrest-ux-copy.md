# Fintrest — UX Copy Library v1.0

*The voice of the product, captured. Every string in MVP V1 is specified below. When adding copy later, start with §1 (voice rules) and §2 (glossary). If you can't find a string here, write it by matching the nearest analogous string, not by writing freshly.*

---

## 1. Voice Rules

Ten rules. Anyone writing copy for Fintrest must be able to recite these.

1. **Write like an editor, not a coach.** State facts. Don't tell the user how to feel about them.
2. **Brevity is not minimalism.** Cut until removing one more word breaks the meaning, then stop. Don't truncate into curtness.
3. **No exclamation points.** Reserved for actual errors, and even there, we use periods. There is no exception.
4. **No "Oops!", no "Uh oh!", no "Hmm!"** — patronizing. State what happened.
5. **No "we" unless necessary.** Most sentences don't need an actor. "Bank didn't respond" beats "We couldn't connect to your bank."
6. **No motivational language ever.** Not "You're crushing it!", not "Great job!", not "Keep going!" This is the user's money. They do not need cheerleading.
7. **No "AI" in the product.** The user can tell. Saying it advertises it, which cheapens it.
8. **Numbers are always digits, always Mono.** "3 accounts," not "three accounts." Never spell out amounts in running copy.
9. **Specific > vague.** "812 transactions" beats "your transactions." "Last 30 days" beats "recent activity."
10. **When in doubt, say less.** The Fintrest answer to "should we explain this more?" is almost always no.

### Forbidden words & phrases

| Banned | Why | Use instead |
|--------|-----|-------------|
| Oops / Uh oh / Hmm | Patronizing | State what happened |
| Awesome / Great / Amazing | Cheerleading | (nothing — remove) |
| Let's get you set up | Tour-guide tone | "Connect an account" |
| Don't worry | Assumes anxiety | (nothing — remove) |
| We've got you covered | Corporate warmth | State the action |
| Powered by AI / AI-powered | Advertising the thing | (nothing — remove) |
| Sorry | Performative | State what broke |
| Crushing it / Smashing it / On fire | Fitness-app tone | (nothing — remove) |
| Magic / Magical | Reduces trust in finance | "Automatic" or "instant" |
| Seamless | Meaningless | (nothing — remove) |
| Level up / Unlock | Gamification | State the feature |

---

## 2. Glossary (terminology lock)

Same term, same thing, everywhere. Pick one and stick to it.

| Concept | Use | Do not use |
|---------|-----|------------|
| A connected bank or brokerage | **account** | linked account, integration, source |
| The user's Fintrest profile | **profile** (or the user's name) | account |
| Money in a bank account | **balance** | money, funds, cash |
| Value of investments | **value** | balance, worth |
| Combined total across everything | **net worth** | total, portfolio value |
| A single charge, deposit, or transfer | **transaction** | payment, charge, entry |
| An AI-generated observation | **insight** | tip, recommendation, suggestion |
| Linking a bank account | **connect** | link, add, sync |
| Authenticating | **sign in** | log in, log on, authenticate |
| The weekly readout | **the week in review** | weekly report, summary |
| Money going out | **spending** | expenses, outflows |
| Money coming in | **income** | deposits, inflows |
| Stocks, ETFs, etc. | **positions** (plural) / **holding** (one line item) | assets, investments (ambiguous) |
| The app itself | **Fintrest** | the app, our platform |

### Capitalization rules
- Proper nouns: **Fintrest**, **Apple**, **Google**, **Plaid**
- Tab / section names in UI: **sentence case** ("Portfolio" not "PORTFOLIO")
  - Exception: small-caps treatment in GT Super (§1.2 of product spec) — the text string is still written in sentence case; the font renders it as small-caps
- Button labels: **sentence case** ("Connect an account" not "Connect An Account")
- Headlines in onboarding: **sentence case** with a period if a sentence ("Let's read the last 90 days.")
- Error messages: **sentence case** with a period

### Date & time format
- Short: `Apr 20` (no period after month)
- Medium: `April 20, 2026`
- In running copy: `April 20` (no year unless needed for clarity)
- Time: `7:00 am` (lowercase am/pm, no period, thin space before if possible)
- Relative: `today`, `yesterday`, `2 days ago`, `last Monday` — use up to 7 days, then fall back to `Apr 20`

### Currency format
- Default: `$128,402.18` (always 2 decimals, comma separators)
- In sentences: `$128` (drop cents when round, drop decimals when whole) — exception: in any Mono context, always show 2 decimals for alignment
- Negatives in sentences: `-$412` (minus sign, not parentheses)
- Negatives in Mono columns: `-$412.00` (minus sign at left of digits)

---

## 3. Onboarding Copy (V1)

### Step 01 — Welcome

| Element | Copy |
|---------|------|
| Wordmark (image) | `fintrest` |
| Thesis (GT Super 24) | `Grow what you have. Quietly.` |
| Primary CTA | `Get started` |

**Notes:** No subtitle, no explainer paragraph, no "the smart way to..." line. The thesis does the entire job. Do not add to this screen.

---

### Step 02 — Sign In

| Element | Copy |
|---------|------|
| Section label (SmallCaps) | `Step 1` |
| Headline (GT Super 32) | `Sign in` |
| Apple button | `Continue with Apple` |
| Email button | `Continue with email` |
| Google button (V2) | `Continue with Google` |
| Legal footer | `By continuing, you agree to our Terms and Privacy Policy.` |
| Legal link labels | `Terms` · `Privacy Policy` |

**Notes:** No "Welcome back" branching. The same copy works for new and returning users — Apple/Google handles the distinction. Keep it flat.

---

### Step 03 — Connect Account

| Element | Copy |
|---------|------|
| Section label | `Step 2` |
| Headline | `Let's read the last 90 days.` |
| Body | `Fintrest needs to see your accounts to find patterns. Your bank login stays between you and your bank — we never see it. Connections are handled by Plaid.` |
| Primary CTA | `Connect an account` |
| Secondary link | `Skip for now` |

**Alternatives for headline:**

| Option | Copy | Best for |
|--------|------|----------|
| A (ship) | `Let's read the last 90 days.` | Premium, specific, earns the AI moment |
| B | `Connect your first account.` | Most direct — use if headline A tests weak with Gen Z |
| C | `Start with one account.` | Lowest-commitment framing — use if connection rates are low |

**Rationale:** A is the strongest because it previews the magic moment (the AI read) without saying "AI." B is the safe fallback. Do not use vague "Link your bank" — "bank" understates the positioning (we also read brokerages eventually).

---

### Post-Plaid loading state

| Element | Copy |
|---------|------|
| Headline (SmallCaps) | `Reading your accounts` |
| Body (NHG) | `Usually takes 10 to 20 seconds.` |

**Do not write:** "This won't take long!" or "Just a moment..." or any variant with ellipsis+exclamation combined. Ellipses are allowed when followed by no punctuation, but keep rare.

### Post-Plaid success (brief, auto-dismisses)

| Element | Copy |
|---------|------|
| Confirmation (center screen, 1.2s) | `Connected.` |

One word. Period. No checkmark animation, no "All set!" banner.

### Post-Plaid failure

| Element | Copy |
|---------|------|
| Headline | `That didn't connect.` |
| Body | `Your bank declined the connection or timed out. This is almost always temporary.` |
| Primary CTA | `Try again` |
| Secondary link | `Connect a different account` |

---

## 4. Home Screen Copy

### Section labels

| Position | Copy |
|----------|------|
| Header section (above greeting) | `Overview` |
| Accounts section | `Accounts` |
| Activity section | `Recent activity` |

All rendered as GT Super small-caps (§1.2 product spec). Strings are written in sentence case; the font handles the caps.

### Greetings (time-of-day variants)

| Window | Copy |
|--------|------|
| 05:00–11:59 | `Good morning, {firstName}` |
| 12:00–17:59 | `Good afternoon, {firstName}` |
| 18:00–21:59 | `Good evening, {firstName}` |
| 22:00–04:59 | `Hello, {firstName}` |

**Edge cases:**
- No name provided: drop the comma — `Good morning` (not "Good morning, ")
- Very long first name (>12 chars): still use it; the greeting sets font-size down if it wraps

### Delta strings (below hero number)

| Direction | Copy |
|-----------|------|
| Positive | `+$412.80 today` |
| Negative | `-$412.80 today` |
| Zero / < $0.01 change | `Unchanged today` |
| No data for comparison (new account, first day) | `No change yet` |

**Alternatives for time window:** when user scrolls to a different range via long-press, the string updates: `+$4,120.18 this month`, `+$18,240 this year`. Format: `{sign}{amount} {window}`.

### "See all" link

- Activity section link: `See all`
- Accounts section link (when >3 connected): `See all`

Always two words. Sentence case. Pearl color, 1px underline in spec.

### Empty states on Home

| State | Copy |
|-------|------|
| No accounts yet (shouldn't happen post-onboarding, but possible if user disconnects all) | Headline: `No accounts connected.` Body: `Connect one to see your net worth and activity.` CTA: `Connect an account` |
| No transactions in last 7 days | (no empty state shown — the Recent Activity section is simply omitted from the screen) |

---

## 5. Activity Screen Copy

### Labels

| Element | Copy |
|---------|------|
| Section header | `Activity` |
| Search placeholder | `Search transactions` |

### Filter chips

Stock set for V1. Sentence case.

| Group | Chip labels |
|-------|-------------|
| Categories | `Food` · `Transport` · `Shopping` · `Bills` · `Entertainment` · `Income` · `Transfers` · `Other` |
| Date range | `Today` · `This week` · `This month` · `This year` · `All` |

**Do not use** category-emoji prefixes (`🛒 Shopping`). Category icons from Phosphor are rendered separately (§1.4 product spec).

### Transaction row

| Field | Format / example |
|-------|------------------|
| Merchant | `Blue Bottle Coffee` (preserve the merchant's actual capitalization — don't lowercase) |
| Category (chip below merchant) | `Food` |
| Amount | `-$6.50` (outgoing) · `+$2,400.00` (incoming) |

### Transaction detail (on tap)

Fields shown, in order:

```
Amount              -$6.50
Date                April 20, 2026 · 8:42 am
Merchant            Blue Bottle Coffee
Category            Food  [Edit]
Account             Checking · Chase
Notes               [Add a note]
```

| Element | Copy |
|---------|------|
| "Edit" link | `Edit` |
| "Add a note" placeholder | `Add a note` |
| Notes saved confirmation (inline, 1.5s, Mist text) | `Saved.` |
| "Split transaction" action (V2) | `Split` |
| "Report an issue" (V2) | `Report an issue` |

### Empty states

| State | Copy |
|-------|------|
| No transactions at all (new user, no data yet) | Headline: `Nothing here yet.` Body: `Transactions will appear once your bank syncs. Usually within an hour.` |
| Search returned no results | Headline: `No matches.` Body: `Try a different search or clear your filters.` CTA: `Clear filters` |
| Filter returned no results | Headline: `No transactions in this range.` Body: (none) CTA: `Clear filters` |
| Offline + no cached data | Headline: `No connection.` Body: `Reconnect to see your activity.` CTA: `Retry` |

---

## 6. Error Message Library

Structure per rule §1: *what happened + what to do*, one sentence each, no "we," no "sorry."

### Connection & sync errors

| Error | Copy |
|-------|------|
| Plaid connection failed (retryable) | Headline: `That didn't connect.` Body: `Your bank timed out. Try again in a minute.` CTA: `Try again` |
| Plaid connection failed (non-retryable, needs different bank) | Headline: `That bank isn't supported yet.` Body: `Most major banks are. Try a different one, or email support@fintrest.com if yours isn't listed.` CTA: `Try a different bank` |
| Plaid auth expired (reconnection needed) | Headline: `Reconnect your bank.` Body: `Chase needs you to sign in again to keep syncing.` CTA: `Reconnect` |
| Sync stalled (no new data for 24 hours) | Inline banner on Home: `Chase hasn't synced since yesterday.` Link: `Fix` |
| Network offline | Full-screen when no cached data: `No connection.` Body: `Reconnect to continue.` CTA: `Retry` |
| Slow network (request taking >15s) | In-screen toast: `This is taking longer than usual.` (no CTA — auto-dismisses when done) |

### Auth & session errors

| Error | Copy |
|-------|------|
| Session expired | Headline: `Signed out for security.` Body: `Your session ended after 7 days of inactivity.` CTA: `Sign in` |
| Biometric failed (Face ID / Touch ID) | Inline: `Face ID didn't recognize you.` CTA: `Try again` · `Use passcode` |
| Wrong passcode | Inline: `Passcode doesn't match.` (no "incorrect" — the fact is enough) |
| Too many passcode attempts | Headline: `Locked for 5 minutes.` Body: `Try again after 5 minutes, or sign out to reset.` |

### Server / system errors

| Error | Copy |
|-------|------|
| Generic 500 | Headline: `Something broke.` Body: `This isn't your fault. Try again in a minute.` CTA: `Retry` |
| Service down (status page flagged) | Headline: `Fintrest is having trouble.` Body: `Updates at status.fintrest.com.` CTA: `Check status` |
| Rate limit (too many requests) | Headline: `Too many requests.` Body: `Wait 30 seconds and try again.` |
| App update required | Headline: `Update to continue.` Body: `This version of Fintrest is no longer supported.` CTA: `Update` |

### Form & input errors (inline)

Short. No headline; the field turns its error color and the message sits below.

| Context | Copy |
|---------|------|
| Email invalid | `Check the email format.` |
| Email already used | `An account with this email already exists. Sign in instead.` |
| Amount zero or negative (where positive expected) | `Enter an amount greater than zero.` |
| Required field empty | `Required.` |
| Password too short (V2) | `Must be at least 12 characters.` |
| 2FA code wrong | `Code doesn't match. Try again.` |
| 2FA code expired | `Code expired. Request a new one.` |

---

## 7. Confirmations & Dialogs

Structure per rule: **title = action phrased as question** · **body = consequences** · **buttons = labeled with the verb, not OK/Cancel**.

### Sign out

| Element | Copy |
|---------|------|
| Title | `Sign out?` |
| Body | `You'll need to sign in again next time.` |
| Primary button | `Sign out` |
| Cancel button | `Stay signed in` |

### Remove an account

| Element | Copy |
|---------|------|
| Title | `Remove {Chase Checking}?` |
| Body | `Past transactions stay in your history. New ones won't sync.` |
| Primary button (destructive) | `Remove` |
| Cancel button | `Keep` |

### Delete Fintrest profile (V2, but voice locked)

| Element | Copy |
|---------|------|
| Title | `Delete your Fintrest profile?` |
| Body | `This deletes your profile, connected accounts, and all transaction history. It can't be undone.` |
| Primary button (destructive) | `Delete permanently` |
| Cancel button | `Keep profile` |

### Disable biometric login

| Element | Copy |
|---------|------|
| Title | `Turn off Face ID?` |
| Body | `You'll sign in with your passcode instead.` |
| Primary button | `Turn off` |
| Cancel button | `Keep on` |

### Discard unsaved note

| Element | Copy |
|---------|------|
| Title | `Discard this note?` |
| Body | `Your changes won't be saved.` |
| Primary button (destructive) | `Discard` |
| Cancel button | `Keep editing` |

---

## 8. System Banners & Micro Copy

### Persistent banners (top of screen, dismissible)

| State | Copy |
|-------|------|
| Reconnect needed | `Chase needs reconnection.` CTA: `Reconnect` |
| Syncing in progress | `Syncing.` (auto-dismisses when done; no percentage) |
| Last synced label | `Synced {2 minutes} ago` (uses relative time) |

### Toasts (transient, 2–3 seconds)

| Event | Copy |
|-------|------|
| Category changed | `Category updated.` |
| Note saved | `Saved.` |
| Transaction flagged | `Flagged.` |
| Copy to clipboard | `Copied.` |

All one word + period. No icons in toasts. Toast bg: `carbon-lifted` with a 2px left border in `evergreen`.

### Loading states (where text is shown)

| Context | Copy |
|---------|------|
| Initial app boot, data loading | (none — the aperture-open animation is the loader) |
| Pull-to-refresh | `Syncing…` (only ellipsis permitted in the app) |
| Connecting account via Plaid | `Reading your accounts.` |
| Categorizing a transaction (background) | (silent — no spinner, no text) |

### Footer / legal

| Context | Copy |
|---------|------|
| Onboarding footer | `By continuing, you agree to our Terms and Privacy Policy.` |
| Settings → About | `Fintrest · v{1.0.0}` |
| Settings → About (tap to reveal) | `Built in {location}. Powered by Plaid.` |

---

## 9. Settings Screen Copy

### Top-level sections

| Label |
|-------|
| `Profile` |
| `Security` |
| `Preferences` |
| `Help` |
| `About` |

### Profile

| Field | Label |
|-------|-------|
| Name | `Name` |
| Email | `Email` |
| Sign out | `Sign out` |

### Security

| Toggle / row | Copy |
|--------------|------|
| Face ID | `Sign in with Face ID` |
| Passcode | `Require passcode` |
| Passcode — change | `Change passcode` |

### Preferences

| Toggle | Copy |
|--------|------|
| Haptic feedback | `Haptic feedback` |
| Sound | `Sound` |
| Show delta colors (off by default) | `Show color on gains and losses` |
| Appearance (V3) | `Appearance` |

### Help

| Row | Copy |
|-----|------|
| Support email | `Email support` |
| Status page | `Service status` |
| FAQ (V2) | `Frequently asked questions` |

### About

| Row | Copy |
|-----|------|
| Version | `Version {1.0.0}` |
| Privacy policy | `Privacy policy` |
| Terms | `Terms of service` |
| Licenses | `Open-source licenses` |

---

## 10. Notification Copy

### Push notifications (V1 policy: near-zero)

The only push notification in V1 is **session expiration**, and only when the user's last active session was over 7 days ago *and* they have biometric disabled. It's functional, not engagement.

| Trigger | Copy |
|---------|------|
| Session expired push | Title: `Signed out` · Body: `Sign in to continue.` |

### Push notifications added in V2

| Trigger | Copy |
|---------|------|
| Weekly insight ready (Mondays 7am local) | Title: `This week's insight` · Body: `A brief read on your last seven days.` |
| Large transaction ($1,000+) | Title: `{$2,400}` · Body: `{Rent} · {Chase}` |
| Reconnection needed | Title: `Reconnect your bank` · Body: `{Chase} needs you to sign in again.` |

**What we never push:**
- Balance went up or down
- "You saved $X this week"
- Stock hit a high or low
- Streaks, milestones, goals-near-met
- Marketing ("New feature!")

---

## 11. Accessibility Copy (VoiceOver / screen reader)

Per iOS accessibility guidelines, every interactive element needs a label. Where the label isn't obvious from visible text, the `accessibilityLabel` is specified below.

### Brand marks

| Element | accessibilityLabel |
|---------|-------------------|
| V1 aperture icon | `Fintrest` |
| V2 outlined aperture (loading spinner) | `Loading` |
| V3 single-blade glyph | `Fintrest mark` |

### Tab bar (V1)

| Tab | accessibilityLabel |
|-----|-------------------|
| Home | `Home` |
| Activity | `Activity` |

Both also include `accessibilityTraits: button, selected` when active.

### Home screen

| Element | accessibilityLabel |
|---------|-------------------|
| Hero net worth number | `Net worth, {128 thousand, 402 dollars, 18 cents}` — written out, not digits |
| Delta strip | `{Up 412 dollars, 80 cents today}` |
| Sparkline | `Net worth trend, last 90 days` (non-interactive for VoiceOver) |
| Account card | `{Chase Checking}, balance {2,400 dollars}` |
| "See all" link | `See all recent activity` |

### Activity screen

| Element | accessibilityLabel |
|---------|-------------------|
| Search bar | `Search transactions` |
| Filter chip (active) | `{Food} filter, selected` |
| Filter chip (inactive) | `{Food} filter` |
| Transaction row | `{Blue Bottle Coffee}, {Food}, negative {6 dollars, 50 cents}, {April 20}` |

### Error states

Errors announce with `accessibilityLiveRegion: assertive` so screen readers interrupt. The displayed copy is read verbatim.

---

## 12. Insights Screen Copy (V2 — voice locked now)

The Insights screen is the editorial room. Copy runs in GT Super 18 prose.

### Structure of an insight

Every insight follows the same shape: **observation → context → implication**. Never: "You should..." or "We recommend..."

**Example insight (good):**

> Your spending on food delivery tripled in the last 30 days, from $210 in March to $612 in April. Most of it — $410 — came from five orders over $80, all on weeknights after 9 pm. Late-night delivery typically signals skipped dinners earlier in the day, not a taste for eating out.

**Example insight (bad — do not write like this):**

> 🍕 Wow! You ordered a LOT of food delivery this month! You should try cooking at home to save money! 💰

Observe the difference: the good version uses specific numbers, states a pattern, and ends on an implication without a prescription. It trusts the user to know what to do.

### Insight headers

| Element | Copy |
|---------|------|
| Section label | `This week` |
| Week header | `Week of {April 20}` |
| "Pinned" section | `Pinned` |

### Ask bar

| Element | Copy |
|---------|------|
| Placeholder | `Ask Fintrest something` |
| Empty result | `Not enough data yet.` |

Do not place a sparkle / stars icon. Do not say "AI" or "Powered by AI."

---

## 13. Marketing Surface Copy (brief — for fintrest.com)

For when the landing page spec is built. Voice is identical to the product.

### Homepage hero

**Primary option (ship):**

> Grow what you have. Quietly.
>
> Fintrest reads your accounts, finds the patterns, and tells you what matters. Nothing more.

**Alternative:**

> The calm way to watch your money grow.
>
> Fintrest is a quieter kind of finance app.

**Primary CTA:** `Get the app` (not "Download" — sounds 2010-era)

### What we don't write

- No "Join 10,000+ users"
- No "Trusted by"
- No "As featured in"
- No carousel of press logos
- No countdown timer

---

## 14. Localization Notes (for future translators)

Fintrest is English-only in V1. These notes lock the terms and idioms for later.

### Terms that must translate carefully
- **"Grow what you have. Quietly."** — the thesis. The word "quietly" carries the brand. Translators should prioritize the feeling of restraint over a literal translation.
- **"The week in review"** — editorial idiom. In languages where this doesn't carry the same editorial weight, prefer "This week" or equivalent.
- **"Connected."** — must translate to a single word or short phrase; not "Successfully connected."
- **"Synced."** — same.

### Character expansion
- German translations typically run 30% longer than English. Headline areas (`Step 2`, `Sign in`, `Get started`) should have room for +30% length.
- Button widths in the RN codebase should be flex, not fixed.

### Numbers & currency
- Always render via `Intl.NumberFormat` with the user's locale for grouping separators.
- Mono font renders digits identically across locales — don't swap fonts for numerals.
- Currency symbol placement follows the locale's convention, but the symbol itself stays USD until we launch international.

### Tone
- The restraint rule is universal but expressed differently in each language. Translators should read §1 before touching any string. Exclamation points are banned in every language, including those that traditionally use them more (Spanish, French, Portuguese).

---

## 15. Copy Review Checklist (before merging any new string)

Before a copy string lands in the codebase:

- [ ] Does it follow rule 1 (editorial voice, not coaching)?
- [ ] Is there an exclamation point? (If yes: delete it.)
- [ ] Does it use "we" unnecessarily? (If yes: rewrite.)
- [ ] Are numbers in digits, not words?
- [ ] Do the terms match §2 glossary exactly?
- [ ] Can any word be cut without losing meaning? (If yes: cut.)
- [ ] If it's an error, does it say what happened + what to do?
- [ ] If it's a confirmation, are the buttons labeled with verbs?
- [ ] If it's an empty state, does it say what, why, and how to start?
- [ ] Would a 55-year-old editor at a serious magazine nod at this line?

If any answer is no, revise.

---

*v1.0 — voice locked. File additions against this doc, do not fork.*
