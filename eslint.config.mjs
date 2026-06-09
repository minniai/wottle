import next from "eslint-config-next";

const config = [
  ...next,
  {
    rules: {
      // eslint-config-next 16.2.7 promoted two new "purity-of-render" rules
      // from off to error. They are opinionated "you might not need an effect"
      // suggestions from the React team rather than correctness rules.
      //
      // The Wottle codebase has ~38 legitimate setState-in-effect call sites
      // (syncing server-broadcast match state into local UI state, syncing
      // the grid prop to internal BoardGrid state during reveal, etc.) and a
      // small number of `useRef(Date.now())` snapshots used as monotonic-
      // clock baselines for the client-side timer ticks — both established
      // patterns that work correctly. Restructuring would require lifting
      // state through several components without changing observable
      // behaviour. Disabling project-wide rather than scattering many
      // eslint-disable comments. Revisit if React provides dedicated
      // primitives (e.g. `useSyncExternalStore` for the broadcast surface or
      // a built-in monotonic-clock hook) that cover these cases.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
    },
  },
  {
    ignores: [
      // Static HTML/JSX design prototype — not production code. The prototype
      // script tags load primitives into global scope, which ESLint correctly
      // reports as undefined — but it's a reference artifact, not source.
      "docs/design_documentation/**",
      "prd/wordlist",
      "node_modules",
      ".next",
      "**/.next/**",
      ".worktrees/**",
      ".wts/**",
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

