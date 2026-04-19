import type { Config } from "tailwindcss";

const INK = "oklch(0.22 0.025 258)";
const INK_2 = "oklch(0.29 0.027 258)";
const INK_3 = "oklch(0.38 0.024 258)";
const INK_SOFT = "oklch(0.52 0.020 258)";

const PAPER = "oklch(0.975 0.012 85)";
const PAPER_2 = "oklch(0.955 0.014 82)";
const PAPER_3 = "oklch(0.925 0.016 80)";

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
        /* New Warm Editorial families */
        paper: {
          DEFAULT: PAPER,
          2: PAPER_2,
          3: PAPER_3,
        },
        ink: {
          DEFAULT: INK,
          2: INK_2,
          3: INK_3,
          soft: INK_SOFT,
        },
        ochre: {
          DEFAULT: "oklch(0.72 0.13 70)",
          deep: "oklch(0.58 0.14 60)",
          tint: "oklch(0.93 0.045 80)",
        },
        p1: {
          DEFAULT: "oklch(0.68 0.14 60)",
          tint: "oklch(0.92 0.06 70)",
          deep: "oklch(0.48 0.14 55)",
        },
        p2: {
          DEFAULT: "oklch(0.56 0.08 220)",
          tint: "oklch(0.92 0.035 220)",
          deep: "oklch(0.38 0.08 220)",
        },
        good: "oklch(0.62 0.12 150)",
        warn: "oklch(0.70 0.15 40)",
        bad: "oklch(0.58 0.17 25)",
        hair: {
          DEFAULT: `color-mix(in oklab, ${INK} 14%, transparent)`,
          strong: `color-mix(in oklab, ${INK} 22%, transparent)`,
        },

        /* Legacy aliases — existing class names resolve to the new light palette */
        board: {
          background: PAPER_3,
          cell: PAPER,
          highlight: "oklch(0.72 0.13 70)",
        },
        player: {
          a: "oklch(0.68 0.14 60)",
          b: "oklch(0.56 0.08 220)",
        },
        brand: {
          50: "oklch(0.97 0.022 80)",
          100: "oklch(0.94 0.04 80)",
          200: "oklch(0.90 0.06 75)",
          300: "oklch(0.84 0.09 72)",
          400: "oklch(0.78 0.11 70)",
          500: "oklch(0.72 0.13 70)",
          600: "oklch(0.62 0.14 65)",
          700: "oklch(0.52 0.14 60)",
          800: "oklch(0.42 0.13 55)",
          900: "oklch(0.32 0.10 50)",
          950: "oklch(0.22 0.08 45)",
        },
        surface: {
          0: PAPER,
          1: PAPER_2,
          2: PAPER_3,
          3: PAPER_3,
        },
        text: {
          primary: INK,
          secondary: INK_3,
          muted: INK_SOFT,
          inverse: PAPER,
        },
        accent: {
          focus: "oklch(0.58 0.14 60)",
          warning: "oklch(0.70 0.15 40)",
          success: "oklch(0.62 0.12 150)",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        mono: [
          "var(--font-jetbrains-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      transitionDuration: {
        swap: "200ms",
        shake: "350ms",
        highlight: "700ms",
      },
      boxShadow: {
        "wottle-sm": "var(--shadow-sm)",
        "wottle-md": "var(--shadow-md)",
        "wottle-lg": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
