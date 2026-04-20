# Fintrest — Aperture Mark (Production Spec v1.0)

*Concept 03 deepened to a production-ready specification. This document is the source of truth for the mark, its variations, the iOS app icon, and the launch animation. Hand it to design + engineering as-is.*

---

## 1. The Primary Mark — Geometry & Proportions

### 1.1 Canvas & safe area

| Property | Value |
|----------|-------|
| Source canvas | 1024 × 1024 px |
| Safe area | 832 × 832 px (centered, 96px margin) |
| Center origin | (512, 512) |
| Mark fits inside | Safe area only — never crops to canvas edge |

All measurements below are in source pixels at 1× (1024 canvas). For UI use, the mark should be exported as SVG so it scales linearly.

### 1.2 Blade count

**6 blades.** This is the defining decision. Reasoning:

- **5 blades** reads as a pinwheel/star. Too playful, too kinetic.
- **6 blades** creates a hexagonal central opening — the most architectural, calmest geometry. Reads as "engineered" rather than "spinning."
- **7 blades** is the premium-camera-lens count (Leica) but creates a heptagonal opening that humans read as slightly off-balance. Looks fussy at small sizes.
- **8+ blades** approaches a perfect circle in the center — loses the "aperture" identity and becomes a generic ring.

The hexagonal central void is also a quiet nod to honeycomb / structural strength — exactly the subliminal note we want for a finance brand.

### 1.3 Two governing radii

```
R_outer  = 384 px   → outer extent of every blade tip (75% of canvas)
R_inner  = 160 px   → distance from center to each hexagon vertex (~31% of canvas)
```

The visible central opening is therefore a regular hexagon with a side length of 160 px and a vertex-to-vertex span of 320 px.

### 1.4 Hexagon vertex coordinates

Six vertices on the inner hexagon, at angles `θ = 30° + (60° × i)` for i = 0..5. The 30° offset rotates the hexagon so it sits **flat-top** (one edge parallel to the horizontal), which feels more grounded than vertex-up.

| Vertex | Angle | (x, y) |
|--------|-------|--------|
| V0 | 30°  | (650.6, 432.0) |
| V1 | 90°  | (512.0, 352.0) |
| V2 | 150° | (373.4, 432.0) |
| V3 | 210° | (373.4, 592.0) |
| V4 | 270° | (512.0, 672.0) |
| V5 | 330° | (650.6, 592.0) |

### 1.5 Single blade construction (the unit cell)

Each blade is a quadrilateral with one curved edge. Build one blade, then rotate it by 60° five times around the center.

Blade between V0 and V1 (top-right blade):

```
1. Start at V0 (650.6, 432.0).
2. Straight line to point P0 on outer circle:
   P0 = (R_outer · cos(60°), R_outer · sin(60°)) + center
      = (704.0, 179.4)        ← outer-right anchor
   This is the "trailing edge" — the blade's straight back edge.
3. Outer arc (clockwise) from P0 to P1:
   P1 = (R_outer · cos(120°), R_outer · sin(120°)) + center
      = (320.0, 179.4)        ← outer-left anchor
   Arc radius = R_outer (384). Sweep 60° along the outer circle.
4. Curved leading edge from P1 back to V1:
   This is a cubic Bézier with the curve bowed *inward* (toward center).
   Control points:
     C1 = P1 nudged 64px toward center along its radial line
     C2 = V1 nudged 96px outward along its radial line, then rotated +12°
   This asymmetry is what makes the mark read as an *aperture mid-rotation*
   rather than a static gear. The 12° rotation is the single most important
   detail in the whole mark — without it, this is a cog.
5. Close path back to V0.
```

Repeat by rotating the entire path 60°, 120°, 180°, 240°, 300° around (512, 512). All 6 blades are identical — no per-blade variation.

### 1.6 Blade visual properties

| Property | Value |
|----------|-------|
| Fill | `#FAFAF7` (Pearl) on dark backgrounds; `#0F0F10` (Carbon) on light |
| Stroke | None on the mark itself |
| Inter-blade gap | 0px (blades meet exactly at hexagon edges — no visible seam) |
| Bevel on blade tip | 1° inward chamfer at the outermost 8px of each blade |

The 1° chamfer is invisible at glance but stops the blade tips from looking laser-cut — they pick up light slightly differently than the body of the blade, which gives the mark a sculpted quality at large sizes.

### 1.7 What you must not change

- **Hexagon orientation:** flat-top, not vertex-up.
- **Asymmetric blade:** the 12° leading-edge rotation. This is the mark.
- **Blade count:** 6. Not 5, not 7, not 8.
- **Inner-to-outer ratio:** R_inner / R_outer = 0.417. This balance was tuned so the mark reads as "aperture closing" rather than "fully open" or "fully shut." More closed and it becomes a flower; more open and it becomes a ring.

---

## 2. Three Variations of the Mark

The mark needs to live in three different size regimes. Each has its own variant.

### 2.1 V1 — Solid Aperture *(primary mark)*

The construction described above. Six solid blades, hexagonal void.

**Use for:**
- App icon (all sizes)
- Splash screens
- Marketing hero placements
- Anything ≥ 32px

**Colors:**
- Pearl (`#FAFAF7`) on Carbon (`#0F0F10`) background — primary
- Carbon on Pearl — for printed materials, secondary
- Evergreen (`#1F5C46`) on Pearl — restricted use, for "deposit confirmed" / success states only

### 2.2 V2 — Outlined Aperture *(UI variant)*

Same blade geometry, but rendered as a single 16px stroke along the *outer* contour only — so you see the silhouette of the aperture but not the interior division between blades.

**Why a separate variant:** at small UI sizes (16-32px) the inter-blade edges become visual noise. The outline preserves the silhouette — the hexagonal void surrounded by the petaled outer shape — without the noise.

**Stroke width scales with target size:**

| Target size | Stroke width |
|-------------|-------------|
| 16 px | 1.5 px |
| 24 px | 2 px |
| 32 px | 2.5 px |
| 48 px | 3.5 px |

**Use for:**
- Tab-bar icons
- Inline brand mentions in text
- Loading spinners (rotates slowly)
- Browser favicon

### 2.3 V3 — Single-Blade Glyph *(reductive mark)*

A single blade in isolation, oriented at the **150° position** (top-left). The blade's leading curve, read in isolation, suggests the descender/curve of a lowercase **f** — connecting the mark back to the wordmark "fintrest." This is intentional and intelligent: the relationship is felt, never spelled out.

**Use for:**
- Profile avatars (default user state, in-app)
- Account-tier badges (filled in different metals: bronze, silver, gold)
- Email signature glyph
- Apple Watch complication
- Any context ≤ 16px or where the full aperture would be illegible

**Colors:** monochrome only. Pearl on Carbon, or Carbon on Pearl. No accent color use for V3.

---

## 3. iOS App Icon — Production Mock Descriptions

The iOS icon is the most-seen instance of the brand. These are the exact specifications.

### 3.1 Icon canvas

- Source export: 1024 × 1024 px (App Store requirement)
- iOS applies the rounded-rectangle mask automatically (corner radius ≈ 22.37% of side, or 229px on the 1024 canvas) — **do not pre-apply the mask**
- Safe content area: 832 × 832 px centered

### 3.2 Background composition

A radial gradient, not a flat fill. Purpose: depth at glance distance, restraint up close.

```
Type:        radial gradient
Center:      (512, 412)        ← shifted 100px above geometric center
Inner color: #14181A           ← Carbon Lifted (slightly warmer than pure Carbon)
Outer color: #0A0B0C           ← near-black
Radius:      820 px            ← extends past the canvas edge
Easing:      ease-out          ← quick falloff, then long calm tail
```

The off-center origin creates the impression of a single light source coming from above — like the icon is in a room with a north-facing window. Gen-Z premium (Linear, Arc, Things 3) all use this trick.

### 3.3 Mark placement & scale

- Aperture mark, V1, in **Pearl** `#FAFAF7`
- Centered at (512, 512)
- Scaled to 760 × 760 px (slightly larger than safe area's 832, but inside the iOS visual mask)
- The hexagonal void in the center of the mark sits at the optical center of the icon — this matters because users' eyes lock onto that void first

### 3.4 The inner glow (the most important detail)

A small, contained glow *inside the hexagonal void only*. This is what makes the icon feel premium instead of flat.

```
Shape:       circle
Center:      (512, 512)
Radius:      120 px
Fill:        #1F5C46 at 35% opacity (Evergreen)
Blur:        Gaussian, 60 px radius
Blend mode:  screen
```

Effect: there appears to be a tiny green light coming from "behind" the lens. At a glance distance you don't see green — you see warmth. Up close it's an intentional detail. This is exactly how the Spotify icon's gradient works: invisible until you look.

### 3.5 The blade highlight (large sizes only)

For renders ≥ 256px, add a soft directional highlight along the upper-left edge of each blade:

```
Source: linear gradient on each blade
Angle:  315° (light from upper-left)
Stops:  #FFFFFF at 12% opacity → transparent
Width:  spans only the outer 30% of each blade
```

This is the chamfer from §1.6 made visible. Skip for icons ≤ 128px (it becomes mud).

### 3.6 How it reads on the iPhone home screen

- **Next to Spotify (green circle on black):** Fintrest's hexagonal void echoes Spotify's circular form factor without competing with its bright color. The Pearl mark on Carbon background reads cleaner than Spotify's busy waveform — it looks more *deliberate*.
- **Next to the Apple Wallet icon:** Wallet uses a black background with vivid card slabs. Fintrest's restraint reads as "the grown-up version of money apps."
- **Next to Robinhood (white background, green feather):** Fintrest looks like the *next decade* of finance design. Robinhood looks like 2017.
- **In a folder, at 60×60px:** the V1 mark holds because the hexagonal void is the dominant feature — humans recognize hexagons fast. Spotify, Threads, and X all win at small sizes by being *one shape*; Fintrest does the same.
- **In dark mode:** indistinguishable from the icon's standard rendering. This is intentional — we are *already* dark mode.

### 3.7 Required exports

| File | Size | Purpose |
|------|------|---------|
| `AppIcon-1024.png` | 1024 × 1024 | App Store |
| `AppIcon-180.png` | 180 × 180 | iPhone @3x |
| `AppIcon-167.png` | 167 × 167 | iPad Pro |
| `AppIcon-152.png` | 152 × 152 | iPad |
| `AppIcon-120.png` | 120 × 120 | iPhone @2x |
| `AppIcon-87.png` | 87 × 87 | iPhone settings @3x |
| `AppIcon-58.png` | 58 × 58 | iPhone settings @2x |
| `AppIcon-40.png` | 40 × 40 | Spotlight |
| `AppIcon-tinted.png` | 1024 × 1024 | iOS 18 tinted home screen — Pearl mark on transparent background, no glow |

For iOS 18's tinted home-screen mode, ship a separate asset: just the Pearl mark on transparent. The system applies the user's tint automatically. Do **not** include the gradient background or the inner glow on this version.

---

## 4. Launch Micro-interaction — The Aperture Open

The mark is a camera aperture. When the app opens, it opens. This is the entire animation philosophy.

### 4.1 Sequence

| Phase | Time | What happens |
|-------|------|--------------|
| t = 0 ms | — | App tapped. iOS hands off to launch screen. Static aperture mark, V1, Pearl on Carbon, centered. |
| 0 → 80 ms | 80 ms hold | Mark holds in resting state. The pause is necessary — without it, the open feels reactive, not deliberate. |
| 80 → 320 ms | 240 ms | **The Open.** All 6 blades rotate +14° around the center, opening the hexagonal void from 320px to 460px. Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint). |
| 280 → 360 ms | 80 ms (overlap) | The inner glow's opacity ramps from 35% to 75% and its radius expands from 120px to 220px. |
| 320 → 480 ms | 160 ms | **The Reveal.** A circular wipe expands from the center of the void, easing the launch screen out and the home screen in. The mark cross-dissolves to the home screen content. |
| 480 ms | — | Home screen visible. Animation complete. Total: **480 ms**. |

### 4.2 Easing curves (verbatim, drop into code)

```
Open:           cubic-bezier(0.22, 1, 0.36, 1)        -- ease-out-quint
Glow ramp:      cubic-bezier(0.4, 0, 0.2, 1)          -- standard material
Reveal wipe:    cubic-bezier(0.65, 0, 0.35, 1)        -- ease-in-out-cubic
```

### 4.3 Haptic

Single `UIImpactFeedbackGenerator(style: .soft)` fires at **t = 280 ms** — the moment the blades reach max open. Not a heavy thunk; a quiet *tick*, like a mechanical shutter releasing.

Why this exact timing: the haptic should land on the *resolution* of the motion, not its start. Hitting at t=0 feels like a press confirmation; hitting at t=280 feels like the mark is the cause of the haptic, which is what we want.

### 4.4 Sound (optional, default off)

A 240ms sample of a Hasselblad shutter, pitched down 30%, gain at -22dB. **Default off** — opt-in via Settings → Sounds. Most users won't enable it, but the small cohort who do will love it, and it costs nothing to ship.

### 4.5 Loading-state continuation

If the app needs to do work after launch (network call, biometric auth), the aperture **does not vanish immediately**. Instead:

- After the Reveal completes at 480 ms, the V2 outlined aperture appears in the top-left of the screen (32px, Pearl)
- It rotates continuously, 1 full revolution every 2.4 seconds, linear easing
- When the work completes, it fades out over 200 ms

This makes the loading indicator part of the brand instead of a generic spinner. Same pattern as the Stripe page transitions.

### 4.6 SwiftUI implementation sketch

```swift
struct ApertureLaunchView: View {
  @State private var isOpen = false
  @State private var glowOpacity = 0.35
  @State private var glowScale: CGFloat = 1.0

  var body: some View {
    ZStack {
      RadialGradient(/* §3.2 */)

      Circle()
        .fill(Color(hex: "1F5C46"))
        .opacity(glowOpacity)
        .frame(width: 240 * glowScale, height: 240 * glowScale)
        .blur(radius: 60)

      ApertureShape(blades: 6)
        .fill(Color(hex: "FAFAF7"))
        .frame(width: 760, height: 760)
        .rotationEffect(.degrees(isOpen ? 14 : 0))
    }
    .onAppear {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
        withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.24)) {
          isOpen = true
        }
        withAnimation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.16)
                     .delay(0.20)) {
          glowOpacity = 0.75
          glowScale = 1.83
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.20) {
          UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        }
      }
    }
  }
}
```

The `ApertureShape` itself is provided as an SVG in the companion file `fintrest-aperture-marks.svg` — convert to a `Path` once and cache.

---

## 5. Asset Handoff Checklist

- [ ] V1 (solid) — SVG, exported at 1024×1024 with no fill (color via CSS/SwiftUI)
- [ ] V2 (outline) — SVG with 4 stroke-width variants (1.5, 2, 2.5, 3.5)
- [ ] V3 (single blade) — SVG, monochrome only
- [ ] App icon — 9 PNG sizes per §3.7
- [ ] iOS 18 tinted icon — separate transparent PNG
- [ ] Apple Watch complication — V3, exported at 24, 32, 44px
- [ ] Favicon — V2 outline, 16, 32 px
- [ ] Animation reference — Lottie JSON or .mov of the launch sequence (240fps, 1024px square)

The companion SVG file (`fintrest-aperture-marks.svg`) contains all three variations as a single artboard, layered and named for easy export from Figma or directly from the SVG.

---

*Spec v1.0 — production-ready. Anything not specified above is a designer judgment call; anything specified above is locked.*
