# Contract: `/rules`

## Request

`GET /rules` — static, no session, no store, outside the `(room)` route group. `export const dynamic = "force-static"`.

## Response

One scrolling page in the room's two families and eight tokens, max content width 800px at ≥900px, single column below.

| # | label | heading | figure / table |
| --- | --- | --- | --- |
| 1 | `1 · the round` | Swap two letters. | `RulesFigure kind="swap"` — two pinned letters |
| 2 | `2 · words` | Three letters or more, in a straight line. | `RulesFigure kind="words"` — BORÐ (ltr, you) and GILT (ttb, opp) with chevrons |
| 3 | `3 · freezing` | Scored letters freeze in your ink. | `RulesFigure kind="crossing"` — LEK crossing GILT, shared L in ink |
| 4 | `4 · scoring` | Values, length, and a bonus for two. | `ScoringTable` — letter values · length bonus `(letters − 2) × 5` · combo bonus · repeated word `0` |
| 5 | `5 · the clock` | Five minutes for the whole match. | — |
| 6 | `6 · winning` | Most points after ten rounds. | — |

Header: wordmark (link to `/`) and `back to the lobby ▸` (`/lobby`). Footer: `play ranked ▸` (`/lobby`, which starts the queue when signed in) and `back to the lobby ▸`.

`RulesFigure` renders the real `Field` component at a fixed 300px with literal boards and bands, `disabled`, `aria-hidden` with a caption `<figcaption>` carrying the description.

## Entry points

| Where | label | navigation |
| --- | --- | --- |
| lobby ledger foot | `how to play ▸` | same tab |
| final ledger foot | `how to play ▸` | same tab |
| sign-in slip | `new here · how to play ▸` | same tab |
| match `⋯` menu | `how to play` | `target="_blank" rel="noopener"` |

## Content parity

`tests/unit/app/rules.parity.spec.tsx` asserts the scoring table's numbers against `DEFAULT_GAME_CONFIG` and the clock/round figures against `MATCH_CLOCK_BUDGET_MS` and `TOTAL_ROUNDS`, so the page cannot drift from the engine. The prose is checked against `wottle_game_rules.md` §2–§6 by review.

## Tests

- `tests/integration/ui/rules-page.spec.ts` — renders without a session; six headings in order; three figures; axe clean; at 390 wide no horizontal overflow; opened from the match menu, the match page's `data-phase` is still `match` and its clock still runs.
- `tests/unit/components/room/RoomMenu.spec.tsx` — match variant lists `how to play` with `target="_blank"`.
- `tests/unit/styles/acceptance-grep.test.ts` — `? rules`, `FIRST_MATCH_RULES`, `firstMatchRules` return nothing.
