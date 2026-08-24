# design-sync notes — Wottle

Repo-specific gotchas for syncing Wottle (an app repo, not a packaged library) to
Claude Design project "Wottle Warm Editorial" (38c0454e-8e66-4b9a-a3b6-2ba9d5fa58cf).

## Build shape
- No library build/dist. `cfg.entry` points at the authored `.design-sync/ds-entry.ts`,
  which re-exports the curated ~58 presentational components and imports
  `stubs/process-shim` first (lib/constants/app.ts reads `process.env` at module level).
- `cfg.tsconfig` is `.design-sync/tsconfig.sync.json` (NOT the repo tsconfig): it maps
  `server-only`, `next/link`, `next/navigation`, `next/headers`, and the
  `getPlayerProfile` Server Action to `.design-sync/stubs/*`. Order matters — specific
  rules before the `@/*` wildcard. The converter's paths plugin does NOT resolve
  `extends`, so the file is self-contained.
- Excluded as data-bound/server components: MatchClient, FinalSummary, LobbyList,
  LobbyStatsStrip, PlayNowCard, InviteDialog, LandingScreen, LandingTileVignette,
  MatchmakingClient, UserMenu, TopBar (server component: imports readLobbySession).
- CSS: `buildCmd` (`node .design-sync/build-css.mjs`) compiles app/globals.css +
  app/styles/*.css with the repo's own @tailwindcss/postcss into
  `.design-sync/.cache/compiled/wottle.css` (= cfg.cssEntry). Tailwind 4;
  `@config ../tailwind.config.ts` resolves fine under postcss run from repo root.
- Fonts: `next/font/google` means no @font-face in the repo. Self-hosted woff2s live in
  `.design-sync/fonts/` (Fraunces variable, JetBrains Mono 400/500, Inter 400–700 — all
  OFL) wired via `cfg.extraFonts`. Do NOT use a remote Google Fonts `@import` in the
  CSS: a hanging fetch blocks the ENTIRE stylesheet in headless chromium (cost a full
  debug cycle). The `--font-fraunces`/`--font-jetbrains-mono`/`--font-inter` vars the
  app gets from next/font are defined in `:root` by build-css.mjs.
- `componentSrcMap` enumerates every component with an explicit path (required: with an
  authored entry there is no .d.ts tree to discover exports from).
- `docsMap` stubs under `.design-sync/docs/ui/` regroup components/ui out of "general"
  (the converter treats `ui` as a generic dir name).

## Known render warns
- `[FONT_MISSING] "Cambria" (--font-serif)` — Tailwind's default serif stack
  (ui-serif/Georgia/Cambria), not a brand font. Fraunces is the display serif and ships.
  Accepted.

## Environment
- Playwright 1.60.0 (repo pin) matches cached chromium build 1223; `playwright@1.60.0`
  is installed in `.ds-sync/node_modules` for the render check.
- npm blocks install scripts by default here (`npm warn install-scripts`) — esbuild
  works regardless (binary ships as optional dep).

## Preview-authoring learnings (solo wave)
- Import components from `"wottle"`; types are not exported — use plain object literals.
  Data shapes live in `lib/types/match.ts` (RoundSummary, WordScore, ScoreTotals, …).
- Use Icelandic content (BORÐA, SKÁL, VINUR; names like Birna, Kári) — these cards
  demo an Icelandic word game.
- Components with auto-dismiss timers (RoundSummaryPanel etc.): pass `autoDismissMs={0}`.
- Rail cards are width-fluid — wrap in `<div style={{maxWidth: 280–360}}>`.

## Preview-authoring learnings (wave 1)
- Config `overrides` edits AFTER a full build trip `[CONFIG_STALE]` in preview-rebuild
  for the affected component, and one stale target aborts the whole `--components`
  batch — run `package-build.mjs` to re-stamp, or drop the component from the list.
- Fixed-position components (InviteToast, Toast-like chrome): wrap in
  `<div style={{position:"relative", transform:"translateZ(0)", width, height}}>` —
  the transform makes the wrapper the containing block for fixed descendants. Beats a
  cardMode/viewport override.
- ScoreDeltaPopup has a hardcoded 3s unmount timer + `forwards` fade-out and no
  disable prop; its preview freezes it with inline `animation:none; opacity:1`
  !important overrides. If a capture ever takes >3s mount→screenshot the cell blanks;
  durable fix would be an `autoDismissMs` prop on the component.
- Critical-clock cells (HudCard/TimerDisplay/PlayerPanel low-time) blink via an
  internally-derived opacity keyframe — captured mid-fade, digits can look washed out.
  Genuine behavior, graded good. (Nice-to-have: converter could pause animations at
  capture time.)
- BoardCoordLabels stretches its A–J header to the container while the grid keeps
  intrinsic width — constrain Board previews to ≤440px or labels misalign.
- BoardGrid: use `currentRoundScoredTiles` (`Record<"x,y", cssColor>`) for static
  scored highlights; `scoredTileHighlights` auto-clears (capture-unsafe).
  FrozenTileMap keys are `"x,y"` (col,row), values `{owner, scoredAxes?}`.
- TimerDisplay derives tone from `timerSeconds` internally and does not tick; GearMenu
  has no props (open panel = SettingsPanel); Toast takes `message`/`autoDismissMs:null`
  directly (ToastProvider only needed for the useToast enqueue flow); Skeleton needs
  explicit inline width/height.
- Avoid arbitrary Tailwind utilities in previews — the compiled CSS only contains
  classes the app itself uses. Inline styles for layout; app-used token classes for
  typography.
- RecentGamesCard relative times: compute `completedAt` from `Date.now()` at module
  eval for deterministic "3h ago" labels.

## Upstream observations (for the app team, not sync defects)
- `.match-ring`'s spin animation rotates the container, so the child avatar/initials
  visibly rotate during matchmaking. If unintentional, animate a pseudo-element/border
  layer instead.
- ScoreDeltaPopup can't be held open (no duration prop) — see above.

## dts fork
- `.design-sync/overrides/dts.mjs` (declared in `cfg.libOverrides`) adds the repo's
  component `.tsx` sources + `lib/**/*.ts` to the ts-morph project with a `@/*` paths
  alias — without it every emitted `.d.ts` is a `[key: string]: unknown` stub (there is
  no dist `.d.ts` tree to parse). Zero-prop components (HowToPlayCard, LegendCard,
  GearMenu, LobbyHero, RematchInterstitial) + ToastProvider are pinned via
  `cfg.dtsPropsFor`. On re-sync, diff the fork against the bundled `lib/dts.mjs` and
  merge upstream changes. Adding/deleting the fork moves the grade contract for EVERY
  component → expect a one-time full re-grade (this happened on first sync).

## Re-sync risks
- The self-hosted font files were downloaded from Google Fonts on 2026-08-24; they are
  static and safe, but if brand fonts change in layout.tsx, re-download.
- `stubs/getPlayerProfile.ts` inlines a canned PlayerProfile; if the PlayerProfile type
  changes, the stub must be updated (typecheck of the stub is not wired into CI).
- The ds-entry component list is maintained by hand; a new presentational component in
  components/ is NOT picked up automatically — add it to ds-entry.ts + componentSrcMap.
- next/link, next/navigation stubs mimic Next 16 surface minimally; if components start
  using more of the router API, extend the stubs.
