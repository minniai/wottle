# Phase 0 research — Field & Ledger completion

Every finding below was re-confirmed against the code on branch `045-field-ledger-completion` (forked from `044-field-ledger-ci-fixes`), not taken on the review's word. Two of the handoff's own prescriptions turn out to be wrong against the real DOM; they are corrected here before any task is written.

---

## 1. The cell-rule selectors in the handoff do not match the DOM

**Decision**: draw the rules as `border-right` / `border-bottom` on every cell as the handoff says, but suppress the last column and row with **`.field__cell:last-child`** (within its row) and **`.field__row:last-child .field__cell`** — *not* with the handoff's `:nth-of-type(10n)` and `:nth-last-of-type(-n + 10)`.

**Rationale**: `components/room/Field.tsx` wraps each row in `<div role="row" className="field__row">` and `room.css` gives `.field__row { display: contents }`. `display: contents` removes the wrapper from the *layout* tree, so the CSS grid is intact — but it does **not** remove it from the DOM tree, and `:nth-of-type` / `:nth-last-of-type` count among siblings of the same parent element. Each `.field__row` has exactly ten children, so:

- `:nth-of-type(10n)` happens to be correct — it matches the tenth cell of every row, which is the last column.
- `:nth-last-of-type(-n + 10)` matches **all ten cells of every row**, because every cell is among the last ten children of its own row. Applied as written it would strip the bottom rule from all one hundred cells and the field would have no horizontal rules at all.

The row wrapper exists for a reason the review does not mention: the comment in `Field.tsx` records that `role="grid" → role="row" → gridcell` is the tree axe requires. It must not be removed to make the handoff's selector correct.

**Alternatives considered**: (a) drop the row wrappers and use flat `nth-of-type` — rejected, it breaks the accessibility tree that spec 044 built deliberately; (b) `:not(:last-child)` positive form — equivalent, chosen form is the one that reads as "no rule on the outer edge"; (c) keep a 1px `gap` and paint the grid ground — rejected as finding A1, because the rules must cross the bands and a gap shows the ground *through* the band instead.

**Test**: `room-css.test.ts` asserts both suppression selectors by name; the Playwright field check asserts a computed `borderBottomWidth` of `0px` on a cell in row 10 and `1px` on a cell in row 9.

---

## 2. `--cell-size` must be true, which means `--field-size` must be true

**Decision**: declare `--cell-size: calc(var(--field-size) / 10)` on `.field`, and fix `useFieldSize` so `--field-size` equals the field's actual rendered width at every breakpoint: subtract the room's real horizontal padding (read from `getComputedStyle`), take a 56px bar height when `(max-width: 900px)` matches, and keep `.room__field-slot { width: var(--field-size) }` below 900px instead of the current `width: 100%`.

**Rationale**: today `computeFieldSize(width, height, barHeight)` is called with `el.clientWidth` and `el.clientHeight` of `.room`. `clientWidth` **includes** padding, and `.room` has `padding: 24px var(--room-gutter)` — 16px each side on phones, 56px on desktop. At 390×844 the measured width is 390 while the field's real width is 358, and below 900px `.room__field-slot { width: 100% }` overrides the variable entirely. So `--cell-size` would be 39px where the cell is 35.8px: the numeral floor and the 32px hide threshold would both fire at the wrong moment, and letters would overflow their cells. The bar height is also wrong on phones — the media query sets `--bar-height: 56px` in CSS while the hook keeps its 60px default, over-reserving 8px of field.

**Alternatives considered**: (a) measure the field slot itself with a second ResizeObserver — rejected as a feedback loop, since the slot's width is set *from* the value being measured; (b) `--cell-size: 10%` of the field and `font-size` in `cqw` container units — attractive, but container queries would be the only place in the sheet using them and the static stylesheet test cannot resolve them; (c) keep the 48px fallback as a safety net — rejected, a fallback that silently produces the wrong size is exactly how finding A2 survived review.

**Test**: `computeFieldSize(390, 844, { barHeight: 56, paddingX: 32 })` → 358, as a pure-function unit test; Playwright asserts the rendered letter `font-size` is 0.55 × the measured cell width at 1440×900 and at 390×844.

---

## 3. The ledger sheet is currently an overlay, which the design forbids

**Decision**: re-implement `.ledger-sheet` as an in-flow block — `flex: 1; min-height: 0; overflow-y: auto` inside a column-flex `.room__ledger` — and delete its `position: fixed; left/right/bottom; max-height: 70dvh; z-index: 3`.

**Rationale**: the review reports `LedgerSheet` as merely *unwired* (A4/C4). It is worse than that: as written it is a fixed-position panel pinned to the bottom of the viewport with `z-index: 3`, so wiring it up as-is would put a panel over the field and the bottom bar — a direct breach of the design's central rule and of `CLAUDE.md`'s "Nothing is ever positioned over the field". The handoff's phone section already specifies the in-flow geometry; this note records that the change is a rewrite of the existing rule, not an addition, and that the existing `LedgerSheet.spec.tsx` must gain a negative assertion (`no position: fixed`) so it can never regress.

**Alternatives considered**: a `<dialog>` element or a bottom sheet with a backdrop — both rejected for the same reason; the design has no modal surface anywhere.

---

## 4. Where `rated` has to be set, and where it has to be inherited

**Decision**: add `rated boolean not null default true` to `matches`; carry an optional `rated` on `MatchBootstrapInput` so `bootstrapMatchRecord` writes it; set `rated: false` in **`respondToInvite`** (`lib/matchmaking/inviteService.ts`, the accept branch); leave **`startAutoQueue`** on the default; and make both rematch paths **inherit** the source match's value.

**Rationale**: `bootstrapMatchRecord` in `lib/matchmaking/service.ts` is the single creation point, with four callers — `respondToInvite` (the directory challenge), `startAutoQueue` (the ranked queue), `requestRematch` and `respondToRematch`. Only the first is a challenge. The rematch paths are the trap: a rematch of an unranked challenge is still a self-chosen opponent, so it must stay unranked; both already read the source match to copy `rematch_of`, so `rated` rides along at no cost. The rating step has exactly one call site — `persistRatingChanges` at `app/actions/match/completeMatch.ts:309` — so "skip the rating" is one guard, and the Elo calculation above it can be skipped whole.

A default of `true` means every existing row and every queue match keeps today's behaviour, so the migration is additive and needs no backfill.

**Alternatives considered**: deriving the fact at completion time by looking for a `match_invitations` row with this `match_id` — rejected, it couples rating to matchmaking storage and gives the wrong answer for a rematch of a challenge, whose new match has no invitation row.

**Note for the tasks**: this decision **reverses spec 044's clarification of 2026-09-14** ("All matches stay rated as today… no `unranked` label anywhere"). Spec 044's `spec.md` must gain a pointer to spec 045 rather than be silently contradicted.

---

## 5. `--opp-text` belongs on `SeatColors`, not in a second lookup

**Decision**: add `text: string` to the existing `SeatColors` interface in `lib/constants/seatColors.ts`, returning `var(--you)` for the viewer seat and `var(--opp-text)` for the opponent seat.

**Rationale**: `getSeatColors(seat)` is already the one place colour is resolved, and `CLAUDE.md` makes that a rule. Teal is 4.9:1 on paper and needs no text variant, so the asymmetry lives inside the function and no caller has to know about it. The three consumers — `.ledger__word`, the scored-cell numeral, the profile's `vs` rows — then read `colors.text` exactly as they read `colors.ink` today.

`tokens.test.ts` needs a real change, not just a new entry: its final test asserts that every `:root` declaration outside the allow-list *aliases a token rather than declaring a colour*. `--opp-text: #C2402A` is a raw hex, so it must join the `SEVEN` map (making it eight) rather than `DERIVED`.

**Alternatives considered**: (a) a `color-mix` darkening of `--opp` — rejected, the review fixed the exact value at `#C2402A` for its measured 5.1:1 and a mix would drift; (b) a separate `getTextColor(seat)` — rejected as a second source of truth for colour.

---

## 6. The visual suite: one Playwright project per viewport, not a viewport loop

**Decision**: add three Playwright projects — `visual-1440x900`, `visual-1280x800`, `visual-390x844` — each with `testMatch: /room-fixtures\.spec\.ts/`, its own `viewport`, and `expect.toHaveScreenshot` defaults (`maxDiffPixelRatio: 0.002`, `animations: "disabled"`) set once in `TestConfig.expect`. The spec then loops only over the nine phases. `pnpm test:visual` runs the three projects; the CI `visual` job builds, starts the app with `ROOM_FIXTURES=1` and runs them with **no Supabase services**.

**Rationale** (Context7, `/microsoft/playwright`): `toHaveScreenshot` works only under the Playwright test runner and resolves its baseline path from the project name, the platform and the snapshot name — so a per-viewport project gives 27 unambiguous baseline files without hand-building names, and a failure reports which viewport broke. Two further facts from the same source shape the spec:

- Playwright's screenshotter already awaits `document.fonts.ready` before every screenshot (`packages/playwright-core/src/server/screenshotter.ts`), so the handoff's explicit font wait in T004 is redundant; waiting for the field's hundred cells is still required, because that is application state, not font state.
- `toHaveScreenshot` waits for **two consecutive identical screenshots** before comparing, which absorbs the room's own entry motion without a timeout.

Baselines are **not** committed until R7 (they would enshrine defects A1–A4); until then the spec runs locally with `--update-snapshots` and the CI job is `continue-on-error: true` and uploads the images as artifacts. R7 removes both.

**Alternatives considered**: (a) Vitest browser mode for the field's computed styles, as the review's R1 suggested — rejected, it would add a second browser test runner to the repository for assertions that either (i) the static `room-css.test.ts` pattern already covers cheaply, or (ii) Playwright covers better on a real layout; (b) one project looping `page.setViewportSize` — rejected, all three viewports would collide on one baseline name unless the name is hand-built, and a resize mid-test can race the ResizeObserver that sizes the field.

**Provenance**: Context7 `/microsoft/playwright` — `docs/src/api/class-pageassertions.md`, `docs/src/api/class-locatorassertions.md`, `packages/playwright-core/src/server/screenshotter.ts`, `docs/src/release-notes-js.md` (v1.20, `maxDiffPixelRatio`). Fetched 2026-09-15.

---

## 7. `docs:check` deliberately excludes the design bundles, so FR-040 needs a second pass

**Decision**: leave `scripts/docs/consistency-grep.sh`'s existing scope alone and add a **second, separate phrase list scoped to the current bundle only** — `docs/design_documentation/260914-wottle-new-design/**/*.md` — matching `10:00`, `ten-minute`, `two chevrons` and `preview by default`.

**Rationale**: the script's own comment states that `docs/design_documentation/` is excluded because "design bundles are inputs, not living docs (the Field & Ledger bundle defines this very list)". That reasoning holds for the retired bundles under `docs/design_documentation/2604*`, which legitimately contain `ochre` and `Fraunces` and must keep containing them. It does **not** hold for the current bundle, which is binding on implementers and is the document E2 says is now wrong. Scoping the new list to the one current folder keeps the retired bundles quiet and makes the live bundle's drift a CI failure. <!-- retired-name -->

This also settles the open "docs:check scope" question carried over from spec 044.

**Alternatives considered**: removing the whole `docs/design_documentation` exclusion — rejected, it would fail instantly on the archived bundles for phrases they are supposed to contain.

---

## 8. Two more things confirmed by reading, worth pinning as tests

**The case-sensitivity hole is real and is in two files, not one.** `acceptance-grep.test.ts` compiles `BANNED = /…Fraunces|\bInter\b|JetBrains/` with no `i` flag, and `tokens.test.ts` separately runs `expect(css).not.toContain("Fraunces")`. `app/globals.css` declares `--font-fraunces` and `--font-jetbrains-mono` in lower case, so both checks pass over the very tokens they exist to forbid. Both files need the fix, and the new `BANNED` must also carry `--ochre|--p1-|--p2-|--good|--warn|--bad|--hair|font-fraunces|jetbrains`. <!-- retired-name -->

**The frozen-round notice has the data it needs one hook away.** `MatchRoomController.tsx:96` calls `frozenNotice(name, match.currentRound)` because `FrozenTile` carries no round — but `useAccumulatedRounds` is already mounted in the same component and yields `AccumulatedWord[]` with `roundNumber` and `coordinates`. Resolving the round is a lookup over words already in memory, not a new query. Where two scored words cover the same cell, take the **earliest** `roundNumber`: that is when the letter actually froze.

---

## Out-of-scope confirmations

Re-read and left untouched, per the review's section 3 and the spec's Out of Scope: `lib/room/fieldInteraction.ts` (the reducer already accepts `drag` and `tapOutside` — only the dispatch is missing), `lib/room/revealSequence.ts`, `lib/room/bandGeometry.ts`, `lib/room/notices.ts`, `ClockLane`'s running/low/searching states, the disconnect and claim path, rematch negotiation, read-only replay, `LobbyLedger`, and `lib/constants/copy.ts` beyond the two strings this feature changes.

---

## 9. `docs:check` cannot survive a spec that says "delete `--p1`" <!-- retired-name -->

**Discovered by running the gate on this branch**: `pnpm docs:check` fails on this feature's own `spec.md`, `tasks.md` and `research.md`, because the grep matches the literal strings `ochre`, `--p1`, `--p2` and `Fraunces` wherever they appear in an active spec folder — including in sentences whose whole purpose is *"delete this token"*. <!-- retired-name -->

This is not a documentation error. It is a hole in the guard: it cannot distinguish a document that **uses** a retired name to describe the product from one that **names** it in order to remove it. Spec 045 is the first spec whose job is the removal itself, so it is the first to hit it — and T029 and T033 cannot be written at all without naming the tokens they delete.

**Decision — implemented 2026-09-15, ahead of R1**: a line-level exemption in `scripts/docs/consistency-grep.sh`. A line carrying the marker `<!-- retired-name -->` is not a hit; the marker exempts its own line only, and the phrase list is unchanged. The scan loop was factored into one `report_hits file phrase mode` helper that filters the marker out of the hits before reporting, so the fixed-phrase and whole-word passes behave identically.

Applied to the five lines in this feature's own documents that name a token in order to delete it (`tasks.md` T029; `research.md` §7, §8 and this section's heading and first line). Pinned by `tests/unit/scripts/docsConsistencyGrep.test.ts`, which writes a scratch document under `docs/`, runs the real script and asserts: a plain use still fails, a marked line passes, the marker does not exempt the rest of the file, it works for the whole-word phrase `Inter` too, and the repository as it stands is clean. <!-- retired-name -->

It had to land before anything else, because every step from R1 on ends with `pnpm docs:check` green and the branch was already red.

**Alternatives considered**: (a) exclude the active spec folder from the grep — rejected, it would blind the guard to exactly the documents most likely to drift; (b) spell the tokens obliquely ("the p-one alias") — rejected, a task list that cannot name the file it edits is not a task list; (c) exclude only `tasks.md` — rejected, `spec.md` and `research.md` have the same legitimate need.

**Test**: a case in `tests/unit/docs/` (or the script's own self-check) asserting that a marked line is exempt and an unmarked one still fails.
