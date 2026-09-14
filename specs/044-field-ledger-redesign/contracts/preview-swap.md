# Contract: `previewSwap` Server Action

**File**: `app/actions/match/previewSwap.ts` · HTTP wrapper: `app/api/match/preview/route.ts` (see `preview-swap.openapi.yaml`)

```ts
"use server";
export async function previewSwap(input: PreviewSwapInput): Promise<PreviewSwapResult>;
```

| Aspect | Contract |
|---|---|
| Input validation | Zod `previewSwapInputSchema` (discriminated union on `kind`). Coordinates 0–9. Warm-up board exactly 10×10 uppercase Icelandic letters. `from ≠ to`. |
| Auth | Both variants require a session (`unauthenticated` otherwise). `kind: "match"` additionally requires the session to be a participant (`forbidden`). No anonymous access (spec Clarifications Q5). |
| Rate limit | `assertWithinRateLimit({ scope: "match:preview-swap" })` — 60/min keyed by player id. `rate_limited` on breach. |
| Board source | match: `loadMatchState` board + `frozenTiles`; rejects if `from`/`to` is frozen (`rejected`). warm-up: the submitted board, empty frozen map. |
| Computation | `applySwap` → `scanFromSwapCoordinates` → `selectOptimalCombination` → `scoreBoardWords` (letters + length bonus). No `freezeTiles`, no combo bonus, no duplicate suppression. |
| Output | `{ status: "ok", words: [{ word, points, direction }], total }`; `total = Σ points`. Empty `words` and `total: 0` when nothing forms. |
| Side effects | None. MUST NOT write `word_score_entries`, `matches`, `rounds`, timers, or broadcast. |
| Performance | Server compute < 50 ms (dictionary pre-warmed); RTT < 200 ms p95. Structured log `preview-swap.priced { matchId?, durationMs, wordCount }`. |
| Client usage | Called once on entering `preview`; never polled. Hint shows `tap again to play` until the result lands or on any non-`ok` status. |
