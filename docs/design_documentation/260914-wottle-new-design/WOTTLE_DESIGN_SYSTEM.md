# Wottle Design System — Field & Ledger

Version 1.1 · derived from `Wottle UX Audit.dc.html` (sections 04–09); amended 20 September 2026 by spec 048 (the slip, the round rail, the round state, rules outside the room, rated only). Binding for every screen and component in Wottle. When this document and the code disagree, the code is wrong.

Wottle is a two-player Icelandic word duel. Its look comes from the game's own material: a printed word-search page, set in a slab serif so Þ, Ð, Æ and Ö carry weight, marked up by two players with two inks. Paper and ink are the system; teal and coral are the seats. Nothing else.

---

## 1. Principles

1. **The field is the game.** Nothing competes with it, nothing on it that is not a letter or a state of a letter. What frames it above and below belongs to the two players and to nothing else. One thing may cover it: the **slip** (§5.9), for the four moments a player must notice or decide — sign-in, resign, claim the win, match over — and the field fades beneath it (amended 20 September 2026, spec 048).
2. **Three homes for every fact.** A fact about a letter lives on the field. A fact about one player (name, rating, clock, total) lives in that player's bar. A fact about the match (round, words, territory, controls) lives in the ledger. If a proposed element has no home, it is not added.
3. **Show words, not tiles.** Territory is stored per tile and earned per word. Draw the word.
4. **Two budgets, one scale.** Both clocks are match-long budgets; draw them as two lengths on one axis so "who can afford to think" is a glance.
5. **Colour is identity.** Teal is you, coral is the opponent, in every match on every device. The system itself speaks only in ink and paper; alarm is weight and motion, never a third hue.
6. **Each beat has one signal.** A round has five beats (set, think, commit, reveal, settle); each gets exactly one visual signal — and each is named in the live row's first line (§7, §8).
7. **One room.** Lobby, queue, match, result and profile are states of the same three objects, not pages. The board never leaves.
8. **Teach outside the room.** The rules are a page of their own (`/rules`), reached by `how to play ▸` from the lobby and final feet, the sign-in slip and the match `⋯` menu (a new tab, so a match is never interrupted). Nothing in the room teaches (amended 20 September 2026, spec 048; replaces the first-match sentences and `? rules`).
9. **Loss and win are stated once, in the same voice.** No confetti, no red. The result is stated on the match-over slip (§5.9) and, beneath it, in the ledger; the winner's name in their seat colour, `draw` in ink.

---

## 2. Colour

Eight values. Nothing else may appear on screen. Seven are the palette; the
eighth exists only because coral is not legible as small text.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#FFFDF7` | The only background. Field cells, bars, ledger, page. |
| `--ink` | `#0F1A24` | Letters, numerals, frames, rules that separate objects, running clock, primary action fill. |
| `--rule` | `#E6E2D6` | Hairlines inside objects (cell rules, table rows), empty portion of a lane, empty territory. |
| `--tint` | `#F4F1E8` | Background of the live row and other "current" rows. |
| `--muted` | `#5A6572` | Secondary mono labels, stopped clocks, sub-lines. Minimum for text; never lighter (5.7:1 on paper). |
| `--you` | `#147D7A` teal | Your seat: your letters in scored words, your bands (14% tint), your lane, your total, your ink square. |
| `--opp` | `#E4573D` coral | The opponent's seat, same uses — but only at 17px and above, or where it is not text. |
| `--opp-text` | `#C2402A` coral | The opponent's seat wherever it is **text below 17px**: ledger words, the numeral on a scored letter, the profile's best-word names. 5.1:1 on paper, where `--opp` is 3.4:1. |

Rules:
- Seat colours are **relative to the viewer** and resolved through one function (`getSeatColors(viewerSlot, slot)`). Never bind a colour to `player_a` / `player_b`.
- Seat colours at full strength for letters, lanes, totals and squares; at **14%** as the band tint of a settled word; at **30%** during a live reveal. No other alpha values.
- Coral as text below 17px uses `--opp-text`; teal needs no variant (4.9:1 on paper). `getSeatColors` returns both, so no caller decides. Decided 15 September 2026; it replaced two contrast exclusions in the axe suite.
- A letter shared by both seats' words is `--ink` at weight 700.
- No gradients, no shadows, no radii, no blur, no third accent. `border-radius` is `0` everywhere and stays there.
- A future round's numeral uses `#B9B4A6`: the ledger's row labels and, since spec 048, the rail's cells. This is the only exception to the eight values and appears in those two places only. Both are `aria-hidden` — the caption and the rail's own label carry the round — and both are the permitted exclusions from the automated contrast check.

Contrast: `--ink` on `--paper` 16:1; `--muted` on `--paper` 5.7:1; `--you` on `--paper` 4.9:1; `--opp` on `--paper` 3.4:1 (used only at ≥17px or for non-text marks; the coral total is 40px).

---

## 3. Type

Two families in the room. A text face may be used for long-form pages outside the game (help, about), never inside the room.

| Token | Family | Use |
| --- | --- | --- |
| `--font-board` | Zilla Slab (500, 600, 700; latin + latin-ext) | Every letter on the field (600), names (600), words in the ledger (600, 0.04em tracking), headings (600), the wordmark `wottle` (700, lowercase). |
| `--font-mono` | Red Hat Mono (400, 500, 600; latin + latin-ext) | Every numeral: clocks, totals, points, ratings, values. Labels: 11px, 0.12em tracking, uppercase. Tabular numerals on. |

Scale (desktop → phone): field letter 55% of cell height; value numeral `max(9px, 18% of cell height)`, hidden entirely below a 32px cell where 18% is unreadable — the cell's `aria-label` still carries the value (decided 15 September 2026); bar name 17 → 15; bar sub-line 11 → 10; clock 26 → 22; total 40 → 30; ledger words 14; ledger points 12; verdict 20; caption wordmark 16; profile name 28; profile rating 48.

Casing: the product name is always lowercase `wottle` in the wordmark; sentence case for sentences; mono labels uppercase. No italics anywhere in the room.

---

## 4. Space and layout

- 4px base. Bars are 60px (56px on phones); the gap between a bar and the field is 12px; the room gutter is 56px (≥1100px) or 40px (900–1100px); the ledger is 340px (≥1100px) or 260px (900–1100px).
- **Room grid**: `auto 340px`, the pair centred. Left column is the stack `bar / field / bar`; right column is the ledger, whose top rule aligns with the top bar's top edge and whose foot is flush with the bottom bar's bottom edge. The ledger is the height of the stack, never of the viewport: when the 720px cap or the width binds the stack, the room top-aligns at its 24px padding and the ledger keeps the stack's height. It is never stretched (amended 16 September 2026, P3).
- **Field size**: the largest square that fits after the two bars are placed: `min(availableHeight − 2×60 − 2×12 − 48, 720)`. Never below the fold; never scrolls; computed with a ResizeObserver, not viewport units.
- Below 900px: single column `bar / field / bar / live row`. The ledger shows only its caption, the live row and the territory bar; the live row is a button (`aria-expanded`) whose right cell reads `history ▸`.
- The sheet it opens sits **in flow beneath the live row** — it takes the space left in the ledger column and scrolls inside it. It is never fixed, never has a backdrop, and its top edge never rises above the bottom bar: nothing is placed over the field, on a phone least of all. Escape or `close` returns focus to the live row.
- At 390×844 the page itself does not scroll, with the sheet closed or open. The field is the full width less the room's 16px gutters (358px), so cells are 35px with the whole cell as hit target. Discrete controls in the sheet are ≥44px; the 35px cell is the grid's own floor and meets WCAG 2.5.8 (AA).
- Flush-left alignment everywhere; the only centred element is the clock in a bar.

---

## 5. Components

### 5.1 Field
A ruled grid of one hundred capitals. 1.5px `--ink` frame; 1px `--rule` between cells; flat `--paper` cells. **Turn frame** (spec 048): while the move is the viewer's to make, a 3px outline in `--you` is drawn inside the frame (`outline-offset: -3px`, so the geometry never moves); it returns to the ink rule once they have played. Signed out, the field is the frame and the rules with no letters (§5.9 sign-in). Letter centred in `--font-board` 600. Value numeral in the top-right gutter (`top:4%; right:6%`) in `--font-mono` 400, `--muted`; on a scored letter it takes the scorer's seat colour (`--opp-text` for the opponent, as it is text under 17px); on a picked letter it is `--ink` 500; on a shared letter it is `--ink` 400 (amended 16 September 2026, P4).

Letter states (each has exactly one mark):
| State | Mark |
| --- | --- |
| free | `--ink` letter, muted numeral |
| picked (yours) | your seat colour, `scale(1.08)`, inset 2px `--ink` ring, numeral `--ink` |
| previewed (both letters) | exchanged in place, 2px dotted `--ink` ring |
| pinned (committed, either seat) | seat colour, 2px dashed ring in that colour, no fill |
| scored / frozen | seat colour letter inside that seat's band |
| shared | `--ink` 700 inside two bands; numeral `--ink` too — never the seat of whichever record was resolved last |
| illegal pick | 300ms shake in its own colour; live row states the fact |
| keyboard focus | 2px `--ink` outline at −4px offset |

### 5.2 Word band
One band per scored word record. 14% tint of the scorer's seat colour; square ends aligned to the cell grid; inset 20% of a cell across its short axis (leaves the numeral gutter clean) and 5% along its long axis (never enters the neighbouring cell). A 1.5px chevron in the seat colour, opened to about 150° (arm depth 9% of a cell across the band's height), sits at the end where reading **begins**: left edge pointing right (ltr), right edge pointing left (rtl), top pointing down (ttb), bottom pointing up (btt). A run valid in both directions scores **once**, read forward, so every band carries exactly one chevron (rules §3.1, decided 14 September 2026). Bands of the same seat never touch end to end (the whole-run rule guarantees it). Crossings show both bands.

### 5.3 Player bar
60px, `1fr auto 1fr`. Left: 12px square in the seat colour (1.5px dashed outline when the seat is empty) + name + one-line mono sub-line (`1204 · you`, `1191 · opponent`, `1191 → 1203 · +12 · wins`, `reconnecting · 0:42 left`, `ranked · 0:07 · cancel ▸`). During a live round the sub-line carries the turn as a suffix (spec 048): yours `· your move` (in `--you`, weight 600) or `· played ●`; theirs `· thinking` or `· played ●`; `· 0:00` when your clock is spent. Centre: clock mm:ss, `--ink` 500 while running, `--muted` 400 when stopped. Right: total in the seat colour, or the primary action when the seat is empty. The bar's edge nearest the field is the **clock lane**: 4px; full width = 5:00 (`aria-valuemax=300`); filled part in the seat colour, rest `--rule`. Under 1:00: 8px and blinking at 1Hz (colour only). Disconnected: 6px/4px dashed pattern in the seat colour, held. The opponent's bar is always on top, yours always at the bottom.

### 5.4 Ledger
1.5px `--ink` top rule; height = the stack's height. Caption line (wordmark left, mono context right) → **round rail** (spec 048: ten cells across the ledger's width, 26px; rounds played filled `--ink` with paper numerals, the current one `--tint` with a 2px `--ink` frame and a 600 numeral, the rest outlined in `--rule` with `#B9B4A6` numerals; all ten filled when the match is over; shown in match, final and queue; on a phone it stays between the caption and the live row when the ledger is collapsed; `role="img"` named `round 4 of 10`, its cells hidden) → column header (`■ Birna · you` / `■ Kári`; its rule is `--ink`, the one ink rule inside the ledger) → rounds table (one grid row per round, `34px 1fr 1fr` inside it; the rule between rounds is `--rule` and belongs to the row, so it is one continuous line; ten rows sharing the height equally; round labels inset 6px; words in seat colour joined by ` · `, wrapping; round total pinned top-right; future rows show only their label) → territory bar and counts → hint line (match-level lines only, hidden when empty) → notices → foot (`how to play ▸` left in the lobby and final; `result ▸` in the final once the slip has been lifted; the state's actions and `⋯` right). The **live row** (current round) is the grid row itself with `--tint` background and a 3px `--ink` left rule; it carries two lines (amended 20 September 2026, spec 048): line 1 is the round's beat in `--font-board` 600 17px (`round 4 · your move`, `played · waiting for Kári`, `resolving round 4`, `round 4 scored`, `out of time · waiting for Kári`); line 2, in `--muted` mono, is the field's instruction while it is your move (`pick a letter`, `picking · T (2) · tap a second letter`, `24 · hestur · tap again to play · esc cancels`, `frozen · Kári R2 · pick another` for two seconds) or the beat's fact otherwise (`Kári is thinking · their clock runs`, `both played · scoring`, `you +12 · Kári +0 · round 5 opens in 1`). After a reveal the scored row **holds** as the tinted row for 1.2s (the **settle hold**) before the next live row opens; the field takes no pick meanwhile. Notices (a challenge, a pick cleared, transport lines) are rendered as live-row-styled lines; the resign confirmation, the claim and the rematch request are on the slip (§5.9). Hovering a row lights its bands on the field. The ledger never scrolls; if a row would exceed three lines, rounds older than the last three collapse to totals.

### 5.5 Primary action
Text in `--font-mono` 12px uppercase 0.12em on an `--ink` fill with `--paper` text, `10px 14px` padding, square, followed by ` ▸`. One per screen at most (`play ▸`, `play ranked ▸`). Secondary actions are mono uppercase text with ` ▸` in `--ink` (`challenge ▸`, `rematch ▸`, `cancel ▸`). Destructive actions have no colour of their own; they are a confirmation line in the live row (`resign the match? · yes, resign ▸ · no`).

### 5.6 Tables (directory, matches, best words)
Same grammar as the ledger: ruled rows (1px `--rule`), first column in `--font-board` 600, numbers in `--font-mono` 12px, actions as mono uppercase text with ` ▸`. No cards, no avatars, no skeletons; while loading, rows show `—`.

### 5.7 Inputs
One input exists: the name field on the landing bar. Text in `--font-board` 600 17px on a 1.5px `--ink` underline; placeholder `--muted`. No boxes, no radii.

### 5.8 Chart (profile)
A `<svg>` polyline, 1.5px in the seat colour, over three 1px `--rule` gridlines, framed by 1px `--ink` rules on the left and bottom, mono axis labels. No area fill, no markers, no tooltip.

### 5.9 Slip
The one element ever laid over the field (spec 048, 20 September 2026). A `--paper` panel with a 1.5px `--ink` frame, no radius, no shadow, padding 28/28/24 (20 on phones), 420px wide (440 for the result; `min(300px, 100%)` on phones), centred over the field; the field and its bands beneath fade to 32% — the one opacity change the room makes. `role="dialog" aria-modal="true"`, focus trapped, the headline announced once assertively, focus restored when it lifts; Escape is the kind's cancel. Exactly four kinds, ranked so a higher one replaces a lower one and is never replaced by it — match over > claim the win > resign > sign in:

| Kind | Label line | Headline | Body | Actions (first is primary) |
| --- | --- | --- | --- | --- |
| sign in | — | `wottle` (28px) + `two players · one field · Icelandic words` | the name input (§5.7) | `play ▸` · `no account needed` · `new here · how to play ▸` |
| resign | `round 4 of 10 · 4:12 on your clock` | `Resign the match?` | `Kári wins · your rating moves as a loss` | `yes, resign ▸` · `keep playing ▸` |
| claim the win | `round 4 of 10` | `Kári is gone` | `0:00 left to reconnect` | `claim the win ▸` · `keep waiting ▸` |
| match over | `match over · 10 rounds · 18:50` (the label counts the match; it never repeats why it ended) | `Kári wins` in the winner's seat colour, `draw` in ink | `170 – 127` (40px mono, each total in its seat's ink), the detail line, both rating lines with seat squares | `rematch ▸` · `new opponent ▸` · `review the field ▸` · `lobby`; a rematch request rewrites the action line to `Kári asks for a rematch · accept ▸ · decline` |

The match-over slip lands 600ms after the final reveal has settled and held (at once on a reload with nothing to reveal); `review the field ▸` lifts it and `result ▸` in the ledger foot brings it back.

**A forced win.** A resignation, a disconnect past the window or a spent clock ends the match without the totals naming a winner. The server's winner decides the headline and the bars, and the detail line says what ended it — `Kári left`, `Kári resigned`, `Kári ran out of time` — in place of `by 43 points · …`, which beside a rating change would be a lie. It is said once: the label line counts the match and nothing more (amended 20 September 2026, after a live match read `match over · 1 rounds · 0:00 · resigned` for a player who had merely disconnected). The sign-in slip is up whenever there is no session; the letters land only after a name.

---

## 6. Motion

Motion is a state change, not a performance. Durations: ring/pin changes 120ms; letter exchange 150ms (preview **and** commit — the two letters travel to each other's places, they never teleport); band draw 400ms per word, staggered 120ms; total count-up 400ms; pin fade 200ms; found-opponent name write 200ms; lane blink 1Hz colour-only; setting-field letters ~100ms apart. Easing `cubic-bezier(0.2,0,0.2,1)`. Geometry does not animate except the two listed (preview exchange, picked scale); the turn frame is an outline. The slip (§5.9) fades in and out with the field over 150ms and is the only thing ever placed over the field. The settle hold is 1200ms and is a reading pause, not motion: it stays under `prefers-reduced-motion`, where everything else is 0ms and end-state only and the lane holds solid instead of blinking.

Sounds: `tile-select` on pick, `valid-swap` on commit (with haptic where available), band-draw tick on reveal. Nothing on cancel or error. Sound is toggled from the `⋯` menu.

---

## 7. The five beats

| Beat | Field | Bars | Ledger |
| --- | --- | --- | --- |
| Set | untouched; the turn frame in `--you` | both lanes resume; `· your move` / `· thinking` | new row opens: `round 4 · your move` over `pick a letter`; the rail moves |
| Think | pick / preview marks; opponent pins on broadcast | your lane drains; theirs stops when they play (`· played ●`) | `round 4 · your move` over `picking · T (2) · tap a second letter` → `24 · hestur · tap again to play · esc cancels` |
| Commit | your two letters pin; the frame returns to ink | your lane stops; `· played ●` / `· thinking` | `played · waiting for Kári` over `Kári is thinking · their clock runs` |
| Reveal | bands draw along each word (30% tint); no pick | totals count up | `resolving round 4` over `both played · scoring`, then words and points written into the row |
| Settle | pins fade; tint settles to 14%; no pick for 1.2s | — | the scored row holds: `round 4 scored` over `you +12 · Kári +0 · round 5 opens in 1`; then territory updates and the next row opens |

---

## 8. Copy

- Sentence case for sentences; mono uppercase for labels; the product name lowercase `wottle`.
- One idea per line. State the fact, then the next action: `frozen · Kári R2 · pick another`; `No runs yet. Start one from the lobby.`
- No exclamation marks. No apologies. No metaphors about speed, power or brains. Never personify the system.
- Numbers are numerals with their unit or context: `6:45 · running`, `+34`, `1191 → 1203 · +12`.
- Fixed strings (`lib/constants/copy.ts` is the source of truth): `play ranked ▸` · `No opponent yet` · `ranked · about 0:10 to find one` · `Finding an opponent` · `ranked · 0:07 · cancel ▸` · `round 1 in 3` · `sign in to set the field` · `two players · one field · Icelandic words` · `no account needed` · `new here · how to play ▸` · `round 4 · your move` · `played · waiting for <name>` · `resolving round 4` · `round 4 scored` · `out of time · waiting for <name>` · `pick a letter` · `picking · T (2) · tap a second letter` · `previewing` · `24 · hestur` · `0 · no word` · `tap again to play · esc cancels` · `frozen · <name> R<n> · pick another` · `<name> is thinking · their clock runs` · `both played · scoring` · `you +12 · <name> +0 · round 5 opens in 1` · `your clock is spent · rounds pass` · `your move` · `played ●` · `thinking` · `reconnecting · 0:42 left` · `Resign the match?` · `<name> wins · your rating moves as a loss` · `yes, resign ▸` · `keep playing ▸` · `<name> is gone` · `0:00 left to reconnect` · `claim the win ▸` · `keep waiting ▸` · `match over · 10 rounds · 18:50` · `<name> wins` · `draw` · `<name> asks for a rematch · accept ▸ · decline` · `<name> wins 170–127` · `by 43 points · 10 words to 8 · territory 32–25` · `<name> resigned` · `<name> left` · `<name> ran out of time` · `rating pending` · `rematch ▸` · `new opponent ▸` · `review the field ▸` · `result ▸` · `how to play ▸` · `hover a row to see its words` · `history ▸` · `that match does not exist` · `here now`. Retired 20 September 2026 (spec 048): `? rules`, the first-match sentences, `resign the match? · yes, resign ▸ · no`, `<name> is gone · claim the win ▸`, every string that said unranked.
- Ledger context strings: `lobby · 4 here` · `10 rounds · 5:00 clocks` · `round 4 of 10` · `final · 10 of 10 · 18:50`.
- Live-row states (amended 20 September 2026, spec 048; replaces the 16 September table). Line 1 is the round's beat, line 2 the field's instruction or the beat's fact:

  | Beat | Line 1 | Line 2 | Field frame | Your sub-line | Their sub-line |
  | --- | --- | --- | --- | --- | --- |
  | your move, idle | `round 4 · your move` | `pick a letter` | `--you` | `· your move` | `· thinking` |
  | one letter picked | `round 4 · your move` | `picking · T (2) · tap a second letter` | `--you` | `· your move` | `· thinking` |
  | previewing | `round 4 · your move` | `previewing · tap again to play · esc cancels` / `24 · hestur · tap again to play · esc cancels` | `--you` | `· your move` | `· thinking` |
  | illegal pick (two seconds) | `round 4 · your move` | `frozen · Kári R2 · pick another` | `--you` | `· your move` | `· thinking` |
  | opponent played, you have not | `round 4 · your move` | as above | `--you` | `· your move` | `· played ●` |
  | you played | `played · waiting for Kári` | `Kári is thinking · their clock runs` | ink | `· played ●` | `· thinking` |
  | resolving (server, or the reveal drawing) | `resolving round 4` | `both played · scoring` | ink | — | — |
  | scored (the 1.2s settle hold) | `round 4 scored` | `you +12 · Kári +0 · round 5 opens in 1` | ink | — | — |
  | out of time | `out of time · waiting for Kári` | `your clock is spent · rounds pass` | ink | `· 0:00` | `· thinking` |

---

## 9. Accessibility

- Every cell: `role="gridcell"`, `aria-label="row 8, column F, T, value 2, free"` (state word last: free / picked / previewed / pinned / frozen by Kári). Coordinates live only here; they are never printed.
- Keyboard: arrows move focus on the field; Space picks or previews; Enter commits; Esc cancels (and is the slip's cancel); `M` toggles sound. The `?` hotkey retired with the in-room rules (spec 048).
- Slip: `role="dialog" aria-modal="true"`, labelled by its headline; focus moves to its primary action and returns to the opener when it lifts; the headline is inside a `role="status" aria-live="assertive"` region so it is announced once.
- Lanes: `role="progressbar"`, `aria-valuemin=0 aria-valuemax=600 aria-valuenow=<seconds>`, `aria-valuetext="6:45 remaining, running"`.
- Live row: `aria-live="polite"` (line 1 announces each beat once); verdict: `aria-live="assertive"` once. The round rail is one `role="img"` named `round 4 of 10`; its cells are hidden.
- Colour is never the only carrier: seat is also position (top/bottom), the square before the name, and the `you` / `opponent` word in the sub-line; band direction is the chevron; clock state is the numeral's weight and the lane's motion.
- Contrast floors: text ≥ 4.5:1 (`--ink`, `--muted`, `--you`); coral text only ≥ 17px.
- Reduced motion honoured everywhere (§6).

---

## 10. Do not

- Do not add a colour, radius, shadow, gradient, blur or font outside §2–§3.
- Do not place anything over the field but the slip (§5.9): no banners, toasts, other overlays or confetti, and no slip for anything but its four kinds.
- Do not add a card. If information needs a container, it is a ruled row in the ledger.
- Do not show a number outside the bars and the ledger (letter values on the field are the one exception).
- Do not add an avatar, an icon set, an illustration or an emoji. The ink square and the chevron are the only marks.
- Do not bind colour to player slots; bind it to seats.
- Do not add a page. Add a room state. The rules page is the one page outside the room, and it teaches; it never plays.
