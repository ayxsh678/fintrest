// Fintrest Design Tokens — v1.0
// Source of truth: fintrest-build-spec.md §2
// Do not redefine colors, spacing, radii, or motion values anywhere else.
// If you need a value that isn't here, add it here first, then consume it.

export const colors = {
  // Surfaces (dark-mode first)
  carbon:        "#0F0F10",
  carbonLifted:  "#14181A",
  carbonBorder:  "#1C1F22",
  obsidian:      "#0A0B0C",

  // Text
  pearl:         "#FAFAF7",
  mist:          "#A6ADB4",
  fog:           "#6B7178",

  // Accents (used sparingly — never on every positive number)
  evergreen:     "#1F5C46",
  evergreenGlow: "rgba(31, 92, 70, 0.35)",
  ember:         "#B24A2A",

  // Utility
  hairline:      "rgba(250, 250, 247, 0.08)",
  overlay:       "rgba(5, 5, 6, 0.72)",
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  x3:  48,
  x4:  64,
  x5:  96,
  x6:  128,
};

export const radii = {
  sm:   8,
  md:   12,
  lg:   16,
  pill: 999,
  icon: 229, // iOS app icon squircle on 1024
};

export const typography = {
  fontFamilies: {
    editorial: `"Fraunces", "GT Super Display", Georgia, serif`,
    ui:        `"Inter", "Neue Haas Grotesk", -apple-system, BlinkMacSystemFont, sans-serif`,
    mono:      `"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace`,
  },
  // Display scale — editorial serif, tight tracking
  display: {
    xl: { size: 72, leading: 1.02, tracking: "-0.02em", weight: 400 },
    lg: { size: 56, leading: 1.04, tracking: "-0.02em", weight: 400 },
    md: { size: 40, leading: 1.08, tracking: "-0.015em", weight: 400 },
  },
  // UI scale — Inter
  ui: {
    body:    { size: 16, leading: 1.5, tracking: "0", weight: 400 },
    bodySm:  { size: 14, leading: 1.45, tracking: "0", weight: 400 },
    label:   { size: 12, leading: 1.3, tracking: "0.06em", weight: 500, transform: "uppercase" },
    number:  { size: 16, leading: 1.2, tracking: "0", weight: 500, family: "mono" },
  },
};

export const motion = {
  durations: {
    instant: 80,
    fast:    160,
    base:    240,
    smooth:  280,
    slow:    480,
    intro:   800,
  },
  easings: {
    standard:  "cubic-bezier(0.2, 0.0, 0.0, 1.0)",
    quintOut:  "cubic-bezier(0.22, 1, 0.36, 1)",
    cubicInOut:"cubic-bezier(0.65, 0, 0.35, 1)",
  },
};

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
  md: "0 4px 16px rgba(0, 0, 0, 0.32)",
  lg: "0 24px 64px rgba(0, 0, 0, 0.48)",
  glow: `0 0 48px ${colors.evergreenGlow}`,
};

export const breakpoints = {
  sm:  480,
  md:  768,
  lg:  1024,
  xl:  1440,
};

// Convenience: the default export bundles everything so consumers can do
// `import tokens from "./tokens";` and access tokens.colors.carbon.
const tokens = { colors, spacing, radii, typography, motion, shadows, breakpoints };
export default tokens;
