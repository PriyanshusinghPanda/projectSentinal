/**
 * theme.ts — design tokens for the whole video.
 *
 * Edit this FIRST for each new video. Every component reads from here, so a
 * coherent theme is what makes the result look intentional. Keep the palette
 * tight: a background, 1–2 surface shades, foreground text, muted text, and a
 * single accent (plus an optional second accent). Resist adding more colors.
 */

export const theme = {
  colors: {
    // Sentinel brand: warm paper, ink, one ink-blue accent (matches the web app)
    bg: "#F7F3EC",
    surface: "#FDFBF7",
    surfaceAlt: "#EFE8DC",
    border: "#DDD4C6",
    fg: "#201C18",
    muted: "#6B625A",
    accent: "#2A4466", // ink blue
    accent2: "#2F6B4F", // green — legitimate / auto
    warn: "#9A6A14", // ochre — uncertain / L1
    danger: "#B0342B", // red — fraud
    codeBg: "#FDFBF7",
  },

  font: {
    family: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    display: '"Instrument Serif", Georgia, serif',
    mono: '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
    size: {
      hero: 112,
      title: 72,
      heading: 48,
      body: 34,
      label: 26,
      caption: 30,
      code: 26,
    },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  },

  // 8pt spacing scale
  space: (n: number) => n * 8,

  radius: { sm: 8, md: 16, lg: 24, pill: 999 },

  // Spring presets — import these into useEntrance for consistent motion.
  springs: {
    // snappy but soft; good default for most entrances
    gentle: { damping: 18, mass: 0.7, stiffness: 120 },
    // a touch bouncier, for playful accents
    pop: { damping: 12, mass: 0.6, stiffness: 160 },
    // slow settle, for large hero elements
    smooth: { damping: 26, mass: 1, stiffness: 90 },
  },
} as const;

export type Theme = typeof theme;
