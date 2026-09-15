# Wottle Design System — Field & Ledger

Version 1.0 · derived from `Wottle UX Audit.dc.html` (sections 04–09). Binding for every screen and component in Wottle. When this document and the code disagree, the code is wrong.

Wottle is a two-player Icelandic word duel. Its look comes from the game's own material: a printed word-search page, set in a slab serif so Þ, Ð, Æ and Ö carry weight, marked up by two players with two inks. Paper and ink are the system; teal and coral are the seats. Nothing else.

---

## 1. Principles

1. **The field is the game.** Nothing covers it, nothing competes with it, nothing on it that is not a letter or a state of a letter. What frames it above and below belongs to the two players and to nothing else.
2. **Three homes for every fact.** A fact about a letter lives on the field. A fact about one player (name, rating, clock, total) lives in that player's bar. A fact about the match (round, words, territory, controls) lives in the ledger. If a proposed element has no home, it is not added.
3. **Show words, not tiles.** Territory is stored per tile and earned per word. Draw the word.
4. **Two budgets, one scale.** Both clocks are match-long budgets; draw them as two lengths on one axis so "who can afford to think" is a glance.
5. **Colour is identity.** Teal is you, coral is the opponent, in every match on every device. The system itself speaks only in ink and paper; alarm is weight and motion, never a third hue.
6. **Each beat has one signal.** A round has five beats (set, think, commit, reveal, settle); each gets exactly one visual signal.
7. **One room.** Lobby, queue, match, result and profile are states of the same three objects, not pages. The board never leaves.
8. **Teach once, then leave.** Rules are three sentences in the live row on the first match and a `?` in the ledger foot afterwards.
9. **Loss and win are stated once, in the same voice.** No confetti, no red, no modal.

---

## 2. Colour

Seven values. Nothing else may appear on screen.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#FFFDF7` | The only background. Field cells, bars, ledger, page. |
| `--ink` | `#0F1A24` | Letters, numerals, frames, rules that separate objects, running clock, primary action fill. |
| `--rule` | `#E6E2D6` | Hairlines inside objects (cell rules, table rows), empty portion of a lane, empty territory. |
| `--tint` | `#F4F1E8` | Background of the live row and other "current" rows. |
| `--muted` | `#5A6572` | Secondary mono labels, stopped clocks, sub-lines. Minimum for text; never lighter (5.7:1 on paper). |
| `--you` | `#147D7A` teal | Your seat: your letters in scored words, your bands (14% tint), your lane, your total, your ink square. |
| `--opp` | `#E4573D` coral | The opponent's seat, same uses. |

Rules:
- Seat colours are **relative to the viewer** and resolved through one function (`getSeatColors(viewerSlot, slot)`). Never bind a colour to `player_a` / `player_b`.
- Seat colours at full strength for letters, numerals on scored letters, lanes, totals and squares; at **14%** as the band tint of a settled word; at **30%** during a live reveal. No other alpha values.
- A letter shared by both seats' words is `--ink` at weight 700.
- No gradients, no shadows, no radii, no blur, no third accent. `border-radius` is `0` everywhere and stays there.
- Future-round labels in the ledger use `#B9B4A6`; this is the only exception to the seven values and appears only there.

Contrast: `--ink` on `--paper` 16:1; `--muted` on `--paper` 5.7:1; `--you` on `--paper` 4.9:1; `--opp` on `--paper` 3.4:1 (used only at ≥17px or for non-text marks; the coral total is 40px).

---

## 3. Type

Two families in the room. A text face may be used for long-form pages outside the game (help, about), never inside the room.

| Token | Family | Use |
| --- | --- | --- |
| `--font-board` | Zilla Slab (500, 600, 700; latin + latin-ext) | Every letter on the field (600), names (600), words in the ledger (600, 0.04em tracking), headings (600), the wordmark `wottle` (700, lowercase). |
| `--font-mono` | Red Hat Mono (400, 500, 600; latin + latin-ext) | Every numeral: clocks, totals, points, ratings, values. Labels: 11px, 0.12em tracking, uppercase. Tabular numerals on. |

Scale (desktop → phone): field letter 55% of cell height; value numeral 18% of cell height; bar name 17 → 15; bar sub-line 11 → 10; clock 26 → 22; total 40 → 30; ledger words 14; ledger points 12; verdict 20; caption wordmark 16; profile name 28; profile rating 48.

Casing: the product name is always lowercase `wottle` in the wordmark; sentence case for sentences; mono labels uppercase. No italics anywhere in the room.

---

## 4. Space and layout

- 4px base. Bars are 60px (56px on phones); the gap between a bar and the field is 12px; the room gutter is 56px (≥1100px) or 40px (900–1100px); the ledger is 340px (≥1100px) or 260px (900–1100px).
- **Room grid**: `minmax(0,1fr) 340px`. Left column is the stack `bar / field / bar`; right column is the ledger, whose top rule aligns with the top bar's top edge and whose foot is flush with the bottom bar's bottom edge.
- **Field size**: the largest square that fits after the two bars are placed: `min(availableHeight − 2×60 − 2×12 − 48, 720)`. Never below the fold; never scrolls; computed with a ResizeObserver, not viewport units.
- Below 900px: single column `bar / field / bar / live row`; the rest of the ledger opens as a sheet from the live row. The field is full width; cells are ≥37px with the whole cell as hit target (≥44px effective on 390px phones).
- Flush-left alignment everywhere; the only centred element is the clock in a bar.

---

## 5. Components

### 5.1 Field
A ruled grid of one hundred capitals. 1.5px `--ink` frame; 1px `--rule` between cells; flat `--paper` cells. Letter centred in `--font-board` 600. Value numeral in the top-right gutter (`top:4%; right:6%`) in `--font-mono` 400, `--muted`; on a scored letter it takes the scorer's seat colour; on a picked letter it is `--ink` 500.

Letter states (each has exactly one mark):
| State | Mark |
| --- | --- |
| free | `--ink` letter, muted numeral |
| picked (yours) | your seat colour, `scale(1.08)`, inset 2px `--ink` ring, numeral `--ink` |
| previewed (both letters) | exchanged in place, 2px dotted `--ink` ring |
| pinned (committed, either seat) | seat colour, 2px dashed ring in that colour, no fill |
| scored / frozen | seat colour letter inside that seat's band |
| shared | `--ink` 700 inside two bands |
| illegal pick | 300ms shake in its own colour; live row states the fact |
| keyboard focus | 2px `--ink` outline at −4px offset |

### 5.2 Word band
One band per scored word record. 14% tint of the scorer's seat colour; square ends aligned to the cell grid; inset 20% of a cell across its short axis (leaves the numeral gutter clean) and 5% along its long axis (never enters the neighbouring cell). A 1.5px chevron in the seat colour, opened to about 150° (arm depth 9% of a cell across the band's height), sits at the end where reading **begins**: left edge pointing right (ltr), right edge pointing left (rtl), top pointing down (ttb), bottom pointing up (btt). A run valid in both directions carries a chevron at each end. Bands of the same seat never touch end to end (the whole-run rule guarantees it). Crossings show both bands.

### 5.3 Player bar
60px, `1fr auto 1fr`. Left: 12px square in the seat colour (1.5px dashed outline when the seat is empty) + name + one-line mono sub-line (`1204 · you`, `1191 · opponent`, `1191 → 1203 · +12 · wins`, `reconnecting · 0:42 left`, `ranked · 0:07 · cancel ▸`). Centre: clock mm:ss, `--ink` 500 while running, `--muted` 400 when stopped. Right: total in the seat colour, or the primary action when the seat is empty. The bar's edge nearest the field is the **clock lane**: 4px; full width = 10:00; filled part in the seat colour, rest `--rule`. Under 1:00: 8px and blinking at 1Hz (colour only). Disconnected: 6px/4px dashed pattern in the seat colour, held. The opponent's bar is always on top, yours always at the bottom.

### 5.4 Ledger
1.5px `--ink` top rule; height = the stack's height. Caption line (wordmark left, mono context right) → column header (`■ Birna · you` / `■ Kári`) → rounds table (`34px 1fr 1fr`, ten rows sharing the height equally; words in seat colour joined by ` · `, wrapping; round total pinned top-right; future rows show only their label) → territory bar and counts → hint line → notices → foot (`? rules` left, actions and `⋯` right). The **live row** (current round) has `--tint` background and a 3px `--ink` left rule and carries state text: `picking · T (2)`, `played ●`, then the words as they land. Notices (rematch request, resign confirmation, first-match sentences, illegal pick) are rendered as live-row-styled lines; they never open a dialog. Hovering a row lights its bands on the field. The ledger never scrolls; if a row would exceed three lines, rounds older than the last three collapse to totals.

### 5.5 Primary action
Text in `--font-mono` 12px uppercase 0.12em on an `--ink` fill with `--paper` text, `10px 14px` padding, square, followed by ` ▸`. One per screen at most (`play ▸`, `play ranked ▸`). Secondary actions are mono uppercase text with ` ▸` in `--ink` (`challenge ▸`, `rematch ▸`, `cancel ▸`). Destructive actions have no colour of their own; they are a confirmation line in the live row (`resign the match? · yes, resign ▸ · no`).

### 5.6 Tables (directory, matches, best words)
Same grammar as the ledger: ruled rows (1px `--rule`), first column in `--font-board` 600, numbers in `--font-mono` 12px, actions as mono uppercase text with ` ▸`. No cards, no avatars, no skeletons; while loading, rows show `—`.

### 5.7 Inputs
One input exists: the name field on the landing bar. Text in `--font-board` 600 17px on a 1.5px `--ink` underline; placeholder `--muted`. No boxes, no radii.

### 5.8 Chart (profile)
A `<svg>` polyline, 1.5px in the seat colour, over three 1px `--rule` gridlines, framed by 1px `--ink` rules on the left and bottom, mono axis labels. No area fill, no markers, no tooltip.

---

## 6. Motion

Motion is a state change, not a performance. Durations: ring/pin changes 120ms; preview exchange 150ms; band draw 400ms per word, staggered 120ms; total count-up 400ms; pin fade 200ms; found-opponent name write 200ms; lane blink 1Hz colour-only; setting-field letters ~100ms apart. Easing `cubic-bezier(0.2,0,0.2,1)`. Geometry does not animate except the two listed (preview exchange, picked scale). Nothing is ever placed over the field. Under `prefers-reduced-motion`, everything is 0ms and end-state only; the lane holds solid instead of blinking.

Sounds: `tile-select` on pick, `valid-swap` on commit (with haptic where available), band-draw tick on reveal. Nothing on cancel or error. Sound is toggled from the `⋯` menu.

---

## 7. The five beats

| Beat | Field | Bars | Ledger |
| --- | --- | --- | --- |
| Set | untouched | both lanes resume | new row opens with the round label |
| Think | pick / preview marks; opponent pins on broadcast | your lane drains; theirs stops when they play | `picking · T (2)` / `played ●`; preview total in the hint line |
| Commit | your two letters pin | your lane stops | `played` |
| Reveal | bands draw along each word (30% tint) | totals count up | words and points written into the row |
| Settle | pins fade; tint settles to 14% | — | territory updates; next row opens |

---

## 8. Copy

- Sentence case for sentences; mono uppercase for labels; the product name lowercase `wottle`.
- One idea per line. State the fact, then the next action: `frozen · Kári R2 · pick another`; `No runs yet. Start one from the lobby.`
- No exclamation marks. No apologies. No metaphors about speed, power or brains. Never personify the system.
- Numbers are numerals with their unit or context: `6:45 · running`, `+34`, `1191 → 1203 · +12`.
- Fixed strings: `play ranked ▸` · `No opponent yet` · `ranked · about 0:10 to find one` · `Finding an opponent` · `ranked · 0:07 · cancel ▸` · `round 1 in 3` · `picking · T (2)` · `played ●` · `tap a second letter` · `tap again to play` · `esc cancels` · `frozen · <name> R<n> · pick another` · `reconnecting · 0:42 left` · `<name> asks for a rematch · accept ▸ · decline` · `resign the match? · yes, resign ▸ · no` · `<name> wins 170–127` · `by 43 points · 10 words to 8 · territory 32–25` · `rating pending` · `hover a row to see its words` · first match: `Swap two letters. Words of three or more score and freeze in your ink. Ten rounds; your clock holds ten minutes for all of them.`
- Ledger context strings: `lobby · 4 here` · `ranked · 10 rounds · 10:00 clocks` · `ranked · round 4 of 10` · `final · 10 rounds · 18:50`.

---

## 9. Accessibility

- Every cell: `role="gridcell"`, `aria-label="row 8, column F, T, value 2, free"` (state word last: free / picked / previewed / pinned / frozen by Kári). Coordinates live only here; they are never printed.
- Keyboard: arrows move focus on the field; Space picks or previews; Enter commits; Esc cancels; `?` opens rules; `M` toggles sound.
- Lanes: `role="progressbar"`, `aria-valuemin=0 aria-valuemax=600 aria-valuenow=<seconds>`, `aria-valuetext="6:45 remaining, running"`.
- Live row: `aria-live="polite"`; verdict: `aria-live="assertive"` once.
- Colour is never the only carrier: seat is also position (top/bottom), the square before the name, and the `you` / `opponent` word in the sub-line; band direction is the chevron; clock state is the numeral's weight and the lane's motion.
- Contrast floors: text ≥ 4.5:1 (`--ink`, `--muted`, `--you`); coral text only ≥ 17px.
- Reduced motion honoured everywhere (§6).

---

## 10. Do not

- Do not add a colour, radius, shadow, gradient, blur or font outside §2–§3.
- Do not place anything over the field: no modals, banners, toasts, overlays, confetti.
- Do not add a card. If information needs a container, it is a ruled row in the ledger.
- Do not show a number outside the bars and the ledger (letter values on the field are the one exception).
- Do not add an avatar, an icon set, an illustration or an emoji. The ink square and the chevron are the only marks.
- Do not bind colour to player slots; bind it to seats.
- Do not add a page. Add a room state.
