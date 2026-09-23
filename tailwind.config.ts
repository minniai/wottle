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
        },
        rule: "var(--rule)",
        tint: "var(--tint)",
        muted: "var(--muted)",
        you: { DEFAULT: "var(--you)", band: "var(--you-band)", live: "var(--you-live)" },
        opp: { DEFAULT: "var(--opp)", band: "var(--opp-band)", live: "var(--opp-live)", text: "var(--opp-text)" },
        err: "var(--err)",
        "future-label": "var(--future-label)",

      },
      fontFamily: {
        board: ["var(--font-board)", "Zilla Slab", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Red Hat Mono", "ui-monospace", "monospace"],
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
