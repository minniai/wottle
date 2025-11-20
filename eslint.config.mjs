import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [
      "prd/wordlist",
      "node_modules",
      ".next",
      "out",
      "dist",
      "build",
      "coverage",
      ".supabase",
      "supabase/.branches",
      "supabase/.temp",
      ".turbo",
      ".vercel",
      "pnpm-lock.yaml",
      "**/*.log",
      "*.min.js"
    ],
  },
];

export default config;

