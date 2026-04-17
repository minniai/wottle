# Research: Lobby Visual Foundation

**Feature**: 019-lobby-visual-foundation
**Date**: 2026-04-16

## R1: Deterministic Avatar Generation

**Decision**: Derive a stable 32-bit FNV-1a hash from `player.id`, map it to an HSL hue pair for a two-stop linear gradient, pick a monogram foreground (`#F2EAD3` or `#0B1220`) based on the gradient's mid-lightness for 4.5:1 contrast, and extract the first 1–2 grapheme clusters of `displayName` via `Intl.Segmenter`.

**Rationale**: FR-011 requires determinism: "the same player always renders the same avatar." Hashing the stable UUID satisfies this without any persistence or external service. HSL hue pair gives visual variety while keeping saturation and lightness in a controlled band that works against the Warm Editorial surfaces (deep navy base). `Intl.Segmenter` is the correct primitive for graphemes — slicing by `charCodeAt` breaks Icelandic combining characters (e.g., `Ö`) and emoji; `Intl.Segmenter` is available in all target browsers (Safari 14.1+, Chrome 87+, Firefox 125+).

**Alternatives considered**:
- **DiceBear (external service)**: rejected — adds a network fetch before LCP paint; violates SC-005 LCP budget.
- **Server-generated SVGs stored on players**: rejected — requires migration and storage; Option A (generated avatars, no infra) was locked during `/speckit.specify`.
- **MD5 / SHA-1 of playerId**: rejected — needlessly expensive; FNV-1a is sufficient for visual distribution and synchronous.

**Sources**: `Intl.Segmenter` — [MDN, accessed 2026-04-16](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter). FNV-1a hash — Fowler/Noll/Vo reference.

## R2: Next/Font Loading for Fraunces

**Decision**: Load Fraunces via `next/font/google` as a variable font (axis `opsz`, weight 400–900) with `display: "swap"`, `preload: true`, and subset `["latin", "latin-ext"]` to cover Icelandic glyphs Þ/Æ/Ð/Ö. Expose as CSS variable `--font-fraunces` and register in `tailwind.config.ts` as `fontFamily.display`.

**Rationale**: `next/font` eliminates the FOUT/FOIT risk by inlining font CSS at build time and self-hosting; variable font + single `display: "swap"` declaration replaces the multi-weight waterfall that would blow the SC-005 LCP budget. `latin-ext` subset is required for Icelandic; `latin` alone drops Þ and Ð. Hero wordmark uses weight 600–700, body display uses 400; a single variable file covers both without two downloads.

**Alternatives considered**:
- **`display: "optional"`**: rejected — on slow connections the hero could render in fallback font and *never* swap to Fraunces, defeating the brand lift.
- **Self-host Fraunces static weights**: rejected — multi-file waterfall; `next/font` already auto-hosts.
- **Web Open Font Format 2 via `@font-face` direct**: rejected — duplicates what `next/font` does better and misses automatic preconnect/preload hints.

**Sources**: [Next.js 16 `next/font` docs, accessed 2026-04-16](https://nextjs.org/docs/app/api-reference/components/font). Fraunces on Google Fonts supports `latin-ext` subset (verified).

## R3: Dialog / Focus-Trap Composition

**Decision**: The new `Dialog` primitive wraps the existing `lib/a11y/useFocusTrap.ts` hook. It owns the backdrop, Escape handler, initial focus, and focus-return-on-close; consumers pass `open`, `onClose`, and `children`. Portal to `document.body` via `createPortal`. Enforce `role="dialog"`, `aria-modal="true"`, and a required `aria-labelledby` prop pointing to the dialog heading.

**Rationale**: The existing `MatchmakerControls` invite flow uses `useFocusTrap` directly, but it is an absolute-positioned dropdown rather than a true dialog — it violates FR-015's requirements (backdrop, Escape, focus return). Consolidating dialog mechanics into one primitive means US4's accessibility assertions run once and all future dialogs (later specs) inherit the behaviour. Co-locating the portal avoids stacking-context bugs with the 24-card directory.

**Alternatives considered**:
- **Adopt Radix UI `Dialog`**: rejected — adds a dependency and contradicts the "no Radix/shadcn" constraint in the plan; our accessibility utilities already cover the contract.
- **Headless UI `Dialog`**: rejected — same dependency concern; Tailwind 4.x + our a11y utilities cover what Headless UI provides here.
- **Ad-hoc dialogs per consumer** (current state): rejected — already demonstrated insufficient (`MatchmakerControls` is not a real dialog). Codifying the primitive removes the recurring cost.

**Sources**: WAI-ARIA Authoring Practices 1.2 — [Dialog (Modal) Pattern, accessed 2026-04-16](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Existing `lib/a11y/useFocusTrap.ts` in-repo reference.

## R4: Reduced-Motion Strategy

**Decision**: Place all lobby keyframes and transitions inside `app/styles/lobby.css`. Mirror `board.css`'s existing pattern: at the bottom of the file, a single `@media (prefers-reduced-motion: reduce)` block resets `animation` and `transition` to `none` on every class introduced above, including the hero word cycle interval. The `LobbyHero` component additionally reads `window.matchMedia("(prefers-reduced-motion: reduce)")` via `useSyncExternalStore` to skip scheduling the `setInterval` that advances the word entirely — no JS loop under reduced motion.

**Rationale**: FR-026 requires *all* keyframe animations and decorative transitions to be suppressed, not just visually dampened. The board's existing pattern is proven and already ships. Skipping the JS interval (not just the CSS animation) under reduced motion prevents needless re-renders and respects SC-008 strictly.

**Alternatives considered**:
- **CSS-only suppression**: rejected — the word cycle is driven by JS state swapping the displayed word; a CSS-only suppression would leave the displayed word rotating silently but with no visible transition, which still fails SC-008 spirit ("state changes remain functionally observable and announced").
- **User setting override**: rejected — constitutional and WCAG mandate the OS-level signal be authoritative.

**Sources**: WCAG 2.1 SC 2.3.3 — [Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html). `app/styles/board.css` existing reduced-motion block.

## R5: Matches-in-Progress Count Delivery

**Decision**: New `GET /api/lobby/stats/matches-in-progress` route that returns `{ matchesInProgress: number }`. Client polls every 10 s from `LobbyStatsStrip`. Service-role Supabase client performs a lightweight `select("id", { count: "exact", head: true })` filtered by `matches.status = 'active'`. Response is typed via new `LobbyMatchesStats` interface exported from `lib/types/match.ts`.

**Rationale**: Spec clarification Q3 locked this as "online count reactive; matches polled every 10 s; no new Realtime channel solely for stats." A new Realtime channel would require a Supabase Realtime publication on the `matches` table (not currently enabled) and carry ongoing broadcast cost disproportionate to a social-proof counter. A 10 s poll matches the existing `/api/lobby/invite` cadence (3 s in `MatchmakerControls`, confirmed less urgent here).

**Alternatives considered**:
- **Embed the count in the existing presence snapshot response** (`/api/lobby/players`): rejected — couples two semantically distinct lobby datasets; presence gets polled faster than 10 s and invalidates the separation for no benefit. Discussed but not chosen in the plan.
- **Server-send-event (SSE) stream for stats**: rejected — adds infrastructure for a single integer counter.
- **Client-side derivation from presence list**: rejected — `lobby_presence` does not carry current match assignments reliably; a dedicated count avoids stale edge cases.

**Sources**: [Supabase `count: 'exact', head: true` pattern, accessed 2026-04-16](https://supabase.com/docs/reference/javascript/count).

## R6: Icelandic Hero Word Set

**Decision**: Curate a rotation set of 8 Icelandic nouns with `ORÐUSTA` first. Each word: ≥4 letters, ≤8 letters, at least one Icelandic-specific character (Þ, Æ, Ð, Ö) except for ORÐUSTA which qualifies via Ð. Store in `lib/lobby/heroWords.ts` as a typed tuple. Rotation cycles in declared order for determinism (useful for screenshot tests), resetting on mount.

**Rationale**: FR-001a requires ORÐUSTA + ≥3 other Icelandic nouns showcasing Þ/Æ/Ð/Ö. Length bounds (4–8 letters) keep the tile count in a range that flips cleanly on both 375 px mobile and 1440 px desktop heroes without reflowing the layout. Deterministic order simplifies Playwright assertion on the hero content.

**Proposed set** (to be finalised during implementation with dictionary-validated spellings):
- `ORÐUSTA` — product Icelandic name
- `ÞOKA` — fog
- `ÆVINTÝR` — adventure
- `BÓKASAFN` — library
- `HESTUR` — horse
- `SÖGUR` — stories
- `ÐUFA` — (placeholder; confirm with wordlist)
- `LJÓÐ` — poem

**Alternatives considered**:
- **Randomise order each mount**: rejected — makes Playwright tests flaky.
- **Draw from the full BÍN dictionary at runtime**: rejected — dictionary is not loaded client-side by design (constitution I: word validation is server-only); the hero is purely presentational and a static curated list is the right trade-off.
- **Allow longer words (e.g., ALFRÆÐIORÐABÓK)**: rejected — tile count overflow on mobile.

**Sources**: Existing Icelandic wordlist in `/data/wordlists/` as validation reference; spelling pass during implementation.

## R7: Tailwind 4.x Token Extension Pattern

**Decision**: Extend `tailwind.config.ts` `theme.extend` with nested color scales: `brand`, `surface`, `text`, `accent`. Use explicit hex values (not CSS variables) because Tailwind 4's token resolution works statically and allows the strongest dead-code elimination. Preserve existing `player.*` and `board.*` scales exactly. Register `fontFamily.display = ["var(--font-fraunces)", "serif"]` alongside the existing sans family.

**Rationale**: Tailwind 4.x supports both hex tokens and CSS variable tokens; for a design system snapshot frozen in this iteration, hex values improve purge accuracy and provide a single source of truth that can later be lifted to variables when a theming feature ships. Keeping `player.*` and `board.*` untouched upholds FR-003.

**Alternatives considered**:
- **CSS variables via `@theme` directive**: rejected for this iteration — useful later if multi-theme support is introduced, but adds complexity without payoff now.
- **Plugin-based token system**: rejected — over-engineering for the scope.

**Sources**: [Tailwind CSS 4 theme customisation, accessed 2026-04-16](https://tailwindcss.com/docs/theme). Existing `tailwind.config.ts` in-repo.

## R8: Lighthouse CI Gate

**Decision**: Add `@lhci/cli` as a dev dependency and a new `.lighthouserc.json` at repo root targeting `/` (lobby). Assertions: `categories:performance >= 0.9`, `largest-contentful-paint < 2000`, `cumulative-layout-shift < 0.05`. Wire into `.github/workflows/ci.yml` as a new job gated by the existing dev-server boot step.

**Rationale**: SC-005 is an explicit measurable gate; without automation it will regress silently on future changes. Lighthouse CI's assertion config is the standard mechanism; the existing CI already boots the app server for Playwright, so reuse that scaffolding.

**Alternatives considered**:
- **Manual Lighthouse audit before release**: rejected — silent drift between audits.
- **Third-party performance monitors (SpeedCurve, Calibre)**: rejected — external service, adds cost and auth setup beyond scope.

**Sources**: [Lighthouse CI assertions docs, accessed 2026-04-16](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md).
