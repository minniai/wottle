# Wottle — Field & Ledger implementation review

Reviewed 14 September 2026 (section 6 decided 15 September 2026) against `WOTTLE_DESIGN_PLAN.md`, `WOTTLE_DESIGN_SYSTEM.md`, `DOCS_CONSISTENCY.md` and the figures in `Wottle UX Audit.dc.html`. Codebase: the attached `wottle` repo after spec `044-field-ledger-redesign` (all tasks T001–T101 ticked). Visual companion with a rendered reproduction of the field: `Wottle Implementation Review.dc.html`.

**Verdict.** The rebuild is structurally complete and faithful in architecture: one room, seat-relative colour through one function, seven tokens and two fonts, bars with lanes, bands with chevrons from the reading direction, a ledger that shares ten rows and folds, notices as live-row lines, every room state, profile on the room grid, the old components deleted, docs updated. It was never rendered: the task log marks Playwright, axe and the reference screenshots as "not run locally — no Supabase", and the unit layer is JSDOM. Three paint defects in the field (A1–A3) and an unwired phone ledger (A4) shipped as a result. Estimated effort to reach the design: about five days (section 5).

---

## 1. Step-by-step state (plan §11)

| Step | State | Notes |
| --- | --- | --- |
| P0 engine contracts | Complete | `lib/game-engine/readingDirection.ts` derives `ltr/rtl/ttb/btt` from tile order; `WordScore.direction?` in `lib/types/match.ts:63`; rules doc §2a (clock), §3.1 (one record per run), §3.5a BORÐA + GILT, §12 "What the player sees" written; tests `doubleReading.test.ts`, `wholeRun.bordaGilt.test.ts`; `lib/constants/copy.ts`. |
| P1 tokens / fonts / shell / bars | Complete, with debt | `app/globals.css` seven tokens + 14 %/30 % `color-mix` alphas + `--future-label`; `app/layout.tsx` Zilla Slab 500/600/700 + Red Hat Mono 400/500/600 via `next/font`; no TopBar; `components/room/Room.tsx` + `hooks/useFieldSize.ts` (ResizeObserver, `min(h − 2·60 − 2·12 − 48, 720)`); `PlayerBar.tsx` + `ClockLane.tsx` match §5.3 to the pixel (60/56 px, `1fr auto 1fr`, 12 px square, 17/11/26/40 px, lane 4 → 8 px + 1 Hz blink, searching segment 12 % / 3 s, progressbar ARIA). Debt: legacy aliases (D1), stack centred (B1), 4 px bar inset (B8). |
| P2 ledger | Complete, 3 fixes | `Ledger.tsx`, `lib/room/ledgerRows.ts`, `ledgerTypes.ts`, `notices.ts`, `hooks/useMeasuredLines.ts`: caption strings, seat header with 1 px ink rule, `34px 1fr 1fr` grid with `grid-auto-rows:minmax(0,1fr)`, words 14 px 600 0.04 em in seat colour, total pinned top-right 12 px mono, future labels `#B9B4A6`, live row tint + 3 px rule, hover → bands + per-word points, fold rule (>3 lines → older than last three collapse), territory bar you/free/opp, hint, verdict block above header, notices (rematch, resign 5 s, claim, challenge, first-match), foot `? rules` + actions + `⋯`. Fixes: B2, B3, B4. |
| P3 field | Structurally complete, visually broken | `Field.tsx`, `FieldCell.tsx`, `FieldBands.tsx`, `lib/room/bandGeometry.ts` (20 %/5 % insets, chevron edge per direction, partial-freeze clipping, shared cells), `lib/room/fieldInteraction.ts` (pure reducer), `hooks/useFieldInteraction.ts`, `lib/room/revealSequence.ts` + `hooks/useReveal.ts` (400/120/400/200 ms), `useCountUp`, shake 300 ms, sounds + haptics, arrows/Space/Enter/Esc, `aria-label` with coordinates. Defects A1–A3; gaps C1–C3, B5. |
| P4 room states | Desktop complete | `LobbyRoomController` (landing name-in-bar, warm-up field with local swaps, pricing only signed-in + preview on, `LobbyLedger` tables), `QueueRoomController` (placeholder board landing 100 ms, found countdown, URL `replaceState`), `MatchRoomController` (transport, reveal, disconnect line + claim, rating lines, rematch notice, read-only replay), `app/(room)/layout.tsx` persisting shell, `/match/[id]/summary` redirects. Phone collapse missing (A4). |
| P5 profile / tests / docs | Complete, unverified | `components/profile/ProfilePage.tsx` + `ProfileRatingChart.tsx` on the room grid (14 px square, 28 px name, 48 px rating, hairline chart, record row, best words, recent matches, foot). Unit tests for every pure module and component; Playwright `room-layout`, `room-flow`, `landing`, `matchmaking`, `match-completion`, `reconnect-flow`, `profile-room`; `acceptance-grep.test.ts`; `pnpm docs:check`. `CLAUDE.md`, `README.md`, rules, spec Outcome notes done. Not executed end to end (E1); `ds-bundle` not moved (D3); chart labels stretch (B9). |

---

## 2. Findings

### A. Visible defects (the room does not look like the design)

**A1 — Field ground renders `--rule` grey; cell rules invisible.**
`app/styles/room.css`: `.field { background: var(--rule); gap: 1px }` (≈ l. 209–216); a later `.field__cell { z-index: 0; background: transparent }` (≈ l. 283–286) overrides the earlier `background: var(--paper)`; `.field::before { background: var(--paper); z-index: -1 }` (≈ l. 287–294). `.field` is `position: relative` with `z-index: auto` and therefore no stacking context, so the negative-z `::before` paints in the root stacking context, *beneath* the field's own `--rule` background. Every cell shows `#E6E2D6`; the 1 px gaps are the same colour and disappear. Reproduced in the companion DC, section 02, fixture A. `isolation: isolate` alone is *not* the fix: the pseudo would then cover the gaps too and the rules would vanish into paper.
Fix (as Fig. 2 draws it): `.field { background: var(--paper); gap: 0 }`, delete `.field::before`, and draw the rules on the cells — `border-right: 1px solid var(--rule); border-bottom: 1px solid var(--rule)`, none on `:nth-of-type(10n)` and the last ten. Bands stay under the transparent cells; the rules cross the bands. Browser-mode test: field `backgroundColor` `#FFFDF7`, cell `borderRightColor` `#E6E2D6`, no gap.

**A2 — Letter and numeral size never follow the cell size.**
`room.css` ≈ l. 223 `font-size: calc(var(--cell-size, 48px) * 0.55)` and ≈ l. 242 `calc(var(--cell-size, 48px) * 0.18)`; `--cell-size` is declared nowhere (`Room.tsx` sets only `--field-size`). Letters are 26.4 px at every size: 37 % of a 72 px desktop cell (design 55 %), 73 % of a 36 px phone cell; numerals 8.6 px.
Fix: `.field { --cell-size: calc(var(--field-size) / 10) }`; below 900 px, where the field is width-driven, set `--field-size` from the measured width too (`useFieldSize` already knows it).

**A3 — Chevrons are 0.15 px hairlines.**
`components/room/FieldBands.tsx:47` `strokeWidth={0.15}` with `vectorEffect="non-scaling-stroke"`: non-scaling-stroke measures the width in device pixels. Design §5.2: 1.5 px.
Fix: `strokeWidth={1.5}`.

**A4 — Phone: the whole ledger stacks under the bottom bar; the page scrolls.**
`room.css` ≈ l. 55–70 (`@media (max-width: 900px)`) only switches to one column; `Ledger.tsx` renders every section regardless of width; `LedgerSheet.tsx` is imported only by `tests/unit/components/room/LedgerSheet.spec.tsx`. `tests/integration/ui/room-layout.spec.ts:112–134` asserts only that the live row's bottom is ≤ 844 px, which holds when the ledger is a full column beneath the bars.
Fix: below 900 px the `Ledger` renders caption + live row + territory line + `history ▸`; `LedgerSheet` opens from it with the rounds table, notices and foot. Pass the 56 px bar height into `useFieldSize`. Assert `document.scrollingElement.scrollHeight <= innerHeight` at 390×844.

### B. Implemented, not as specified

| # | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| B1 | Stack centred in its column; gutter to the ledger grows with the window (≈ 168 px at 1440×900 vs 56). DS §4 flush-left. | `room.css` `.room__stack { margin: 0 auto }` ≈ l. 30 | `grid-template-columns: auto var(--ledger-width); justify-content: center` on `.room`, `margin: 0` on the stack. |
| B2 | Live-row tint spans columns 2–3; the round label sits outside on paper. Fig. 2 tints the full row with the 3 px rule at its left edge. | `Ledger.tsx` `<div className="ledger__live-row" style={{ gridColumn: "span 2" }}>` | One element spanning all three columns, label inside. |
| B3 | `picking · T (0)` — value hard-coded. | `MatchRoomController.tsx` `return { kind: "picking", letter, value: 0 }` | `LETTER_SCORING_VALUES_IS[letter]`. |
| B4 | `frozen · <name> R<n>` prints the current round, not the round the word froze in. | `MatchRoomController.tsx` `onNotice` → `frozenNotice(…, match.currentRound)`; `FrozenTile` has no round | Find the accumulated word covering the cell; use its `roundNumber`. |
| B5 | Motion: preview does not exchange in 150 ms (letters swap instantly via `applyLetterSwaps`); `@keyframes pin-fade` and `.player-bar__score--counting` are declared and never applied; found-opponent name has no 200 ms write. | `room.css` ≈ l. 506, 297; `lib/room/displayBoard.ts`; `QueueRoomController.tsx` | FLIP the two letter spans (transform 150 ms); apply `pin-fade` on settle; fade the name in. |
| B6 | Disconnected lane is `border-top: 4px dashed` — browser dash pattern (~12/12), not 6 px/4 px. | `room.css` `.player-bar__lane--disconnected .player-bar__lane-fill` ≈ l. 178 | Inline `<svg><line stroke-dasharray="6 4">` (gradients are banned). |
| B7 | Queue ledger has no live row; `setting the field · n of 100 letters` / `round 1 in 3` print in the plain hint line. Fig. 7 shows a tinted live row. | `QueueRoomController.tsx` `model.hint`; `Ledger.tsx` renders the table (and live row) only for `match`/`final` | Queue variant renders one live-row element above the hint. |
| B8 | Bars inset 4 px; square and total no longer align with the field frame. | `room.css` `.player-bar { padding: 0 4px }` | `padding: 0`. |
| B9 | Profile chart labels stretch: `preserveAspectRatio="none"` on a 600×180 viewBox. | `ProfileRatingChart.tsx` | Measure the container width, or render labels in HTML beside the SVG. |
| B10 | Bare page outside the room: `<div>Match not found</div>`. | `app/(room)/match/[matchId]/page.tsx:38` | Redirect to `/lobby` with a notice `that match does not exist`. |
| B11 | Lobby copy `here now · challenge for a ranked match`; plan says unranked; the invite path has no rated flag (grep `ranked|rated` in `lib/matchmaking/` → nothing), so challenge matches are rated like queue matches. | `lib/constants/copy.ts` `HERE_NOW` | Decided 15 September 2026: unranked (section 6, item 1). |

### C. Specified, not implemented

| # | Requirement | Evidence | Fix |
| --- | --- | --- | --- |
| C1 | Pointer drag A → B (plan §4.3, FR-020). | `fieldInteraction.ts` reduces `drag`; no `onPointerDown/Up` in `Field.tsx` / `FieldCell.tsx` | pointerdown on A, pointerup on B ≠ A → `drag`. |
| C2 | Tap elsewhere cancels (§4.3, FR-017). | `tapOutside` reduced (`fieldInteraction.ts:104`) but never dispatched (`useFieldInteraction.ts` dispatches only `escape`) | Document pointerdown outside `.field` and outside ledger action buttons → `tapOutside`. |
| C3 | `?` opens rules, `M` toggles sound (DS §9, FR-023). | no handler in `components/room/**` | Window keydown in the controllers; ignore while the name input has focus. |
| C4 | Phone ledger sheet. | = A4 | — |
| C5 | Visual acceptance screenshots at 1440×900 / 1280×800 / 390×844 compared with Fig. 2, 5–9 (plan §10). | `specs/044-…/tasks.md` T099/T101 "Not run locally: no Supabase" | Section 5, R6. |

### D. Correct behaviour, dead weight

| # | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| D1 | Legacy token aliases declared: `--paper-2/3, --ink-2/3, --ink-soft, --ochre*, --p1*, --p2*, --good, --warn, --bad, --hair*, --font-fraunces, --font-jetbrains-mono`, and a matching `/* legacy */` block in Tailwind (`ochre`, `p1`, `p2`, `surface`, `text`, `accent`, `display`). Comment says "kept while pre-rebuild components are live"; `CLAUDE.md:9` says none are. The two font aliases pass `acceptance-grep.test.ts` only because `/Fraunces|JetBrains/` is case-sensitive. | `app/globals.css:33–58`; `tailwind.config.ts:31–43, 49` | Delete both blocks; `BANNED` regex with the `i` flag; `tokens.test.ts` asserts exactly seven colour tokens. |
| D2 | Warm Editorial code without room callers: `lib/ui/tokens.ts` (ochre hex scale, "Warm Editorial brand tokens"), `lib/ui/avatarGradient.ts` (gradient avatars). | files present | Delete with their tests. |
| D3 | `ds-bundle/` not moved. `ds-bundle/README.md` says the bundle "has moved to `docs/archive/ds-bundle-warm-editorial/`"; that folder does not exist (`docs/archive/` has five entries) and the full bundle is still at the root. | `ls ds-bundle`, `ls docs/archive` | Move; keep the one-paragraph README at the old path. |
| D4 | `DEFAULT_GAME_CONFIG.timePerRoundMs: 60000` contradicts rules §2a. | `lib/constants/game-config.ts:5` | Remove or rename to the 5:00 match budget. |

### E. Process

**E1 — Nothing renders without a database.** All visual assertions are Playwright specs needing two Supabase sessions; unit tests are JSDOM. A fixture route rendering each room state from static data (non-production only) makes screenshots cheap and would have caught A1–A4 in a minute.

**E2 — The design bundle still says 10:00, preview-by-default and two chevrons.** `specs/044-…/spec.md` "Decisions" records where each is read with the decided value; `checklists/requirements.md:37` notes the bundle was "left as authored". Update `WOTTLE_DESIGN_SYSTEM.md` §5.2 (one chevron per band), §5.3/§8/§9 (5:00, `aria-valuemax=300`), the plan §1.3, §4.3 (preview opt-in), §5, §12, and the audit figures' clock copy.

---

## 3. What matches the design exactly (checked value by value)

- Tokens: `#FFFDF7 #0F1A24 #E6E2D6 #F4F1E8 #5A6572 #147D7A #E4573D`, alphas 14 %/30 % only, `#B9B4A6` only on future labels, `* { border-radius: 0 }`, no shadows/gradients in `app/` or `components/`.
- Type: Zilla Slab 500/600/700, Red Hat Mono 400/500/600, `latin` + `latin-ext`; bar 17/11/26/40 → 15/10/22/30 on phones; ledger words 14 px 600 0.04 em; points 12; verdict 20 px 600; wordmark 16 px 700 lowercase; profile 28/48; mono labels 11 px 0.12 em uppercase; `tabular-nums` on clocks and totals.
- Room: `minmax(0,1fr) 340px` / 56 px ≥ 1100; `260px` / 40 px 900–1100; one column < 900; bars 60/56; bar–field gap 12; field `min(available, 720)` via ResizeObserver; ledger `align-self: stretch`, `height: 100 %`, foot `margin-top: auto`, 1.5 px ink top rule.
- Bars: `1fr auto 1fr`, 16 px gap; 12 px square, 1.5 px dashed outline when empty; clock ink 500 running / muted 400 stopped; lane 4 px → 8 px under 1:00 with 1 Hz colour blink (steps), solid under reduced motion; searching segment 12 % travelling 3 s; `role="progressbar"` with `aria-valuetext="m:ss remaining, running|stopped"`.
- Field: 1.5 px ink frame, 1 px rule gaps, letter 600 uppercase, numeral `top:4%; right:6%` mono 400 muted → seat colour on scored, ink 500 on picked; picked `scale(1.08)` + inset 2 px ink ring; previewed 2 px dotted ink; pinned 2 px dashed seat; shared ink 700; focus 2 px ink at −4 px; shake 300 ms; `aria-label="row 8, column F, T, value 2, frozen by Kári"`.
- Bands: 14 % tint (30 % live), inset 20 % short / 5 % long axis, chevron edge = reading start, arm depth 9 % of a cell, clipped to frozen letters on partial freeze, one SVG under the cells, `pointer-events: none`, hover-dim to 0.4 (≈ 6 % effective).
- Reveal: bands 400 ms from the reading start, 120 ms stagger, word written as its band lands, count-up 400 ms, settle 200 ms; never redrawn after the first-mover partial; 0 ms under reduced motion.
- Ledger: caption strings (`ranked · round n of 10`, `lobby · n here`, `ranked · 10 rounds · 5:00 clocks`, `final · 10 rounds · mm:ss`), seat header `■ Birna · you / ■ Kári`, ten rows sharing the height, fold rule, territory 4 px you/free/opp + counts line, hint line, notices in live-row style (`resign the match? · yes, resign ▸ · no` reverting after 5 s; `Kári asks for a rematch · accept ▸ · decline`), verdict `Kári wins 170–127` / `by 43 points · 10 words to 8 · territory 32–25`, foot `? rules` / `rematch ▸ · new opponent ▸ · lobby` / `⋯` with sound, preview, resign/leave or profile/sign out.
- States: landing input in the bar (`your name`, `no account needed`, `play ▸`), lobby top bar (`No opponent yet`, `ranked · about 0:10 to find one`, `play ranked ▸`), warm-up field with local swaps, queue (`Finding an opponent`, `ranked · 0:07 · cancel ▸`, letters landing 100 ms), found (`round 1 in 3 · 2 · 1`, lane full), final (`1191 → 1203 · +12 · wins`, `rating pending`), disconnect (`reconnecting · 0:42 left`, dashed lane, both clocks held, `… is gone · claim the win ▸`).
- Copy: no exclamation marks in `copy.ts`; sentence case; first-match line adapted to five minutes.

---

## 4. Team decisions since the design (spec 044 "Decisions", rules §2a/§3.1) — not defects

1. Clock budget 5:00 (Q1). Implemented consistently (`MATCH_CLOCK_BUDGET_MS = 300_000`, copy, ARIA max).
2. Instant commit by default; preview opt-in from `⋯` (Q2). Preview priced by the read-only Server Action `previewSwap` — the 55 MB dictionary cannot ship to the client (research R2). Sound.
3. Queue field is a placeholder swapped at match start (Q3).
4. One record per run: FÁR/RÁF scores once, forward reading → one chevron per band (rules §3.1, `doubleReading.test.ts`).
5. 0:00 = timeout pass in remaining rounds; both at 0:00 ends the match; renders `0:00` with an empty lane (rules §2a).

From the plan §12: ranked challenges — decided 15 September 2026, unranked (section 6, item 1; code currently rates everything — B11).

---

## 5. Plan to complete (each step ships alone)

| Step | Work | Acceptance | Est. |
| --- | --- | --- | --- |
| R1 Field paint | A1 paper field + cell-border rules (no gap, no pseudo); A2 `--cell-size`; A3 stroke 1.5; B3 picking value; B4 frozen round; B8 bar padding 0. New `Field.paint.spec.tsx` (Vitest browser mode or Playwright component): field paints paper, cell borders 1 px rule, letter = 0.55 × cell, chevron stroke 1.5. | Matches fixture B in the companion DC. | ½ d |
| R2 Composition | B1 centre the room, not the stack; B2 full-width live row; B7 queue live row; B10 no bare page. | 1440×900: field–ledger gutter 56 px; ledger rule/foot aligned with bars (existing assertion). | ½ d |
| R3 Phone | A4 collapsed ledger + `LedgerSheet` from the live row; 56 px bar height into `useFieldSize`. | 390×844: bar / field / bar / live row, `scrollHeight ≤ innerHeight`, cells ≥ 35 px, axe clean with the sheet open. | 1 d |
| R4 Interaction & motion | C1 drag; C2 tap-outside; C3 `?`/`M`; B5 150 ms exchange, pin fade, 200 ms name write; B6 SVG dashed lane. All 0 ms under reduced motion. | `room-flow.spec`: drag-to-commit, tap-outside cancels; reducer tests already cover the events. | 1 d |
| R5 Debt & documents | D1 aliases + case-insensitive grep; D2 `lib/ui/*`; D3 move `ds-bundle/`; D4 game config; B9 chart labels; E2 update the design bundle to sections 4 and 6; B11 unranked; `--opp-text`; numeral floor. | `tokens.test.ts` asserts eight colours; `pnpm docs:check` green. | ½ d |
| R6 Seen | E1 fixture route `/__room?phase=lobby\|queue\|found\|match\|reveal\|final\|profile` from static data (non-production); Playwright screenshots at 1440×900, 1280×800, 390×844 committed as baselines; one full two-player run against a real database. | Every plan §10 visual line checked by a person against Fig. 2, 5–9; screenshots in the PR. | 1½ d |

Total ≈ 5 days. R1 first (nothing can be judged before the field paints), R6 last (it is the check the others are measured by).

---

## 6. Decisions — given 15 September 2026

The team took the review's recommendation on all three. These are binding for R5 (handoff R6, T030–T032).

1. **Ranked challenges → unranked.** A directory challenge lets a player pick their opponent, which the rating should not reward. Needs a `rated` flag on the invite path (`matches.rated`, invites create `false`, rating skipped), `unranked` captions, and the copy `challenge for an unranked match`. Closes B11.
2. **Coral text below 17 px → one text-only token `--opp-text: #C2402A`** (5.1:1 on paper). Context: the implementer excluded ledger words (14 px) and scored-letter numerals from the axe contrast rule because coral is 3.4:1 on paper and DS §9 allows coral text only at ≥ 17 px. `--opp-text` is used wherever coral is *text* under 17 px — ledger words, scored numerals, the profile's `vs` rows. Letters on the field, lanes, totals and squares stay `--opp`. Amends DS §2 to eight values and removes the axe exclusion.
3. **Numeral scale on phones → `max(9px, 18%)`, hidden below 32 px cells.** The DS's 18 % numeral is 6.5 px in a 36 px cell (fixture B). The letter's `aria-label` still carries the value.
