import type { Config } from "tailwindcss";

const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        background: c("background"),
        foreground: c("foreground"),
        card: c("card"),
        elevated: c("elevated"),
        border: c("border"),
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        subtle: c("subtle-foreground"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        accent: c("accent"),
        confidence: c("confidence"),
        risk: { critical: c("risk-critical"), high: c("risk-high"), medium: c("risk-medium"), low: c("risk-low") },
        route: { auto: c("route-auto"), analyst: c("route-analyst"), senior: c("route-senior") },
        agent: {
          graph: c("agent-graph"), txn: c("agent-txn"), device: c("agent-device"), memory: c("agent-memory"),
          policy: c("agent-policy"), challenger: c("agent-challenger"), orchestrator: c("agent-orchestrator"),
        },
      },
      borderRadius: { xl: "0.75rem" },
    },
  },
  plugins: [],
};
export default config;
