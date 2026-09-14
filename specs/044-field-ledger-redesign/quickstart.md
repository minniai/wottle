# Quickstart: Field & Ledger Redesign

**Feature**: `044-field-ledger-redesign` · How to run, verify and accept each step locally.

## Prerequisites

```bash
pnpm quickstart          # Supabase (Docker), migrations, seed, .env.local — unchanged; no new migrations
pnpm dev                 # http://localhost:3000
```

Node 22 (`.nvmrc`), pnpm 11.7 (`packageManager`). No new environment variables. The new rate-limit scope `match:preview-swap` can be disabled locally like the others: `RATE_LIMIT_DISABLED_SCOPES=match:preview-swap`.

## Step-by-step verification (mirrors design plan §11)

| Step | Run | Expect |
|---|---|---|
| **P0** contracts | `pnpm test:unit -- tests/unit/lib/game-engine/readingDirection.test.ts tests/unit/lib/game-engine/doubleReading.test.ts tests/unit/lib/game-engine/wholeRun.bordaGilt.test.ts tests/unit/lib/match/wordScoreRow.test.ts` · `pnpm test:integration -- tests/integration/match/previewSwap.spec.ts` | `FÁR/RÁF` → one record, `ltr`; reverse-only word → `rtl`; `BORÐA + GILT` rejected; `previewSwap` prices without writing rows; `MatchState.disconnectedAt` present when a player is disconnected |
| **P1** tokens + bars | `pnpm test:unit -- tests/unit/styles tests/unit/components/room/PlayerBar.spec.tsx` · `pnpm exec playwright test tests/integration/ui/room-layout.spec.ts` | Exactly seven colour tokens declared; fonts `--font-board`/`--font-mono`; both bars render with lanes (`role=progressbar`, max 300); no `topbar` test id anywhere |
| **P2** ledger | `pnpm test:unit -- tests/unit/lib/room/ledgerRows.spec.ts tests/unit/components/room/Ledger.spec.tsx` | Ten rows share height; live row text `picking · T (2)` → `played ●`; fold rule collapses rows > 3 lines; notices render as lines, never dialogs |
| **P3** field | `pnpm test:unit -- tests/unit/lib/room/fieldInteraction.spec.ts tests/unit/lib/room/bandGeometry.spec.ts tests/unit/lib/room/revealSequence.spec.ts tests/unit/components/room/Field.spec.tsx` · `pnpm exec playwright test tests/integration/ui/room-flow.spec.ts` | Second tap commits by default; with preview on, second tap previews and third commits; Esc reverses; opponent pin clears a pick; chevron edge per direction; one chevron per band (one record per run) |
| **P4** room states | `pnpm exec playwright test tests/integration/ui/room-flow.spec.ts` | Landing name entry converts the bar without navigation; queue letters land; found writes the opponent in; final shows the verdict and keeps the field; the `field` element identity is stable across the whole flow |
| **P5** profile + acceptance | `pnpm test:unit -- tests/unit/styles/acceptance-grep.test.ts` · `pnpm exec playwright test tests/integration/ui/room-layout.spec.ts tests/integration/ui/profile-room.spec.ts` · `pnpm lint && pnpm typecheck` | Grep list returns nothing under `app/` and `components/`; axe clean in every room state; no scroll at 1440×900, field ≥ 560px at 1280×800, phone 390×844 fits |

Each step ends with the two-player Playwright flow green and two screenshots (1440×900, 390×844) attached to the PR and compared with the audit figures.

## Manual smoke (two browsers)

1. Open `http://localhost:3000` in two private windows. Each shows the lobby room: empty top bar, warm-up field, name input in the bottom bar.
2. In window A pick two letters on the warm-up field — the swap commits locally, nothing is scored; turn on preview in the `⋯` menu, pick two letters — the hint line prices the word.
3. Enter names in both windows and press `play ▸`; the bottom bar converts in place (URL stays `/`, then `/lobby` via `replace`).
4. Press `play ranked ▸` in both. Top bar reads `Finding an opponent`; letters land; then the opponent's name writes in and `round 1 in 3 · 2 · 1` counts.
5. Play a round: A commits; B sees A's letters pinned in coral at once. Both commit; bands draw, the live row fills, totals count up, row 2 opens.
6. Tap a frozen letter — it shakes in its own colour and the live row reads `frozen · <name> R1 · pick another`.
7. Close window B's tab — window A's top bar sub-line counts `reconnecting · 1:30 left`, lane dashed; after 90 s the ledger offers `claim the win ▸`.
8. Finish or resign (`⋯ → resign` → live-row confirmation). The verdict appears in the ledger; the field stays; `rematch ▸` shows the request as a live-row line in the other window.

**Walkthrough status (T105, 2026-09-14):** not executed locally in this session (no Supabase). The same
path is automated end to end in `tests/integration/ui/{landing,lobby-presence,room-flow,matchmaking,
sensoryFeedback,reconnect-flow,match-completion,profile-room,room-layout}.spec.ts`, which CI runs; do the
two-browser pass by hand once on the review deployment and tick this line.

## Performance checks

```bash
pnpm perf:round-resolution    # unchanged budget <200 ms p95
pnpm perf:instant-scoring     # unchanged
pnpm perf:preview-swap        # tests/perf/preview-swap.yml asserts <200 ms p95 at 20 rps
```

**Results (T101).** Not run locally on 2026-09-14 — the local Supabase stack was not running and the
Artillery scenarios need it plus a built server. The CI `perf-gate` job runs `round-resolution` and,
since this feature, `preview-swap` on every push (`.github/workflows/ci.yml`); read the numbers from
its `perf-artifacts` upload (`artillery-round-resolution.json`, `artillery-preview-swap.json`).
`instant-scoring` is not gated in CI; run it before release. The server-side preview scan is asserted
<50 ms in `tests/unit/app/actions/previewSwap.spec.ts`.

## Acceptance greps (run at the end of each step, scoped to converted folders)

```bash
pnpm test:unit -- tests/unit/styles/acceptance-grep.test.ts   # radii, shadows, gradients, third hues, retired fonts
pnpm docs:check                                              # DOCS_CONSISTENCY.md §10 phrase list over the living docs
grep -rnE 'hud-card|round-pip-bar|your-move-card|scored-words-card|tiles-claimed-card|move-lock-banner|round-announce|match-ring|post-game-scoreboard-card|rematch-banner' app components tests
```

Both must print nothing at the end of P5.
