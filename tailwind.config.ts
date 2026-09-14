import type { Config } from "tailwindcss";

/**
 * Field & Ledger theme (design system §2–§3). Every colour utility resolves to
 * one of the seven CSS tokens declared in app/globals.css; the legacy block
 * keeps pre-rebuild class names compiling while their components are retired.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./tests/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: {
          DEFAULT: "var(--ink)",
          /* legacy */ 2: "var(--ink)",
          3: "var(--ink)",
          soft: "var(--muted)",
        },
        rule: "var(--rule)",
        tint: "var(--tint)",
        muted: "var(--muted)",
        you: { DEFAULT: "var(--you)", band: "var(--you-band)", live: "var(--you-live)" },
        opp: { DEFAULT: "var(--opp)", band: "var(--opp-band)", live: "var(--opp-live)" },
        "future-label": "var(--future-label)",

        /* Legacy aliases — removed with their last consumer (design plan §11). */
        "paper-2": "var(--tint)",
        "paper-3": "var(--tint)",
        ochre: { DEFAULT: "var(--ink)", deep: "var(--ink)", tint: "var(--tint)" },
        p1: { DEFAULT: "var(--you)", tint: "var(--you-band)", deep: "var(--you)" },
        p2: { DEFAULT: "var(--opp)", tint: "var(--opp-band)", deep: "var(--opp)" },
        good: "var(--ink)",
        warn: "var(--ink)",
        bad: "var(--ink)",
        hair: { DEFAULT: "var(--rule)", strong: "var(--rule)" },
        surface: { 0: "var(--paper)", 1: "var(--tint)", 2: "var(--tint)", 3: "var(--tint)" },
        text: { primary: "var(--ink)", secondary: "var(--ink)", muted: "var(--muted)", inverse: "var(--paper)" },
        accent: { focus: "var(--ink)", warning: "var(--ink)", success: "var(--ink)" },
      },
      fontFamily: {
        board: ["var(--font-board)", "Zilla Slab", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Red Hat Mono", "ui-monospace", "monospace"],
        /* legacy */
        display: ["var(--font-board)", "Zilla Slab", "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "0",
        none: "0",
      },
      transitionDuration: {
        swap: "150ms",
        shake: "300ms",
        band: "400ms",
      },
    },
  },
  plugins: [],
};

export default config;
