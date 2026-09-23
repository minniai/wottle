# Contract: page derivations (pure, `lib/pages/` and `lib/room/`)

Each function below is pure, takes `copy` where it produces text, and has a unit test first. No component computes these inline.

## `standingSlot(facts: StandingFacts, nowMs: number, held: HeldOutcome | null): SlotState`

**Precedence:** call > match > switch > sent > search > empty.

| Facts | SlotState |
|---|---|
| `incoming.length ≥ 1` | `call` with the oldest pending invite; `more = incoming.length − 1`; `searching = !!search` |
| `match.kind ∈ {table, running}` | `match` (running) |
| `match.kind = over` | `match` (over) |
| `switchPending` | `switch` |
| `outgoing.status = pending`, or an outcome held under 4s | `sent`, with `outcome` = the held outcome or null |
| `search` | `search`, with `queueView(...)` from spec 069 (searching, stillSearching, paused, stopped, cooldown) |
| otherwise | `empty` |

**Held outcomes.** An outcome is held from the moment the client first sees the terminal status, for 4000ms (`accepted`: 400ms, then navigate). The client's hook stores it. The derivation takes it as an input.

## `slotLines(slot: SlotState, copy, nowMs): { style: "call" | "status" | "terms"; line1; line2; primary?; secondaries[]; drain?: {fromMs, toMs} | "sweep" }`

It produces the exact strings from spec US3 to US5, US7 and B8. A few examples:

- **Call.** `Kári skorar á þig` / `1179 · ÞINN FERILL 3–1 · 0:47 TIL AÐ SVARA`.
  - Add `· +1` when `more`.
  - Add `· LEITIN HÆTTIR EF ÞÚ SAMÞYKKIR` when `searching`.
  - Omit the record part when there is no record.
- **Sent.** `Challenge sent · Embla · 0:59` / `ENGLISH WORDS · 10 MOVES EACH · WIN +9 · LOSS −7`. The secondary is `withdraw ▸`, and the slot drains over `created → expires`.
- **Search.** `Searching for an opponent · 0:07` / `2 SEARCHING NOW · ENGLISH WORDS`. After 0:30 alone, line 2 is `NO ONE ELSE IS SEARCHING · CHALLENGE SOMEONE BELOW`. The secondary is `cancel ▸`, with the sweep. The `stillSearching`, `paused` and `stopped` states use the spec 069 strings, now in the slot.
- **Match running.** `Your match · Kári` / `MOVE 4 OF 10 · 3:12 LEFT`, with the primary `BACK TO THE MATCH ▸`.
- **Match over.** `Your match is over · Kári wins 88–46` / the detail, with the primary `RESULT ▸`.
- **Switch.** `you are in the Icelandic lobby` / `switching cancels your search` (or `…withdraws your challenge`, `…answers your challenge`), with the primary `switch ▸`.
- **Empty.** The place `LOBBY · ENGLISH` (with the counts off the lobby page) and the terms, built from the config.

Every string is built only from `copy` templates. In Icelandic, names appear only in the nominative (the name-safe grep test).

## `pagePrimary(slot, page, facts): PrimaryModel`

**Precedence:** slip > line-slot call > composer send > page primary. The loser is drawn as a secondary.

| Situation | Page primary |
|---|---|
| A call is up | none; `find an opponent ▸` is a secondary |
| A match is running or at a table | none; the reason line is `finish your match first` |
| Sent | none; `find an opponent ▸` is a secondary, with `withdraws your challenge` beneath it |
| Searching | none (the block's slot is empty) |
| The composer is open | none; find is a secondary |
| The table-leave cooldown | none; `find again in 4:12` (spec 069) |
| Otherwise | `find an opponent ▸` |

## `lobbyRows(rows, viewer, standing, frozen): RowModel[]`

**Order.**
- By state (here → searching → in_match → away), then by `|rating − viewer.rating|`, then by name.
- While frozen, keep the previous order and append new ids at the end.

**Cells.**
- The status word comes from the state, or is overridden by the standing facts: `sent · 0:52`, `challenges you`, an outcome held for 4s, or `declined`.
- The action is one of:
  - `challenge ▸`;
  - none (in a match, away, challenges you, sent, or your match running);
  - `again in 0:41` (decline cooldown);
  - the send error written on the row.
- The record is `3–1`, `3–1–1` or `—`.

**Rows shown.** Eight, then `+ N more ▸`.

## `composerModel(row, viewer, facts, copy)`

- Line 2 comes from `stakesFor(viewer.rating, row.rating, K)` (spec 069 `lib/rating/stakes.ts`) and the config.
- Line 3 comes from the facts: a search is running; an outgoing challenge is pending.
- `sendDrawnAs` is `"primary"`, or `"secondary"` while a call is up.

## `formStrip(results: ("W"|"L"|"D")[], copy)`

It returns ten cells, oldest first, padded with empty cells, and the `aria-label` `last ten: 7 won, 3 lost` (draws are named only when there are any).

## `bandMap(bands, viewerSeat)`

It returns the band rectangles and chevrons, using the §5.2 inset geometry of `lib/room/bandGeometry.ts` at 34px cells (340/10), with no letters. The colour is by seat relative to the viewer.

## `lockup(locale, cellPx)` (`lib/brand/lockup.ts`)

It returns the cells, letters, numerals (hidden below 32px cells), the bands at 14% and the chevrons, following §6:
- IS: 7×6, ORÐUSTA across row 3, WOTTLE down column 6, crossing at T with numeral 2.
- EN: 6×7, WOTTLE across row 1, ORÐUSTA down column 2 from the shared O.

The values come from `LETTER_SCORING_VALUES_IS` / `_EN`. `strip(locale, cellPx)` and `cell(locale, signal)` share the same module.

## `tabTitle` (extended)

| Beat | Title |
|---|---|
| door | `Orðusta · orðaeinvígi fyrir tvo` |
| lobby | `lobbí · Orðusta` |
| call | `(1) Kári skorar á þig · Orðusta`, or `(2) …` with a second call |
| sent | `challenge sent · 0:41 · Wottle` |
| search | `searching 0:07 · Wottle` |
| arrival | `Embla is here · Wottle` |
| match running | `your match · 3:12 · Wottle` |
| match over | `Kári wins · Wottle` |

The match page's own titles (spec 069) win while the match controller is mounted.

## `nextParam(raw: string | null, locale): string | null`

It follows the validation rules in data-model.md.
