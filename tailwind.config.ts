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
