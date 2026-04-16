import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./tests/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        board: {
          background: "#0f172a",
          cell: "#1e293b",
          highlight: "#38bdf8",
        },
        player: {
          a: "#38BDF8",
          b: "#EF4444",
        },
        brand: {
          50: "#FBF3E0",
          100: "#F5E4B8",
          200: "#F0D48A",
          300: "#ECC261",
          400: "#E8B64C",
          500: "#D9A130",
          600: "#B8821F",
          700: "#96671A",
          800: "#6F4B12",
          900: "#4A320C",
          950: "#2D1E07",
        },
        surface: {
          0: "#0B1220",
          1: "#141C2E",
          2: "#1C2640",
          3: "#253156",
        },
        text: {
          primary: "#F2EAD3",
          secondary: "#C7BDA3",
          muted: "#8A8470",
          inverse: "#0B1220",
        },
        accent: {
          focus: "#E8B64C",
          warning: "#F59E0B",
          success: "#10B981",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
      },
      transitionDuration: {
        swap: "200ms",
        shake: "350ms",
        highlight: "700ms",
      },
    },
  },
  plugins: [],
};

export default config;
