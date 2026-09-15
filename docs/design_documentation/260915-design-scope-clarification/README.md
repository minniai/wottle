# Handoff: Field & Ledger — completion (spec 045)

For Claude Code, working in the `wottle` repository. Prepared 15 September 2026 from the implementation review of spec `044-field-ledger-redesign`.

## Overview

Spec 044 rebuilt every player-facing screen of Wottle as one room (two player bars, the field, one ledger) to the Field & Ledger design. The review (`IMPLEMENTATION_REVIEW.md`, visual companion `Wottle Implementation Review.dc.html`) found the architecture complete and faithful, and the pixels never checked: Playwright, axe and the reference screenshots were skipped for lack of a database. Three paint defects in the field, an unwired phone ledger, eleven deviations, five unimplemented behaviours and four pieces of dead weight remain between the code and the design.

This handoff is the plan to close that gap. It is a **completion**, not a rebuild: do not restructure `components/room/`, `lib/room/` or the room states. Fix what the review lists, in the order given, and make the room visible to tests before touching anything else.

## About the design files

The `.dc.html` files in this bundle are **design references written in HTML** — prototypes of intended look and behaviour, not code to copy. `Wottle UX Audit.dc.html` is the design source (Fig. 2 desktop match, Fig. 5 phone, Fig. 6 lobby, Fig. 7 matchmaking, Fig. 8 post-game, Fig. 9 profile, Fig. 10 states). `Wottle Implementation Review.dc.html` section 02 renders the field twice from the committed stylesheet: fixture A (the defect) and fixture B (the target). Open them in a browser next to `support.js`; the print copy needs `doc-page.js`, the phone figures need `ios-frame.jsx`. Google Fonts load from the network.

The target environment is the existing one: Next.js 16 / React 19 / TypeScript, Tailwind 4 with the seven-token theme, Zustand, Supabase; Vitest (JSDOM) for units, Playwright + axe for the room. Every pattern this plan needs already exists in the tree (`MatchRoomView` as the view/controller split, `room-css.test.ts` for static stylesheet assertions, `getSeatColors` for colour, `copy.ts` for strings).

## Fidelity

**High-fidelity.** Every value is binding: tokens, type sizes, geometry and motion come from `WOTTLE_DESIGN_SYSTEM.md` with the five team decisions of 14 September applied (5:00 clocks, instant commit with opt-in preview, placeholder queue field, one record and one chevron per run, 0:00 = timeout pass). Where the review's fixture B and the design system disagree with the code, the code is wrong.

## Decisions (defaults applied unless the team says otherwise)

Three items were left to the team by the review. This plan implements the recommendation for each; each is one task (T030–T032) and can be dropped or inverted without touching the rest.

| # | Question | Default in this plan | If the team decides otherwise |
| --- | --- | --- | --- |
| 1 | Are directory challenges ranked? | **Unranked.** `matches.rated` flag, invites create `rated = false`, rating skipped, captions say `unranked`, lobby copy `challenge for an unranked match`. | Skip T030; change only the plan bundle §12 to record "challenges are ranked"; B11 closes. |
| 2 | Coral as text below 17 px (3.6:1 on paper). | **Add one text-only token** `--opp-text: #C2402A` (5.1:1) for ledger words, scored-letter numerals and the profile `vs` rows. Letters on the field, lanes, totals and seat squares stay `--opp`. Eight colour tokens. | Skip T031; keep the axe exclusions and record the exception in design system §9. |
| 3 | Value numeral at phone cell sizes (18 % of 36 px = 6.5 px). | **Floor at 9 px; hide below 32 px cells.** The cell's `aria-label` still carries the value. | Skip T032; the numeral is unreadable on phones. |

## What to build — seven steps

Order is fixed. R1 first because nothing can be judged until the room renders without a database; R7 last because it is the check the others are measured by. Each step is one PR, ends with `pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check` green, and from R2 on carries the fixture screenshots at 1440×900, 1280×800 and 390×844.

| Step | Scope | Review findings | Est. |
| --- | --- | --- | --- |
| R1 Seen | Fixture route `/__room?phase=…` from static data; view/controller split for lobby and queue; visual spec skeleton | E1 | ½ d |
| R2 Field paint | Paper field with cell-border rules, `--cell-size`, 1.5 px chevrons, bar padding, picking value, frozen round | A1 A2 A3 B3 B4 B8 | ½ d |
| R3 Composition | Centre the room not the stack; full-width live row; queue live row; no bare page | B1 B2 B7 B10 | ½ d |
| R4 Phone | Ledger collapses to caption + live row + territory; `LedgerSheet` opens from the live row, in flow, never over the field | A4 C4 | 1 d |
| R5 Interaction & motion | Drag, tap-outside, `?`/`M`, 150 ms exchange, pin fade, name write, SVG dashed lane | C1 C2 C3 B5 B6 | 1 d |
| R6 Debt, decisions, documents | Legacy aliases, `lib/ui`, `ds-bundle`, game config, chart labels, decisions 1–3, design bundle to the decisions | D1–D4 B9 B11 E2 | 1 d |
| R7 Baselines & real run | Human comparison against Fig. 2, 5–10; commit `toHaveScreenshot` baselines; one two-player run on Supabase | C5 | 1 d |

Task-level detail with exact files, test-first order and acceptance is in `TASKS.md` (Speckit format — drop it into `specs/045-field-ledger-completion/tasks.md`).

## Key specifications (the values the tasks depend on)

### Field (R2) — target is fixture B in the review DC

```css
.field {
  position: relative; display: grid;
  grid-template-columns: repeat(10, 1fr); grid-template-rows: repeat(10, 1fr);
  width: 100%; height: 100%; box-sizing: border-box;
  border: 1.5px solid var(--ink);
  background: var(--paper);            /* was var(--rule) */
  gap: 0;                              /* was 1px */
  --cell-size: calc(var(--field-size) / 10);   /* was never declared */
  touch-action: none;                  /* R5 drag */
}
/* delete .field::before entirely */
.field__cell {
  background: transparent;             /* bands SVG sits beneath at z-index 0 */
  border-right: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  font-size: calc(var(--cell-size) * 0.55);
}
.field__cell:nth-of-type(10n) { border-right: 0; }
.field__cell:nth-last-of-type(-n + 10) { border-bottom: 0; }
.field__value { font-size: max(9px, calc(var(--cell-size) * 0.18)); }   /* decision 3 */
.field[data-cell-size="small"] .field__value { display: none; }        /* cell < 32px */
```

`FieldBands.tsx`: `strokeWidth={1.5}` (keep `vectorEffect="non-scaling-stroke"`). `.player-bar { padding: 0 }`.

`useFieldSize`: measure `clientWidth − paddingLeft − paddingRight` (from `getComputedStyle`), take `barHeight = 56` when `matchMedia("(max-width: 900px)")` matches, keep `min(available, width, 720)`. `.room__field-slot { width: var(--field-size) }` at every breakpoint so `--cell-size` is true on phones. `Room` sets `data-cell-size="small"` on `.field`'s wrapper when `fieldSize / 10 < 32`.

### Room composition (R3)

`.room { grid-template-columns: auto var(--ledger-width); justify-content: center; }` and `.room__stack { margin: 0; }` — the field-to-ledger gutter is exactly `--room-gutter` (56 px ≥ 1100, 40 px 900–1100) at every window width; the pair is centred as a unit. Below 900 px unchanged (one column).

Live row: one element spanning `grid-column: 1 / -1`, background `var(--tint)`, `box-shadow: inset 3px 0 0 var(--ink)`, containing an inner `34px 1fr 1fr` grid so the label, your text and the opponent's text align with the rows above. Queue variant renders the same element with `setting the field · n of 100 letters`, then `round 1 in 3 · 2 · 1`.

### Phone (R4) — Fig. 5

Below 900 px the ledger renders, in this order: caption row (`wottle` / `ranked · round 4 of 10`), the live row as a `<button aria-expanded>` whose right cell reads `history ▸`, the 4 px territory bar and its counts line. Nothing else. Tapping the live row opens `LedgerSheet` **in flow beneath the live row**: `flex: 1; min-height: 0; overflow-y: auto`, no fixed positioning, no backdrop, never above the bottom bar's lower edge, so the field and both bars are never covered. It holds the seat header, the ten rows, notices and the foot. Esc or `close` returns focus to the live row. `document.scrollingElement.scrollHeight <= innerHeight` at 390×844 with the sheet closed and open.

### Interaction and motion (R5)

- Drag: `pointerdown` on cell A captures the pointer; `pointerup` resolves the cell under the pointer with `document.elementFromPoint`; a different cell dispatches `{ type: "drag", from, to }`, the same cell falls through to the existing `tap`. Suppress the synthetic `click` that follows a drag.
- Tap outside: while the interaction is not `idle`, a document `pointerdown` whose target is outside `.field` and outside any `[data-field-safe]` element (the ledger's action buttons carry it) dispatches `tapOutside`.
- Hotkeys: `?` → the `rules` ledger action, `m`/`M` → `toggleSound`; ignored when the target is an input, textarea or contenteditable, or when a modifier is held. One hook, used by all three controllers.
- Exchange: when a swap (preview or commit) changes `displayBoard`, the two letter spans translate from the other cell's position to their own over 150 ms `cubic-bezier(0.2, 0, 0.2, 1)` (FLIP via `--dx`/`--dy` custom properties and one keyframe). Pin fade: a cell leaving `pinned` gets `pin-fade` 200 ms. Found: the opponent's name in the top bar fades in over 200 ms. All three 0 ms under `prefers-reduced-motion` (extend the existing media block).
- Disconnected lane: an inline `<svg width="100%" height="4" aria-hidden><line x1="0" y1="2" x2="100%" y2="2" stroke="var(--seat-ink)" stroke-width="4" stroke-dasharray="6 4"/></svg>` in place of the dashed border.

### Tokens (R6, decision 2)

```css
--opp-text: #C2402A;   /* coral for text below 17px; 5.1:1 on paper */
```
`getSeatColors` gains `text`: `var(--you)` for the viewer (teal is 4.9:1 on paper), `var(--opp-text)` for the opponent. Used by `.ledger__word`, `.field__cell[data-state="scored"] .field__value`, the profile's `vs` rows. `tokens.test.ts` asserts exactly eight colour tokens; `CLAUDE.md` and design system §2 say eight.

### Fixture route (R1)

`app/__room/page.tsx`, query `phase = landing | lobby | queue | found | match | reveal | final | disconnect | profile`. Returns `notFound()` when `process.env.NODE_ENV === "production"` unless `ROOM_FIXTURES=1`. Renders the presentational views (`Room`, `PlayerBar`, `Field`, `Ledger`, `LobbyLedger`, `ProfilePage`, and the new `LobbyRoomView` / `QueueRoomView`) from `app/__room/fixtures.ts`, seeding `useRoomStore` and `usePreferencesStore` directly. No Supabase, no transport.

Fixture board (10 rows, the one the review DC renders), words and seats:

```
ÞAKREISTÖL
GÆFUNDIRÓM
SKBORÐTÝUN      BORÐ  you  R1  ltr  x 2–5, y 2
ÁLNIRÖSKUM
EYÐIHVAGTL      GILT  opp  R2  ttb  x 7, y 4–7
RÚNTÆKSIÐÓ
ÖFLUGRÁLEK
MÝSJAÐETRI
ISKÓPUNÆHÖ
TRAUÐLEGIS      T at x 0, y 9 picked (match phase)
```
Players: Birna 1204 (you, teal, 6:45 → shown 4:12 of 5:00 in match), Kári 1187 (opp, coral, 2:31). Match phase is round 4 of 10 with rounds 1–3 scored; `final` is `Kári wins 170–127`; `disconnect` shows `reconnecting · 0:42 left` on the top bar with the dashed lane.

## Interactions & behaviour already correct (do not touch)

Reducer `lib/room/fieldInteraction.ts`, reveal plan (400/120/400/200 ms), band geometry, clock lane states, seat-colour resolution, notices, verdict, lobby tables, queue placeholder landing, disconnect/claim, rematch, read-only replay, profile layout, copy module. The review's section 3 lists every value that was checked and matched.

## State management

No new state beyond: `LedgerModel.live?: string` (queue live row), a `collapsed` prop and `sheetOpen` local state on `Ledger` (phone), a `rated: boolean` on `MatchState`/`matches` (decision 1), a `text` colour on `getSeatColors` (decision 2). The fixture route seeds the existing stores; it adds none.

## Design tokens

Colours: `--paper #FFFDF7`, `--ink #0F1A24`, `--rule #E6E2D6`, `--tint #F4F1E8`, `--muted #5A6572`, `--you #147D7A`, `--opp #E4573D`, plus `--opp-text #C2402A` (decision 2). Derived only: `--you-band`/`--opp-band` 14 %, `--you-live`/`--opp-live` 30 %, `--future-label #B9B4A6`. Type: Zilla Slab 500/600/700 (`--font-board`), Red Hat Mono 400/500/600 (`--font-mono`). Radius 0 everywhere; no shadows (the inset 3 px rule and 2 px rings are `box-shadow: inset` — allowed as line drawing), no gradients, no blur. Full scale in `WOTTLE_DESIGN_SYSTEM.md` §2–§3.

## Acceptance for the whole feature

1. `pnpm test:visual` (new; Playwright against `/__room`, no Supabase) passes in CI against committed baselines at 1440×900, 1280×800, 390×844 for all nine phases.
2. A person has compared each baseline with Fig. 2, 5, 6, 7, 8, 9, 10 using the checklist in `TASKS.md` R7, and recorded it in `specs/045-field-ledger-completion/checklists/visual.md`.
3. One full two-player Playwright run (`pnpm exec playwright test`) on a real Supabase, axe clean on every phase, results recorded in `tasks.md` — replacing spec 044's "Not run locally: no Supabase".
4. `acceptance-grep.test.ts` (case-insensitive) and `pnpm docs:check` green; `tokens.test.ts` asserts the exact token set.
5. The design bundle in `docs/design_documentation/260914-wottle-new-design/` says what the code does (5:00, opt-in preview, one chevron, eight tokens, numeral floor, phone sheet geometry, challenge ranking as decided).

## How to start

1. `git checkout -b 045-field-ledger-completion`; create `specs/045-field-ledger-completion/` with `/speckit.specify` using this README's Overview and Decisions as the brief; copy `TASKS.md` in as `tasks.md`.
2. Follow the constitution in `.specify/memory/`: TDD, every test task fails before its implementation task, one commit per passing test (`test(scope): …`), never a failing one.
3. Read `IMPLEMENTATION_REVIEW.md` section 2 for the evidence behind each finding before editing the file it names.

## Files in this bundle

- `README.md` — this document.
- `TASKS.md` — Speckit task list, R1–R7, T001–T037.
- `IMPLEMENTATION_REVIEW.md` — findings A1–E2 with file/line evidence; section 3 = what already matches.
- `WOTTLE_DESIGN_SYSTEM.md`, `WOTTLE_DESIGN_PLAN.md`, `DOCS_CONSISTENCY.md` — the design bundle as authored (before the five decisions; R6 T033 updates the repo copies).
- `Wottle UX Audit.dc.html` (+ `-print`), `Wottle Implementation Review.dc.html`, `support.js`, `doc-page.js`, `ios-frame.jsx` — design references; open in a browser.
