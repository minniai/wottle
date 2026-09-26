# Spec 078: Letters move once — rules v2 (draft)

## Context

This is a proposal to change Wottle's rules, based on a braindump:

> Letters can only be moved once. A moved letter that does not score is fixed where it lands and turns grey. After that it can be part of a scored word but can never be picked. A fixed letter scores 0 until it is part of a word; then it scores normally and takes the scorer's colour. Players cannot add to or cross their opponent's words. The board is 12×12. There are no penalties.

This document turns that into a complete, testable rule set. It amends `docs/prd_and_requirements/wottle_game_rules.md` (the "rules doc"). **Nothing is implemented by this proposal.** Once approved, it is saved as `specs/078-letters-move-once/spec.md` and goes through the Speckit clarify → plan → tasks flow.

Three decisions were settled with the owner:

1. **An opponent's letter acts as the board edge.** You may not use it in your word. Your word may end against it or run alongside it.
2. **Your own frozen letters score again** when a new word reuses them, as they do today.
3. **Rollout keeps history.** Matches get a `rules_version`, old matches stay reviewable as 10×10 v1 matches, and ratings carry over.

Two things stay the same: ten moves each, and one 5:00 clock that never pauses.

---

## 1. Summary of changes (v1 → v2)

| Area | v1 (today) | v2 (proposed) |
|---|---|---|
| Board | 10×10, 100 tiles | **12×12, 144 tiles** |
| Tile states | free (called "unfrozen" in v1), frozen (owned) | **free**, **fixed** (grey, no owner), **frozen** (owned) |
| What a swap may pick | any two free tiles | any two **free** tiles. Fixed and frozen tiles cannot be picked. |
| After a swap | the letters of scored words freeze, and the other swapped letter stays free | the letters of scored words freeze. **Every swapped letter that did not freeze becomes fixed.** |
| Opponent's letters in your word | allowed; they add to the length bonus but earn no letter points | **not allowed.** A word containing an opponent's letter is never a candidate. |
| Your word next to an opponent's word | the touching run must be one word (cross run or combined run) | an opponent's letter **ends a run like the board edge**. Bands of different seats may touch. |
| Your word next to your own word | the combined run must be a word | unchanged |
| Move with no word | −5 (floored at 0) | **0**. Its cost is the two fixed letters. |
| Unplayed moves at 0:00 | −5 each (floored) | **0** |
| Totals | never below 0, because of the floor | never decrease, because nothing subtracts |
| Tie-break | exclusively owned frozen tiles | more **frozen tiles owned**. Every frozen tile has one owner in v2. |
| Floor on free tiles | ≥ 24 unfrozen tiles | ≥ 24 **free** tiles (neither frozen nor fixed) |
| `both` owner | kept only for old data | impossible in v2 |

---

## 2. The rules (normative text for the rules doc)

### 2.1 Board and tile state (replaces §1)

- A v2 board is a **12×12 grid** (144 tiles). Every cell always holds a letter.
- Each cell is in exactly one of three states:
  - **Free**: it has never been moved and never scored. Only free tiles can be picked.
  - **Fixed**: it was the endpoint of a resolved swap and did not freeze with that move. It has no owner, cannot be picked for the rest of the match, and its letter never changes. It is not a scored letter. It ends no run and extends no run (§2.4). It may become part of a later scored word, by either player.
  - **Frozen**: it is part of a scored word. It has exactly one `owner`, the player who scored it. Frozen is final.
- The allowed transitions are free → fixed, free → frozen and fixed → frozen. Nothing ever returns to free, and nothing leaves frozen.
- A fixed tile records `fixedBy` (seat) and `fixedAtSeq` (the move's `global_seq`). Both are for audit and review only, the same way `scoredAxes` is. Neither ever affects colour or validation.

### 2.2 Moves (amends §2)

- A move is one swap of **two free tiles**. The client never offers a fixed or frozen tile as a pick.
- **Refusal at resolution** gains a reason. A move is refused and not counted when either tile is `frozen`, either tile is `fixed`, or either letter was `moved` since the player saw it. The checks run in that order. Receipt is unchanged: tile state is checked only at resolution.
- **Move once.** After a resolved move, both swap endpoints are either frozen (their letter is in a word this move scored and the free-tile floor allowed the freeze) or fixed. This holds whether the move scored or not.
- A swap of two identical letters changes nothing and still fixes two tiles. Recommendation: refuse it at receipt as `same_letter`, not counted, and never offer it in the client (see open question Q3).

### 2.3 What counts as a scored word (amends §3)

- §3.1–§3.3 (direction, length ≥ 3, dictionary) are unchanged. The longest possible word is now 12 letters.
- §3.4 is unchanged. A candidate passes through a swap coordinate, and fixed letters may be anywhere in it.
- **§3.4a (new) No opponent letters.** A candidate containing a tile frozen by the other player is discarded before cross-validation. This covers crossing their word, extending it, or sharing any letter with it.
- **§3.5a (amended) End to end, per owner.** A new word must not meet a tile **the mover froze** end to end on its own axis. When the combined run with the mover's frozen letters is a word, that longer run is the candidate, as today. A tile frozen by the opponent at either end is treated as the board edge: the word may end against it.
- §3.7 is unchanged: repeated words score.

### 2.4 Per-letter coverage, per owner (amends §4)

The whole rule is unchanged except for the definition of a **run**. A scored run is now a maximal contiguous run of tiles **owned by one player**. Tiles frozen by the other player end the run exactly as the board edge does. Fixed and free tiles are not scored and never belong to a run.

> For every axis *d*, every maximal run *R* of tiles that are **the mover's** frozen tiles ∪ this subset's tiles, and every tile of *R* this event scores: *R* has length 1, or *R* is exactly a word the event scores on *d*, or *R* contains no such word's tiles and is itself a word in at least one reading (a cross run, which scores).

Consequences:

- A new word laid **alongside** an opponent's word (parallel, one row apart) is exempt on the perpendicular axis, because each new letter's run has length 1 in the mover's terms. In v1 this position was often rejected, as in `HAUSL`.
- A new word laid alongside **your own** word must still form valid cross runs, as today.
- Contiguous letters of two different seats may read as a non-word, for example `BORÐA` in teal directly followed by `GILT` in terracotta. This is allowed. The field must make the seat seam unmistakable (§3.2 below).

### 2.5 Scoring (amends §5)

- **§5.1 Letter points.** Every letter of a scored word contributes its value: free, fixed, or the mover's own frozen letters (decision 2). The v1 clause excluding opponent-frozen letters no longer applies, because no scored word contains one.
- **§5.2 Length bonus and §5.3 combo bonus** are unchanged.
- **§5.5 Move delta** is the sum of the word totals plus the combo bonus. A move that scores no word has a delta of 0.
- **§5.6 Miss penalty is withdrawn for v2.** A miss scores 0, and unplayed moves at 0:00 score 0. The 0-floor becomes meaningless because totals never decrease.

### 2.6 After scoring: freeze, then fix (replaces §6)

In one step, in this order:

1. **Freeze** every tile of every scored word, owner = mover. Tiles already frozen by the mover keep their original `scoredAxes` history. Fixed tiles in the word become frozen. Their `fixedBy` is kept for audit.
2. **Fix** each swap endpoint that is not frozen after step 1.
3. **Floor.** The board must keep **≥ 24 free tiles** (`MIN_FREE_TILES`). Step 2 always happens: move-once is absolute. Step 1 freezes free tiles in reading order (row first, then column) and stops before the free count would drop below 24 once step 2 is included. Fixed tiles converting to frozen never touch the free count, so they always freeze. The words still score in full, and `wasPartialFreeze` is set as today. On 144 tiles with at most 40 swap endpoints per match, this should be rare.

### 2.7 End of match (amends §2a)

- The match ends exactly as today: both players have ten moves, or the deadline has passed and the queue has drained. **No penalties are applied at the end.**
- The result: higher total wins. A tie goes to the player who owns more frozen tiles. If still tied, it is a draw.
- `ended_reason` values are unchanged. `incomplete`, `both_incomplete` and `ended_early` settle with no penalty, so the score decides.
- Resigning is still a forfeit. It is not a scoring penalty and is unchanged.

---

## 3. Algorithm changes (amends §7)

`resolveOne` (`lib/match/moveResolver.ts`) becomes:

1. **Refuse** the move if either tile is `frozen`, then if either is `fixed`, then if either letter was `moved`.
2. Apply the swap (`applySwap`). This is unchanged.
3. Scan through the swap coordinates (`scanFromSwapCoordinates`) on a 12×12 board. This is unchanged.
4. **Prune** every candidate containing an opponent-frozen tile (§3.4a). This is new and cheap, and it shrinks the subset enumeration.
5. Cross-validate (`selectOptimalCombination`). `endsAgainstFrozen` and `crossRunWords`/`settleRun` consult **only the mover's frozen tiles** plus the subset. The opponent's tiles are treated like the board edge. This is the only change inside the validator.
6. Score (`scoreBoardWords`). The opponent-exclusion branch is removed. Letter points are summed over every tile.
7. Freeze, then fix, respecting the floor (`freezeTiles` and a new fix step), and return `fixedTiles` along with `frozenTiles`.
8. Delta = word totals + combo, or 0. The call to `missPenaltyFor` is removed for v2.
9. `finish_move` writes the board, the frozen map, **the fixed map**, the total, the count and `word_score_entries` in one transaction.

`matchIntegrity.ts` (spec 049) adds these checks after every resolved move: no fixed letter changed, every endpoint of the swap is fixed or frozen, and invariants I3′, I11 and I12 below hold.

## 4. Invariants (amends §8)

The unchanged invariants carry on. The amended and new ones:

| # | Invariant |
|---|---|
| I2′ | No run of one owner's scored letters has length 2..(min−1). |
| I3′ | Every maximal run of one owner's scored letters of length ≥ 2 that contains a newly frozen tile is exactly a word that owner scored with this move. |
| I4′ | In v2, every frozen tile's owner is `player_a` or `player_b`, never `both`. |
| I5′ | The board always has ≥ 24 free tiles. |
| I6′ | No resolved move targets a frozen or fixed tile, or a letter an earlier sequence exchanged. |
| I7a′ | No new word meets **the mover's** frozen tile end to end on its own axis. |
| I11 | Every tile of a v2 word record is owned by that word's scorer after the move. No word contains an opponent's letter. |
| I12 | After a resolved move, both of its swap endpoints are frozen or fixed. A fixed tile's letter never changes, and a fixed tile only ever becomes frozen. |
| I13 | A player's total never decreases. |

Each invariant gets a named positive and negative test (§9 discipline).

## 5. Worked examples (these become the regression tests)

1. **A swap with no word.** Birna swaps `A` (2,3) ↔ `K` (7,3). No word forms. Delta 0. Both tiles are fixed and grey, and the move counts.
2. **A half-scoring swap.** Birna's swap forms `BÆN` through (2,2) only. `BÆN` freezes in teal. The other endpoint (9,5) becomes fixed.
3. **A fixed letter scored later.** Kári forms `RÓS` through the grey `R` at (7,3). `R` turns terracotta and scores its full value for Kári, even though Birna moved it.
4. **Crossing the opponent is closed.** Birna owns frozen `GILDA`. Kári's swap would form vertical `PATI` through Birna's `I`. `PATI` is discarded (§3.4a). `PAT` just above the `I` meets an opponent letter end to end, which counts as the edge, so **`PAT` scores** (with `TAP` if it is a word). Compare v1, where `PATI` was the candidate.
5. **Running alongside the opponent.** Kári forms `SKÓ` in the row directly beneath Birna's `GILDA`. Each vertical run holds one Kári letter, so there is no constraint and `SKÓ` scores. (In v1, `S` under `I` would have needed `IS` to be a word.)
6. **Extending your own word.** Birna owns `BORÐA`. She forms `GILT` end to end with it. `BORÐAGILT` is the candidate. If it is not a word, `GILT` is rejected, as today.
7. **Touching end to end across seats.** Kári owns `BORÐA`. Birna forms `GILT` directly after it. `GILT` scores. The field shows a terracotta band meeting a teal band at a visible seam.
8. **The floor.** With 26 free tiles left, a move whose word would freeze 4 free tiles and whose other endpoint fixes 1 freezes only 1 free tile, so 26 − 1 − 1 = 24. The word scores in full, and `wasPartialFreeze` is set.
9. **No penalties.** Kári plays 7 of 10 before 0:00. His total is unchanged at settlement. The ledger rows read `not played` with no number.

---

## 6. What the player sees (amends §12 and the design system)

- **The fixed letter** is a letter state drawn in `--muted` on paper, with no band and no chevron. It is not pickable (`aria-disabled`). Its accessible name ends `, fixed`. Tapping it shakes it 300ms in `--muted`, and live row line 2 reads `fixed · moved once · pick another` (2s; Icelandic needs a native read). When a word takes it, it turns into the scorer's colour inside the band. The palette needs no new colour.
- **`--err` crimson is retired.** Nothing is ever lost, so `PointsLost` and `.points-lost` go, and the palette drops from nine tokens to eight. The missed beat reads `move 4 · no word` over `2 letters fixed · move 5 opens`. The ledger miss cell reads `no word`. Unplayed rows read `not played`. The under-1:00 stakes line (`3 moves left · −15 if unplayed`, `nothing to lose`) is removed from line 2's precedence.
- **Bands of different seats may touch end to end.** The design system rule "bands of the same seat never touch end to end" stays. The two seat colours plus the square band ends must read as a seam, and a visual fixture pins this (`seat-seam`).
- **Territory** becomes `you · free · fixed · opponent` (four counts under the bar), because fixed tiles are neither free nor owned.
- **Review** has no closing penalty step for v2 matches. v1 matches keep theirs, because review reads stored rows and never re-resolves.
- **The result** detail lines keep their shapes. `Kári played 8 of 10 · by 12 points` now means only that he played fewer moves.
- **The 12×12 field.** The cell is `min(floor((available − 3) / 12), cap)`: about 59px (a 711px field) at 1440×900, and about 27px on a 360px phone. That puts it below the 44×44 touch target. It needs a design decision (Q2).
- **The one-grid ledger.** Ten move rows no longer line up with 12 board rows. The proposal is ten move rows at cell height, with the totals and territory rows taking the last two board rows.
- **The `/rules` page and copy.** Rewrite the move, scoring and penalty sections in `components/rules/content/{en,is}.tsx` and `lib/i18n/copy/{en,is}.ts`. New Icelandic strings are marked `// native-read`.

## 7. Data and rollout

- **Migration (additive):**
  - `matches.rules_version smallint not null default 1`. New matches are created with 2 by `create_match_between`.
  - `matches.fixed_tiles jsonb not null default '{}'`: `{ "x,y": { fixedBy, fixedAtSeq } }`.
  - `match_moves.fixed_before` and `fixed_after`, mirroring `frozen_before` and `frozen_after`.
  - `finish_move` and `claim_next_move` carry the fixed map.
  - Board size is derived from `rules_version` (1 → 10, 2 → 12). The move row's `rejected` reason gains `fixed`, and `same_letter` if Q3 is accepted.
- **Types.** `FixedTileMap`, `TileState = "free" | "fixed" | "frozen"`, and `MatchState.fixedTiles` / `rulesVersion` in `lib/types/match.ts`, with Zod schemas.
- **Word lists.** `pnpm wordlists:build` writes `word_list_3_12_<lang>.txt` for is and en. `loadDictionary` already throws when a list is missing.
- **Board generation.** `boardGenerator` fills 144 cells, and the letter weights in `languagePack.ts` are checked for density.
- **Rollout without a dual resolver.** Stop creating matches (a flag checked in `create_match_between`), let live matches drain (≤ 5:00 plus the table), migrate, deploy, and reopen. Review renders v1 matches from stored rows at 10×10. Ratings carry over, but the change is noted on profiles as the date the rules changed.
- **Perf.** Re-run `perf:move-resolve` (runs up to 12 long; the opponent-letter prune offsets the larger scan) and `perf:move-receipt`.

## 8. Code touch points (for the plan phase)

- **Rules:**
  - `lib/constants/board.ts` (`BOARD_SIZE` per rules version) and `lib/constants/game-config.ts`;
  - `lib/game-engine/crossValidator.ts` (owner-scoped runs), `frozenTiles.ts` (freeze, then fix, then the floor), `scorer.ts` / `wordEngine.ts` (drop opponent exclusion), `boardGenerator.ts`;
  - `lib/match/moveResolver.ts` (refusal and prune), `matchSettlement.ts` / `app/actions/match/completeMatch.ts` (no unplayed penalty), `resultCalculator.ts`, `matchIntegrity.ts`;
  - delete `lib/scoring/missPenalty.ts` for v2.
- **Database:** a new migration and the three move functions.
- **Room:**
  - `lib/room/fieldInteraction.ts` (reject a fixed pick), `moveState.ts` / `liveLinesFor` (no stakes beat, new miss and fixed lines), `ledgerRows.ts`, `displayBoard.ts`;
  - `components/room/Field*`, `PointsLost.tsx` (remove), `useFieldSize`, `app/styles/room.css`, fixtures and visual baselines.
- **Docs:** the rules doc (§1–§8, §10 row, §12), design system §5 and §8, `/rules`, CLAUDE.md, PRD.

## 9. Risks and open questions

- **Q1 — Board size rationale.** The braindump says 12×12 gives "fewer options to create words". A larger board gives *more* swap and word options. What reduces options in v2 is move-once and the opponent block. A sounder reason for 12×12 is **capacity**: up to 40 letters get fixed per match, and opponent words close off lines, so the field needs room. Confirm the intent, and whether 10 moves / 5:00 still fit 144 tiles.
- **Q2 — Phone cell size.** About 27px cells at 360px wide. Accept this, or change the phone layout (for example, zoom or pan)?
- **Q3 — Identical-letter swap.** Should it be refused as `same_letter`? The recommendation is yes: otherwise it is a no-op that fixes tiles.
- **New tactic: fixing letters.** With no penalty, a player can deliberately swap letters beside the opponent's promising areas to fix them. That is a blocking weapon, which is probably intended but should be watched in playtests.
- **Stalling.** A leader loses nothing by not moving. Moves never cost points, so stalling is not clearly dominant, but watch for it in playtests.
- **Seat seams.** Touching bands of two colours can read as one non-word to colour-blind players. The seam treatment needs an accessibility check (teal and terracotta already pass WCAG contrast; the square ends plus chevrons carry the distinction).

## 10. Verification (for the eventual implementation)

- Unit tests for each worked example in §5 and each invariant in §4, with positive and negative cases, run through `resolveOne` via `tests/helpers/scoreMoves.ts`.
- `tests/integration/moveScoring.test.ts` on the 12×12 dictionary.
- `tests/integration/db` settlement: no penalties, and the tie-break on frozen tiles.
- A v1 match rendered in review after the migration, compared against its baseline.
- `pnpm test:visual` with new fixtures `fixed-letter`, `seat-seam`, `miss-v2` and `phone-match-360` at 12×12.
- `pnpm perf:move-resolve` p95 under 50ms.

## Next step on approval

Write this document to `specs/078-letters-move-once/spec.md`. No code, migration or doc edits come until the Speckit plan phase.
