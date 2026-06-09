# Quickstart: Instant Scoring Reveal — local repro

**Branch**: `042-instant-scoring-reveal` | **Date**: 2026-06-09

This guide is for engineers iterating on this feature locally. It assumes a working Wottle dev environment (see `CLAUDE.md` and `AGENTS.md`).

## 0. Prereqs

```bash
nvm use 20
pnpm quickstart        # starts Docker + Supabase, applies migrations, seeds, writes .env.local
pnpm dev               # Next.js on http://localhost:3000
```

When `pnpm dev` is up, the Realtime channel `match:${matchId}` is available; the polling fallback is at `GET /api/match/[matchId]/state` (2 s interval from the client).

## 1. Two-browser session setup

Open two browser windows (Chrome + Chrome Incognito works; the session cookie `wottle-playtest-session` is per-browser-context).

- **Window A**: `http://localhost:3000/` → log in as `alice`
- **Window B**: `http://localhost:3000/` → log in as `bob`

From window A's lobby, challenge `bob`. From window B, accept. Both windows land on `/match/<matchId>`.

## 2. Happy path — first mover sees instant reveal

1. In window A, identify a swap that you know will form a word — easiest is to look at the row that already has 4 consecutive Icelandic letters and find the one that completes the word. (Seed data is deterministic per match; `pnpm supabase:seed` produces the same board each run.)
2. In window A, tap two tiles to submit the swap.
3. **Expected on window A (the submitter):**
    - The swap animates (existing behaviour).
    - Within ≤200 ms, the scored word's tiles highlight in alice's player colour, the score delta pops, and the tiles render as frozen.
4. **Expected on window B (the watcher) — without touching anything:**
    - The opponent's swap animates (existing #210 behaviour).
    - The same scored word highlights, the same tiles freeze in alice's colour, and the opponent's running score in the HUD updates.

If neither happens, check the Next.js terminal for `[InstantScoring]` errors and the structured-log output for `instant-scoring.fired` / `instant-scoring.failed`.

## 3. Auto-deselect rehearsal (FR-004, FR-017, User Story 3)

1. Window B: tap one tile (do NOT tap the second). Confirm the selection ring renders.
2. Window A: submit a swap that scores a word covering window B's selected tile.
3. **Expected on window B:**
    - The selection ring disappears.
    - The tile renders as frozen in alice's colour.
    - A screen reader (use VoiceOver or NVDA) announces: "Opponent claimed your selected tile — pick another."
    - Tapping any unfrozen tile on window B now starts a fresh selection (it is NOT treated as the second tile of the original pair).

## 4. Race window — both submit before fast path fires (FR-007, User Story 4)

Use the existing Playwright dual-session harness to remove human timing:

```bash
pnpm exec playwright test tests/integration/ui/instant-scoring-reveal.spec.ts \
  --grep "both submit simultaneously"
```

What you should observe in the Next.js terminal:

- A `instant-scoring.deferred-to-combined` log event for that round.
- No `instant-scoring.fired` event for the same round.
- The round still resolves correctly with both players' scores in the round summary surface.

## 5. Zero-score first swap (FR-006, User Story 5)

1. In window A, submit a swap between two tiles that you know don't form a word (e.g. two tiles in the middle of random consonant clusters).
2. **Expected on both windows:**
    - The swap animates.
    - **No** highlight, **no** freeze, **no** opponent-score-delta animation.
3. **Expected in the Next.js terminal:**
    - No `instant-scoring.fired` log event (the fast path returned `no-score` silently).
    - No `word_score_entries` rows inserted for the round.

Verify the last point with:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT count(*) FROM word_score_entries WHERE round_id = (
        SELECT id FROM rounds WHERE match_id = '<matchId>' AND round_number = <round>);"
```

Expected: `0`.

## 6. Failure-mode rehearsal (FR-011)

To simulate scoring failure, temporarily edit `lib/match/instantScoring.ts` to `throw new Error("test")` at the top of the function, then submit a move:

1. Both windows should see the round resolve through the *combined* path at round end (i.e. no partial reveal, both scores arrive together).
2. The Next.js terminal should log `instant-scoring.failed` with `reason: "test"` (or whatever you threw).
3. **No `word_score_entries` rows from the fast path** — they were never inserted.
4. **No half-rendered state** on either client.

Revert your edit when done.

## 7. Polling fallback rehearsal (FR-002, SC-001)

To force polling:

1. Set `NEXT_PUBLIC_DISABLE_REALTIME=1` in `.env.local` and restart `pnpm dev`.
2. Both windows now poll `/api/match/[matchId]/state` every ~2 s.
3. Run steps 2.1–2.4 (happy-path test).
4. **Expected:** window B sees the partial reveal within one poll interval (≤2 s) of window A's submission. Selection ring on window B does NOT clear in real time (it only updates on the next poll cycle) — this is acceptable per the polling SLA.

Remove `NEXT_PUBLIC_DISABLE_REALTIME` when done.

## 8. Performance check

Run the round-resolution perf test to confirm no regression in the existing combined-path RTT:

```bash
pnpm perf:round-resolution
```

Then run the new instant-scoring perf test (once it exists post-`/speckit.tasks`):

```bash
pnpm perf:instant-scoring  # to be added; Artillery scenario from tests/perf/instant-scoring.yml
```

**Pass criteria:**

- `perf:round-resolution` p95 ≤ existing baseline (no regression).
- `perf:instant-scoring` p95 < 200 ms for "submit accepted → reveal received on opponent" RTT.

## 9. Manual smoke before opening a PR

Before opening a PR, confirm by inspection:

- [ ] `pnpm test` — full unit + contract suite green.
- [ ] `pnpm test:integration` — server integration suite green.
- [ ] `pnpm exec playwright test --grep "instant.scoring"` — three new specs green.
- [ ] `pnpm lint` — zero warnings.
- [ ] `pnpm typecheck` — green.
- [ ] `pnpm guard:no-service-role` — green (no leak of service-role key into client bundles).
- [ ] All three new structured-log events fire as expected in the dev terminal during a manual run-through.
- [ ] Two-browser smoke walk through sections 2, 3, 5 with VoiceOver enabled to verify the aria-live announcement.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Window B sees the swap animation but no freeze | Fast path errored — check `instant-scoring.failed` in the Next.js terminal | Inspect the error reason; common cause in dev is the dictionary not being loaded yet (cold start <2 s) — wait a beat and retry |
| Window B's selection ring doesn't clear | `BoardGrid` `useEffect` watching `props.frozenTiles` is missing or wrong | Verify the diff: `frozenTiles` reference changed AND the previously-pending tile key is present in the new map |
| Window A sees their score twice (double-pop) | `animatedOpponentMoveKeysRef`-style dedupe key for `partialSummary` is missing | Confirm `MatchClient` uses `${firstMoverId}-${firstSubmissionAt}` as the dedupe key when `lastSummary` arrives for the same round |
| Realtime works in one window but not the other | Browser-specific WebSocket issue; the affected window has already fallen back to polling | Check the `usePolling` state and the connection-mode indicator in the HUD; verify polling shows the partial reveal within 2 s |
| Round summary at end shows wrong totals | Idempotency invariant broken — `word_score_entries` were not deleted before combined-path re-insert | Check `executeScoringPipeline`'s delete step ran; inspect `word_score_entries` for duplicate rows by `(round_id, word, player_id)` |
| `update_frozen_tiles_if_unchanged` RPC missing in local DB | Migrations not applied | `pnpm supabase:migrate && pnpm supabase:verify` |
