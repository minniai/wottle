# Wottle — Field & Ledger: implementation plan for Claude Code

Source of truth for the design: `Wottle UX Audit.dc.html` in this project (sections 04–09 are the proposal; Fig. 2 desktop match, Fig. 5 phone, Fig. 6 lobby, Fig. 7 matchmaking, Fig. 8 post-game, Fig. 9 profile, Fig. 10 states). The design system that all new UI must follow is `handoff/WOTTLE_DESIGN_SYSTEM.md`. Documentation changes that keep the repo consistent are in `handoff/DOCS_CONSISTENCY.md`.

This plan was written against the `wottle` codebase as attached (Next.js app router, Tailwind v4 with `@config tailwind.config.ts`, `app/styles/board.css`, `components/match/*`, `components/game/*`, `components/lobby/*`, `components/matchmaking/*`, `components/profile/*`, `lib/game-engine/*`, Playwright e2e). File names below are the ones that exist today; where a file is new it is marked **new**.

---

## 0. Scope, non-goals, and the one rule

**Scope.** Client-side rebuild of every screen a player sees: landing, lobby, matchmaking, match, post-game, profile. Tokens, fonts, layout, components, motion, copy. Playwright flow updated.

**Non-goals.** No server/engine changes except the ones listed in §1 (they are contract changes that the client depends on). No new features beyond the ones the design implies (warm-up field, pick → preview → commit, seat-relative colour). No changes to matchmaking or rating logic.

**The one rule.** Every visible element must be one of: a letter or a state of a letter on the field; a fact about one player in that player's bar; a fact about the match in the ledger. Anything else is removed, not restyled.

---

## 1. Engine and contract changes (do first, small, fully tested)

The design surfaces facts the engine already computes but does not expose cleanly. Confirm each against `docs/prd_and_requirements/wottle_game_rules.md` (updated per `DOCS_CONSISTENCY.md`) before implementing.

1. **Reading direction on scored words.** Rules §3.1 already fixes four orthogonal directions (`read forward or reversed`). Each scored word record must carry `direction: "ltr" | "rtl" | "ttb" | "btt"` so the field can place the chevron. Where: the word-extraction / scoring step in `lib/game-engine/` (the function that returns `WordHistory` / `wordHistory.coordinates`). Add the field to the `WordHistory` type in `lib/types/match.ts` and to the `words_found` JSONB shape if it is persisted. If the team confirms double scoring (DOCS_CONSISTENCY §1.2), a run valid both ways produces **two** records; tests: FÁR/RÁF scoring 24, LÁN/NÁL, a single-direction word producing one record.
2. **Whole-run rule.** Already enforced (`violatesFrozenAdjacencyOnSameAxis`, rules §3.5a / I7a). Add a regression test named `BORÐA + GILT` so the example in the design doc is pinned.
3. **Clock model.** `TimerState { playerId, remainingMs, status: running | paused | expired }` in `lib/types/match.ts` already carries per-player match time. Confirm the server ticks it as a 5:00 per-player budget (`MATCH_CLOCK_BUDGET_MS = 300_000`) that runs only while that player's move is open; the client reads `remainingMs` and `status` per seat for the lanes. Do not remove anything the server relies on.
4. **Clock at 0:00.** The rules document must state the consequence (see `DOCS_CONSISTENCY.md`, open question 3). Implement whatever the team decides; the bar can render any answer.
5. **Preview/commit.** No engine change. **Decided 14 September 2026: the second tap commits, as it always has; the preview is opt-in from the `⋯` menu** and persists with the sound preference. When it is on, the second tap previews and a third commits. The preview is priced by a read-only Server Action (`previewSwap`), not client-side — the 55MB dictionary cannot ship to the browser — and the hint reads `tap again to play` until the price lands.

---

## 2. Tokens, fonts, and the Tailwind config

Files: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`, `app/styles/*.css`.

1. Replace the Warm Editorial token set in `app/globals.css` with the five values in `WOTTLE_DESIGN_SYSTEM.md §2` (`--paper`, `--ink`, `--rule`, `--you`, `--opp`, plus `--tint`, `--muted`). Remove `--ochre`, `--p1`, `--p2`, `--warn`, `--good`, `--bad`, `--paper-2`, the letterpress shadow tokens, and every `oklch` gradient token. Keep `color-scheme: light`.
2. **Seat-relative colour.** `lib/constants/playerColors.ts` currently maps slots (`player_a`/`player_b`) to colours. Replace with `getSeatColors(viewerSlot, slot)` returning `you` (teal) when `slot === viewerSlot` and `opp` (coral) otherwise. Every consumer (BoardGrid frozen tints, bars, ledger, post-game) goes through this function. Delete `PLAYER_A_SELECTED_BG`, `PLAYER_A_LOCKED_BG`, `BOTH_GRADIENT`. <!-- retired-name -->
3. Fonts: in `app/layout.tsx` replace `Fraunces` and `JetBrains_Mono` from `next/font/google` with `Zilla_Slab` (weights 500, 600, 700, `latin` + `latin-ext`) and `Red_Hat_Mono` (400, 500, 600, `latin` + `latin-ext`). Expose as `--font-board` and `--font-mono`. Delete the Inter/Fraunces `@font-face` block and `ds-bundle/fonts` usage in app code (the ds-bundle folder itself is documentation; leave it or archive it per `DOCS_CONSISTENCY.md`).
4. `tailwind.config.ts`: rebind `colors`, `fontFamily`, `borderRadius` (all `0`), `boxShadow` (none) to the new tokens. Delete `rounded-2xl`/`shadow-*` usage as you touch each component; a final grep for `rounded-`, `shadow-`, `gradient`, `emerald`, `red-`, `amber` must return nothing under `components/` and `app/`.
5. Delete `app/styles/board.css` content in stages (see §4) and end with a file that contains only `@keyframes` used by the field (shake, count-up) and the `prefers-reduced-motion` override. Delete `app/styles/lobby.css`, `matchmaking.css` and `profile.css` outright once §7–§8 land. Update `tests/unit/styles/*` (token tests) to the seven values. Review `components/player/*` and `components/ui/*` (Button, Skeleton, InviteDialog…) and delete what no longer has a caller.

---

## 3. Layout shell

Files: `app/layout.tsx`, `components/ui/TopBar.tsx`, `components/ui/UserMenu.tsx`, `app/match/[matchId]/page.tsx`, `components/match/MatchShell.tsx`.

1. Remove `TopBar` from the root layout during a match. Simplest: render `TopBar` only in the `(lobby)` and `profile` route groups — and then remove it there too, because the lobby design has no top bar (Fig. 6). `UserMenu` becomes the `⋯` menu in the ledger foot (`MatchLedger`/`LobbyLedger`), containing sound, profile, sign out (lobby) or sound, resign, leave (match).
2. **new `components/room/Room.tsx`** — the one layout used by lobby, matchmaking, match and post-game: a CSS grid `minmax(0,1fr) 340px` with a 56px gutter at ≥1100px; `minmax(0,1fr) 260px` from 900–1100px; single column below 900px. Left column is a vertical stack `PlayerBar(top, opponent) / Field / PlayerBar(bottom, you)`; right column is a `Ledger`. The field is `min(available height − 2×bar − 48px, 720px)` square; compute with a `ResizeObserver` on the room, not with `100vh` maths in CSS. Below 900px the ledger collapses to its live row under the bottom bar; history opens as a sheet from the live row.
3. `MatchShell` becomes a thin wrapper that renders `Room` with `state="match"`; the lobby and matchmaking pages render `Room` with `state="lobby" | "queue"`; the post-game is `state="final"`. The route structure can stay (`/lobby`, `/matchmaking`, `/match/[id]`); the room just looks identical across them, and route changes must not flash (no loading skeletons; the previous room state stays mounted until the next is ready).

---

## 4. The field

Files: `components/game/BoardGrid.tsx`, `components/game/Board.tsx`, `components/game/BoardCoordLabels.tsx` (delete), `components/game/MoveFeedback.tsx` (delete), `app/styles/board.css`.

1. **Cells.** Flat paper cells, 1px `--rule` between them, 1.5px `--ink` frame around the field. Letter in `--font-board` 600 at 55% of the cell height, uppercase; value numeral in `--font-mono` 400 at 18% of cell height in the top-right gutter (`top:4%; right:6%`), colour `--muted`; on a frozen letter the numeral takes the scorer's ink; on a picked letter it takes `--ink` at 500. Remove letterpress gradients, radii, hover lift. Hit target is the whole cell (≥44px on phones — the field is full width there).
2. **Word bands (new layer).** Derive from `wordHistory` + `frozenTiles`: one band per scored word record, a 14% tint of the scorer's ink, square ends, inset 20% of a cell on its short axis and 5% on its long axis (clipped to frozen letters for partial freezes). A 1.5px chevron of the scorer's ink, opened to ~150° (arm depth 9% of a cell across the band height), at the end where reading begins: left edge pointing right (`ltr`), right edge pointing left (`rtl`), top pointing down (`ttb`), bottom pointing up (`btt`). A run with two records gets both chevrons. Letters inside a band take the scorer's ink; a letter shared by both seats' words is `--ink` at 700. Bands are `position:absolute` siblings under the cell grid, percent-positioned from cell indices; render as one `<svg>` overlay or as divs with an inline chevron `<svg>` (either is fine; keep it under 60 lines).
3. **Pick → preview → commit** state machine in `BoardGrid` (replaces `handleTileClick → animateSwap` direct submit):
   - `idle` → tap A → `picked(A)`: letter turns your ink, `scale(1.08)`, inset 2px `--ink` ring, value shows at full ink. Sound `tile-select`.
   - With the preview setting **on** (off by default): `picked(A)` → tap B → `preview(A,B)`: the two letters exchange in 150ms; both carry a 2px dotted `--ink` ring; the ledger hint line prints the word total the preview would make (client-side scoring of the visible board, same function as the engine; do not hint new words on the field). Nothing sent.
   - Default (preview off): `picked(A)` → tap B → `committed` directly. With preview on: `preview` → tap A or B, or Enter → `committed`: send `submitSwap`; rings become 2px dashed in your ink (pinned); your lane stops. Sound `valid-swap`, haptic where available.
   - Any state → Esc, tap elsewhere, or tap A again → `idle` (preview reverses). No sound.
   - Setting `instantCommit` (user setting, default off) makes the second tap commit directly.
   - Pointer drag A→B produces `preview(A,B)`.
   - Tapping a frozen or pinned letter: 300ms shake in that letter's ink; live row reads `frozen · <name> R<n>` for 2s.
   - Opponent's swap arrives: their two letters pin in their ink immediately (rule §2 broadcast); if one was your pick, your pick clears and the live row says so.
4. **Remove**: coordinate labels (keep `aria-label="row 3, column F, letter Ð"` on each cell), the lock banner, the round-announce overlay, `MoveFeedback` toasts, `--invalid` blue flash, the pulsing waiting frame. Nothing is ever positioned over the field.
5. **Reveal choreography** (replaces the recap phase machine in `MatchClient`): bands draw along each word 400ms each, staggered 120ms; ledger writes word + points into the live row as each band lands; totals count up over 400ms. Settle: pins fade 200ms, live tint (30%) settles to 14%, territory bar updates, next row opens. All ≤400ms, all off under `prefers-reduced-motion` (end states only).

---

## 5. Player bars

**new `components/room/PlayerBar.tsx`** (replaces `HudCard.tsx`, `PlayerPanel.tsx`, `TimerDisplay.tsx`, `PlayerAvatar.tsx`, `MatchCenterChrome.tsx`, `RoundPipBar.tsx`, the mobile compact bars).

Props: `seat: "you" | "opp"`, `position: "top" | "bottom"`, `name`, `rating`, `subline` (string, one line, nowrap), `clockMs`, `clockRunning`, `score`, `laneFraction` (0–1 of 5:00), `state?: "empty" | "searching" | "found" | "playing" | "final"`, `action?: ReactNode` (the primary action when the seat is empty).

Layout: 60px tall (56px on phones), `grid-template-columns: 1fr auto 1fr`, 16px gap. Left: 12px ink square in the seat colour (dashed outline when the seat is empty) + name (`--font-board` 600 17px) + sub-line (`--font-mono` 11px, 0.12em tracking, uppercase, `--muted`, one line). Centre: mm:ss in `--font-mono` 26px, `--ink` 500 while running, `--muted` 400 when stopped. Right: total in `--font-mono` 40px in the seat colour, or the primary action. The bar's edge nearest the field is a 4px lane: full width = 5:00; filled portion in the seat colour, remainder `--rule`. Under 1:00 the lane is 8px and blinks at 1Hz (colour only); reduced motion holds it solid. Disconnect: lane becomes a 6px/4px dashed pattern in the seat colour and holds; sub-line counts the grace period.

Use `deriveClockUrgency.ts` for the <1:00 threshold; delete its yellow/red tones.

---

## 6. Ledger

**new `components/room/Ledger.tsx`** (replaces `MatchLeftRail.tsx`, `HowToPlayCard.tsx`, `LegendCard.tsx`, `YourMoveCard.tsx`, `ScoredWordsCard.tsx`, `TilesClaimedCard.tsx`, `ScoreDeltaPopup.tsx`, `RoundSummaryPanel.tsx`, `RoundHistoryPanel.tsx`, `HudCard` centre chrome, the resign button).

Structure (top → bottom, `display:flex; flex-direction:column`, height = the stack's height, 1.5px `--ink` top rule):
1. Caption line: `wottle` (`--font-board` 700 16px) left; right in mono uppercase: `ranked · round 4 of 10` (match), `lobby · 4 here`, `ranked · 10 rounds · 5:00 clocks` (queue), `final · 10 rounds · 18:50`.
2. Match/final only — column header: `■ Birna · you` / `■ Kári`, 1px `--ink` rule beneath.
3. Rounds table: CSS grid `34px 1fr 1fr`, `grid-auto-rows: minmax(0,1fr)`, `flex:1`, so ten rows share the available height. Cell: words joined by ` · ` in `--font-board` 600 in the seat colour, wrapping as needed, round total pinned top-right in mono 12px. Empty future rows show only the round label in `#B9B4A6`. Live row: `--tint` background, 3px `--ink` left rule, states `picking · T (2)` / `played ●` / then the words as they land. Hover/tap a row → the field highlights that row's bands (dim others to 6%); per-word points show in the row while hovered.
4. Post-game only — verdict block above the header: `Kári wins 170–127` (`--font-board` 600 20px) + `by 43 points · 10 words to 8 · territory 32–25` in mono.
5. Territory bar (4px: you / free / opp) + counts line + one-line hint (`tap a second letter`, `hover a row to see its words`).
6. Live-row-styled notices: rematch request (`Kári asks for a rematch · accept ▸ · decline`), resign confirmation (`resign the match? · yes, resign ▸ · no`, reverts after 5s), first-match sentences.
7. Foot: left `? rules` / actions (`rematch ▸ · new opponent ▸ · lobby`, `cancel ▸`); right `⋯` menu.

Lobby variant (`LobbyLedger`): caption; `here now · challenge for an unranked match` table (name, rating, ± vs you, `challenge ▸`); `your last matches` table (opponent, score, ±rating); live row for the warm-up hint; foot `? rules` / `⋯ sound · sign out`.

Fold: if a row would exceed three lines, rounds older than the last three collapse to totals only (words on hover). Never scroll the ledger.

---

## 7. Room states (lobby, queue, found, final)

Files: `app/(landing)/page.tsx`, `components/landing/LandingScreen.tsx` (delete), `app/(lobby)/lobby/page.tsx`, `components/lobby/*` (delete `LobbyHero`, `PlayNowCard`, `LobbyCard`, `LobbyDirectory`, `EmptyLobbyState`, skeletons), `components/matchmaking/*` (delete `MatchRing`, `MatchmakingVsBlock`; keep the queue logic from `MatchmakingClient.tsx` as a hook `useMatchmaking`), `components/match/FinalSummary.tsx`, `PostGameVerdict.tsx`, `PostGameScoreboard.tsx`, `RematchBanner.tsx` (delete all four; the ledger renders the final state).

1. **Landing** = lobby room with the bottom bar in `state="empty"`: the name slot is an inline underlined input (`your name`), sub-line `no account needed`, primary action `play ▸`. Submitting writes the lobby session and turns the bar into the signed-in bar without navigation.
2. **Lobby**: top bar `state="empty"` (`No opponent yet`, `ranked · about 0:10 to find one`, action `play ranked ▸`); field is a **warm-up field**: a real random board; pick/preview works and the live row prices the word the preview would make; nothing is submitted or scored. Ledger = `LobbyLedger`. Challenge from the directory starts an unranked match with that player (existing challenge path).
3. **Queue**: top bar `state="searching"` (`Finding an opponent`, `ranked · 0:07 · cancel ▸`, a 12%-wide coral segment travelling the lane at 1 cycle/3s). The field **sets itself**: the next match's letters land in reading order at ~100ms each (if the server only sends the board on match start, set a placeholder board and swap letters that differ when the real one arrives). Ledger rows empty; live row `setting the field · 58 of 100 letters · an opponent joins when the last one lands`; foot `cancel ▸`. <!-- retired-name -->
4. **Found**: the top bar writes the name/rating in (200ms), lane fills to 5:00, sub-line counts `round 1 in 3 · 2 · 1`; then `state="match"`. No versus screen, no route flash.
5. **Final**: field freezes with all bands; bars show final totals and `1191 → 1203 · +12 · wins` / `1204 → 1192 · −12` sub-lines; ledger shows the verdict block, all rows, territory, the rematch notice when requested, and actions `rematch ▸ · new opponent ▸ · lobby`. Rating pending: sub-line `rating pending`. The field stays until the player leaves.
6. **Disconnect**: opponent bar sub-line `reconnecting · 0:42 left`, lane dashed and held; your clock holds too. No overlay.

---

## 8. Profile

Files: `components/profile/*`. Replace `ProfileSidebar`, `ProfileStat`, `ProfileRatingChart`, `ProfileWordCloud`, `ProfileMatchHistoryList` with one `ProfilePage` on the same `1fr 340px` grid: left — identity row (14px seat square, name 28px, `playing since <month> · <n> matches`; rating 48px mono right-aligned with `rating · peak <n> · <±n> this week`), a hairline 30-day rating chart (`<svg>` polyline, 1.5px `--you`, three `--rule` gridlines, mono axis labels), and a four-cell ruled record row (won / lost / drawn / win rate). Right — `best words` ledger (word in seat colour, points, `vs <name>`), `recent matches` ledger, foot `◂ lobby` / `change name · sign out`. Another player's profile uses `--opp` for the seat colour. Tapping a match opens its final room state read-only.

---

## 9. Copy

All copy in `WOTTLE_DESIGN_SYSTEM.md §8`. Replace: `Ranked · 5+0 · Icelandic nouns` → `ranked · 10 rounds · 5:00 clocks`; `outrun the chess clock` and the hero paragraph → removed with the hero; `Move submitted — waiting for opponent` → removed (lane holds instead); `Hidden from opponent until both submit` → removed (it is false since #210); `wants a rematch!` → `asks for a rematch · accept ▸ · decline`; first-match text: `Swap two letters. Words of three or more score and freeze in your ink. Ten rounds; your clock holds five minutes for all of them.` No exclamation marks anywhere.

---

## 10. Tests and acceptance

- **Unit**: seat colour mapping; band geometry (direction → chevron edge; one record per run, so one chevron per band; partial freeze clipping); preview scoring equals engine scoring for the same board; ledger fold rule.
- **Playwright** (`tests/e2e` two-player flow): update selectors from `hud-card`, `round-pip-bar`, `your-move-card`, `scored-words-card`, `tiles-claimed-card`, `lock-banner`, `round-announce`, `match-ring`, `post-game-scoreboard-card`, `rematch-banner` to `player-bar-top`, `player-bar-bottom`, `ledger`, `ledger-live-row`, `field`, `field-band`, `verdict`. Add: pick → preview → commit; Esc cancels a preview; opponent pin arrives during preview; rematch notice in the live row; landing name entry without navigation.
- **Visual acceptance** (compare to the figures): no element overlaps the field; ledger height equals the stack height at ≥1100px and its foot is flush with the bottom bar; no scrolling on a 1440×900 window with browser chrome; field ≥ 560px at 1280×800; phone portrait shows bar / field / bar / live row without scrolling on 390×844; every colour on screen is one of the eight tokens; a **case-insensitive** grep for `rounded-`, `shadow-`, `gradient`, `emerald`, `red-`, `amber`, `fraunces`, `inter`, `jetbrains` and the retired colour families returns nothing in `app/` and `components/`. <!-- retired-name -->
- **Accessibility**: cells have coordinate + letter + state in `aria-label`; arrow keys move focus on the field, Space picks/previews, Enter commits; lanes have `role="progressbar"` with `aria-valuetext="6:45 remaining"`; live row is `aria-live="polite"`; contrast: mono labels use `--muted` (5.7:1 on paper), never lighter.

---

## 11. Order of work (each step ships on its own)

| Step | Work | Removes | Est. |
| --- | --- | --- | --- |
| P0 | §1 engine contracts + tests; §9 copy fixes; F5/F7/F12/F18 bug fixes inside the current look | — | 1 day |
| P1 | §2 tokens/fonts/config; §3 shell without TopBar; §5 `PlayerBar` in place of HUD cards and mobile bars | HudCard, PlayerPanel, TimerDisplay, MatchCenterChrome, RoundPipBar, TopBar in match | 2 days |
| P2 | §6 `Ledger` (match variant) | MatchLeftRail + 3 cards, ScoredWordsCard, TilesClaimedCard, ScoreDeltaPopup, RoundSummaryPanel, RoundHistoryPanel, resign button | 3 days |
| P3 | §4 field: cells, bands with direction, pick → preview → commit, reveal choreography | BoardCoordLabels, MoveFeedback, lock banner, announce, invalid flash, board.css bulk | 4 days |
| P4 | §7 room states: landing/lobby/queue/found/final in one `Room`; warm-up and setting fields | LandingScreen, LobbyHero, PlayNowCard, LobbyDirectory, LobbyCard, MatchRing, MatchmakingVsBlock, FinalSummary, PostGameVerdict, PostGameScoreboard, RematchBanner | 4 days |
| P5 | §8 profile; §10 Playwright + visual acceptance; docs per `DOCS_CONSISTENCY.md` | Profile sidebar/stat/cloud/list | 2 days |

Each step ends with: the acceptance greps for that step's removed components returning nothing, the two-player Playwright flow green, and a screenshot of the room at 1440×900 and 390×844 attached to the PR and compared against the figures.

---

## 12. Decisions — all settled

Nothing here is open. The first five were taken on **14 September 2026** and
shipped with spec 044; the last three on **15 September 2026** and shipped with
spec 045. Where this bundle and a decision disagreed, the bundle has been
corrected — these are the corrections.

| # | Question | Decision | Where it shows |
| --- | --- | --- | --- |
| 1 | Preview on by default, or instant commit? | **Instant commit.** The second tap plays. Preview is opt-in from the `⋯` menu and persists with the sound setting; it is priced by a read-only Server Action, because the 55MB dictionary cannot ship to the browser. | §4.3, §5 |
| 2 | What does 0:00 mean for the rounds that remain? | **A timeout pass** in each of them. The player keeps their score and territory; both at 0:00 ends the match. The bar renders `0:00` with an empty lane. | rules §2a |
| 3 | Does the queue show the real board or a placeholder? | **A placeholder**, seeded per player; the letters that differ swap in when the real board arrives. The live-row clause *an opponent joins when the last one lands* is dropped. | §7 |
| 4 | Does the warm-up field keep score? | **No.** It swaps locally and prices only when signed in with preview on. | §7 |
| 5 | Are directory challenges ranked? | **Unranked** (15 September). Choosing your own opponent must not move a rating. `matches.rated` is false for an invite-created match and is inherited by its rematches; captions read `unranked` and the lobby offers `challenge for an unranked match`. This supersedes spec 044's clarification that every match is rated. | §8, spec 045 |
| 6 | The clock budget | **5:00 per player for the whole match** (14 September), `aria-valuemax=300`. | §5.3, §8, §9 |
| 7 | A run valid in both directions | **Scores once**, read forward, so every band carries exactly one chevron. | §5.2, rules §3.1 |
| 8 | Coral as text below 17px (3.4:1) | **`--opp-text` `#C2402A`** (15 September), a text-only eighth value at 5.1:1. Letters, lanes, totals and squares keep `--opp`. | §2 <!-- retired-name --> |
| 9 | The value numeral at phone cell sizes | **`max(9px, 18%)`**, hidden below a 32px cell (15 September); the `aria-label` still carries the value. | §5.1 |
