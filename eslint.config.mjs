import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [
      "prd/wordlist",
      "node_modules",
      ".next",
      ".claude/worktrees",
      "out",
      "dist",
      "build",
      "coverage",
      "reports",
      "test-results",
      ".supabase",
      "supabase/.branches",
      "supabase/.temp",
      ".turbo",
      ".vercel",
      ".pnp",
      ".pnp.js",
      ".pnp.cjs",
      ".pnp/",
      ".vscode",
      ".idea",
      ".DS_Store",
      "pnpm-lock.yaml",
      ".env*",
      "**/*.log",
      "*.min.js",
      "*.tmp",
      "*.tsbuildinfo",
    ],
  },
];

export default config;

