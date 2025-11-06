import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [
      "node_modules",
      ".next",
      "out",
      "dist",
      "build",
      "coverage",
      ".supabase",
      "pnpm-lock.yaml",
      "**/*.log"
    ],
  },
];

export default config;
