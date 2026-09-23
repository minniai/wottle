# Feature Specification: The scoreboard, one grid, the new colours and the capitalised brand

**Feature Branch**: `068-match-scoreboard`
**Created**: 2026-09-23
**Status**: Draft
**Input**: Stage 2 of the game flow redesign. Source of truth: `docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md`: C4 (match), C6 (resign slip), C8 (disconnect and end early), F3 (phone match), F8 (phone slips), §8 design-system amendments 5, 6, 8, 9, 11, 12 and 14, and the two current amendments at the end of the file, "the scoreboard" and "the opponent's colour and the penalty red". The earlier clock amendments (the ledger clock, the match rail, the boxed clock) are superseded and are not built. Owner decisions in §10 are settled and are not re-asked here. Design canvas https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo, artboards MatchRail (the scoreboard sheet), Match, MatchLastMinute, ResignSlip, Disconnect, PhoneMatch and PhoneMatchShort.

## Context

During a match the player reads three things while looking at the letters: how much time is left, how many moves each side has left, and the score. Today those facts are in three places. The clock is in the ledger caption, each player's moves are in a lane in a bar above or below the field, and each total is at the end of that bar. Nothing lets a player compare time left with moves left, so pace has to be worked out in their head.

This stage puts the clock and both players into one **scoreboard** above the board. Its three rows share one ten-column track, so time left and moves left can be compared straight down a column. The player bars around the field go away. The ledger is laid on the same grid, so every horizontal edge on the right is level with one on the left.

The stage also:
- changes the opponent's colour from coral to burnished terracotta;
- adds one crimson that marks points lost and nothing else;
- capitalises the brand everywhere (Orðusta, Wottle);
- brings in the match-room details from C4, C6 and C8 that the scoreboard needs to be read correctly: the pace, the missed beat, the stakes line, the last-moved tick, and the gone and offline states.

Nothing on the server changes. Every new line is derived from match state the room already receives.

## Clarifications

### Session 2026-09-23

- Q: Which room states draw the scoreboard, given that the table, lobby, result and review screens are out of scope? → A: The match states only (starting, live, match over as on the MatchRail sheet); the lobby, queue and profile keep their bars until their own stage.
- Q: How does the one grid behave below 1440×900, where a 713px field does not fit? → A: The cell is a whole pixel count, floor((height left after the scoreboard, gaps and margins) ÷ 10) capped at 71; the field is 10 × cell, the ledger's move rows equal the cell, and the scoreboard rows stay 40px.
- Q: The resign slip's `· −9` needs each player's K-factor, which the room does not receive; show it? → A: No, not in this stage. The body stays `Kári wins · your rating moves as a loss`; the number arrives with the stakes in the table stage (C1, S3).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read time, moves and score in one place (Priority: P1)

A player in a live match looks above the board and sees one box:
- **Row 1, the match clock:** its label, ten blocks on a shared track and the numeral.
- **Row 2, the opponent:** their square and name, their sub-line, their ten moves on the same track, and their total.
- **Row 3, the player themselves:** the same parts, in their own seat colour.

Reading down any column compares time left with moves left.

**Why this priority**: This is the stage's reason to exist. It replaces the bars and the ledger clock. Every other story sits on this layout.

**Independent Test**: Render the `idle` fixture (Birna 3:12, move 4 of 10, total 44; Kári 6 of 10, total 34) at 1440×900. Check that one box holds exactly three rows in the order clock, opponent, you. Check that no player bar is drawn above or below the field, and that the ledger caption holds no clock.

**Acceptance Scenarios**:

1. **Given** a match at 3:12 with the move yours, **When** the room renders, **Then** row 1 reads the pace `≈27s a move` (192s ÷ 7 moves left, rounded), the track shows 6 full blocks and 3 of 6 ticks in the seventh (⌈192 ÷ 5⌉ = 39 ticks), and the numeral reads `3:12`.
2. **Given** the move is not yours, **When** the room renders, **Then** row 1's label reads `match clock` / `leikklukka`.
3. **Given** Kári has played 6 of 10, **When** the room renders, **Then** row 2's track shows 4 filled move segments on the left and 6 empty on the right, row 2's sub-line reads `1265 · 6 of 10 · playing` (only your own row names its seat), and his total `34` is in the right-hand column in `--opp`.
4. **Given** it is Birna's move 4, **When** the room renders, **Then** row 3's sub-line reads `1310 · you · move 4 of 10` in `--you` and her total is `44`.
5. **Given** one of Birna's moves is in flight, **When** the room renders, **Then** its segment on row 3 shows at 30%.
6. **Given** the clock passes a 5s boundary, **When** the next second renders, **Then** exactly one tick empties from the right of the clock track, and the numeral steps every second.
7. **Given** the room is in the `starting` state (`starts in 3·2·1`), **When** it renders, **Then** the clock row fills from left to right during the count (under reduced motion it shows the full state at once), and both players' sub-lines read `ready`.

---

### User Story 2 - Urgency without blinking (Priority: P1)

As time runs out, the scoreboard gets heavier. Nothing ever flashes. A player who has fallen a full block behind is told so in words.

**Why this priority**: Spec 050's last-15-seconds inverted flash is retired, because blinking fails WCAG 2.2.2 and pulls the eye off the field. This must ship in the same stage that retires the ledger clock.

**Independent Test**: Render `low-clock` (0:48) and `last-seconds` (0:12) and compare them with the MatchLastMinute artboard. With the page recorded for 3 seconds, check that no element changes colour or background other than the numeral stepping and ticks emptying.

**Acceptance Scenarios**:

1. **Given** more than 1:00 is left, **When** the clock row renders, **Then** it has a `--paper` ground, `--muted` ticks and a numeral at weight 500.
2. **Given** under 1:00 is left, **When** the clock row renders, **Then** it takes `--tint`, its ticks turn `--ink` and the numeral goes to weight 700. Nothing blinks.
3. **Given** the last 15 seconds, **When** the clock row renders, **Then** the label reads `last 12s` in `--ink` 600. The numeral stepping is the only motion.
4. **Given** 0:00, **When** the clock row renders, **Then** the track is empty and the label reads `time`.
5. **Given** Birna has 3 moves left and 48s (1.6 blocks), **When** her row renders, **Then** her sub-line reads `1310 · move 8 · behind pace` in `--you`. Behind pace means she is short by a full block or more: moves left − (seconds left ÷ 30) ≥ 1.
6. **Given** Birna has 7 moves left and 3:12 (6.4 blocks), **When** her row renders, **Then** no `behind pace` appears.
7. **Given** reduced motion, **When** the clock runs, **Then** the numeral and ticks still step once a second, because time is not motion.

---

### User Story 3 - The board and the ledger on one grid (Priority: P1)

The ledger's rows are level with the scoreboard's rows and with the board's rows. The eye can run straight across from a board row to the ledger row beside it.

**Why this priority**: The scoreboard changes the column's heights. If the ledger is not realigned, its bands no longer match anything on the left.

**Independent Test**: At 1440×900, measure the rendered top edge of each ledger band against the left column. Each must be level to within 1px.

**Acceptance Scenarios**:

1. **Given** a desktop viewport of 1440×900, **When** a match renders:
   - **Then** the field is 713px square outside, ten cells of exactly 71px inside its 1.5px frame;
   - the scoreboard is 40px per row above it;
   - there is a 12px gap between the box and the field;
   - the stack starts at y=24.
2. **Given** the same viewport, **When** the ledger renders, **Then** its first three rows mirror the scoreboard's:
   - row 1: the wordmark, context and `⋯`;
   - row 2: territory, or the state's own line;
   - row 3: the face-off header (`Birna · you │ move │ Kári`), whose 1.5px `--ink` rule is level with the box's bottom border.
3. **Given** the same viewport, **When** the ledger's move rows render, **Then** there are ten rows of 71px after the same 12px gap, each rule level with a row boundary of the board. The live row is one of them.
4. **Given** 1280×800, **When** the room renders, **Then** the cell is a whole pixel count (floor of the available height ÷ 10, capped at 71), the field is 10 cells, each ledger move row equals the cell, the scoreboard rows stay 40px, every row is level to within 1px, and nothing scrolls.

---

### User Story 4 - The phone match (Priority: P1)

On a phone the scoreboard sits across the top at the field's width. The field sits under it, and the ledger block and the pinned foot sit below the field.

**Why this priority**: Phones are the main playtest device, and the bars are also removed on the phone.

**Independent Test**: Render the phone fixtures at 390×844, 390×664 and 360×640 and compare them with PhoneMatch and PhoneMatchShort. Nothing scrolls, and the foot is always visible.

**Acceptance Scenarios**:

1. **Given** 390×844, **When** a match renders, **Then**:
   - the scoreboard is 358px wide with 34px rows;
   - columns are name 112 · track · value 36, with 10px gaps and 8px padding;
   - blocks fill in 5s steps without tick marks;
   - the field (358²) is below it;
   - the ledger block holds the live row (line 1 `move 4 · your move`, line 2 the instruction or notice, right cell `history ▸`) and the territory line;
   - the foot is pinned to the bottom edge: `⋯` (44×44) and the language label.
2. **Given** 390×664, **When** a match renders, **Then** the territory hides first and the live row keeps two lines. The ledger holds no clock, because the clock is in the scoreboard.
3. **Given** 360×640, **When** a match renders, **Then** the field is `min(358, 100vw − 32)` square, the scoreboard is the same width, and nothing scrolls.
4. **Given** the phone sheet is opened from the live row, **When** it renders, **Then** it lies between the field and the foot. It never covers the scoreboard or the foot, and Esc returns focus to the live row.
5. **Given** the scoreboard's phone rows, **When** they render, **Then** the sub-lines are the short forms (`6 of 10`, `move 4`), and each row keeps its square and name.

---

### User Story 5 - The opponent's colour, and red only for points lost (Priority: P1)

The opponent is burnished terracotta, not coral. A crimson marks points lost and nothing else, and it colours only the number.

**Why this priority**: The colour change touches every seat-coloured element. A penalty colour that could be mistaken for the opponent would confuse the ledger.

**Independent Test**:
- Render `idle`, `low-clock` and `final`.
- Sample colours: opponent letters, bands, squares and totals are `#B56A4F`; opponent text under 17px is `#A1583D`; every `−5` penalty number and the `−15` of the stakes line are `#AD1F3D`.
- The labels beside those numbers are `--muted`.
- Rating losses are ink.

**Acceptance Scenarios**:

1. **Given** the opponent scored a word, **When** its band draws, **Then** it is terracotta at 30% while live and 14% when settled. Its letters and numeral are `--opp`, and its ledger word and points (under 17px) are `--opp-text`.
2. **Given** a move with no word, **When** its ledger cell renders, **Then** it reads `no word −5` (either seat's column): `−5` in `--err`, `no word` in `--muted`.
3. **Given** a timed-out end with unplayed moves, **When** those rows render, **Then** each reads `−5 not played` with only `−5` in `--err`.
4. **Given** a penalty floored near zero (e.g. `−3`), **When** it renders, **Then** the floored number is `--err`.
5. **Given** a rating loss (`1187 → 1179 · −8`), **When** it renders anywhere in the match room, **Then** it stays `--ink`.
6. **Given** the clock under 1:00, the turn frame, focus rings, slip frames and every control, **When** they render, **Then** none of them uses `--err`.

---

### User Story 6 - The brand, capitalised (Priority: P2)

The game's name is written Orðusta (Icelandic) and Wottle (English) everywhere a word is written: the ledger's wordmark, the tab title, page metadata, prose and the rules page.

**Why this priority**: The owner's decision (§10 Q13). It is a small change, but it touches many strings and the design system's own rule.

**Independent Test**:
- Grep the copy files, metadata and rendered fixtures for a lowercase `wottle` or `orðusta` used as a displayed name. None may remain, except identifiers, URLs, cookie names and file names.
- The tab title during a match reads `3:12 · move 4 · Wottle` / `3:12 · leikur 4 · Orðusta`.

**Acceptance Scenarios**:

1. **Given** the English room, **When** the ledger renders, **Then** its wordmark reads `Wottle`. In the Icelandic room it reads `Orðusta`.
2. **Given** a live match with the move yours at 3:12, **When** the tab is viewed, **Then** its title is `3:12 · move 4 · Wottle`. Outside a live match the title is `Wottle` / `Orðusta`, and the rules page title is `how to play · Wottle`.
3. **Given** the design system and CLAUDE.md, **When** they are read, **Then** neither states that the wordmark is lowercase.

---

### User Story 7 - The match room reads the whole move (Priority: P2)

The live row and the board say what the opponent just did, what a miss cost, and what is at stake in the last minute.

**Why this priority**: C4's details are what make the scoreboard's numbers make sense. Without the missed beat and the tick, a −5 appears in a total with no visible cause.

**Independent Test**: Render the `missed`, `last-moved`, `stakes` and `pick-cleared` fixtures. Each shows its string in the live row, or its tick on the board.

**Acceptance Scenarios**:

1. **Last-moved tick.**
   - **Given** Kári's most recent move swapped two letters, **When** the board renders, **Then** both cells carry a 2px bar in `--opp` along their bottom inner edge, and their accessible labels end `…, Kári's last move` / `…, síðasti leikur · Kári`.
   - **Given** a player's own most recent move, **Then** its two cells carry the same tick in `--you`.
   - **Given** a ticked letter becomes frozen, **Then** its tick is dropped. At most two cells per seat are ticked.
2. **Missed beat.**
   - **Given** your move 4 resolves with no word, **When** its beat shows, **Then** line 1 reads `move 4 · no word` / `leikur 4 · ekkert orð` (in place of `move 4 scored`).
   - Line 2 reads `−5 · move 5 opens` / `−5 · leikur 5 opnast`.
   - Near zero it reads e.g. `−3 · a total never falls below 0` / `−3 · samtala fer aldrei undir 0`.
3. **Stakes line.**
   - **Given** under 1:00, the move yours and nothing picked, **When** line 2 renders, **Then** it reads `3 moves left · −15 if unplayed` / `3 leikir eftir · −15 ef óleiknir`.
   - The number is computed from the player's total and unplayed moves under the floor rule, not from a literal.
   - Only the number is `--err`.
4. **Illegal pick.** **Given** a pick on a letter that is frozen in Kári's word GILT, **When** the refusal shows, **Then** line 2 reads `frozen · GILT · Kári · pick another` / `frosinn · GILT · Kári · veldu annan`.
5. **Pick cleared.** **Given** your picked letter was exchanged by Kári's move, **When** the pick clears, **Then** line 2 reads `pick cleared · Kári moved that letter` for 2s (not as a separate notice), and that cell flashes Kári's tick once (held under reduced motion).
6. **Line 2 at 1440.** **Given** a 1440 viewport, **When** any line 2 string in either language renders, **Then** it fits on one line.
7. **Opponent announcement.** **Given** Kári's move resolves as SKÓ +11, **When** your own beat has been announced, **Then** a polite, rate-limited region announces `Kári SKÓ +11 · 5 of 10` / `Kári SKÓ +11 · 5 af 10`.
8. **Go.** **Given** the `starting` count reaches go, **When** the match opens, **Then** focus moves to the field and line 1 is announced.

---

### User Story 8 - Resign, disconnect and end early in the scoreboard's terms (Priority: P2)

The resign slip, the opponent's absence and your own lost connection are written into the scoreboard rows and the slip, in the strings C6 and C8 give.

**Why this priority**: These states used to live in the bars, which are removed. They must have a home on the day the bars go.

**Independent Test**: Render `resign`, `disconnect`, `gone`, `end-early` and `offline`, and compare them with the ResignSlip and Disconnect artboards.

**Acceptance Scenarios**:

1. **Resign slip.** **Given** you choose `⋯ resign`, **When** the slip opens:
   - **Then** its label reads `move 4 of 10 · 3:12 left`;
   - its headline reads `Resign the match?` / `Gefast upp?`;
   - its body reads `Kári wins · your rating moves as a loss` (the `· −9` stake is added in the table stage, when the stakes reach the match state);
   - its primary is `keep playing ▸` / `halda áfram ▸` and is focused, and its secondary `yes, resign ▸` sits on a second line;
   - Esc keeps playing, and the clock keeps running behind it.
2. **Reconnect window.** **Given** Kári disconnected 48s ago, **When** his row renders, **Then** his sub-line reads `1265 · reconnecting · 0:42 left` and his remaining move segments are outlined.
3. **Gone.** **Given** Kári's 90s window has passed, **When** his row renders, **Then** it reads `1265 · 8 of 10 · gone for 2:04` / `8 af 10 · án tengingar í 2:04`, counting up. It never reads a frozen `0:00 left`.
4. **End-early slip.**
   - **Given** you have 10 of 10 and the window has passed, **When** the game raises the slip, **Then**:
     - its label reads `10 of 10 played · 1:12 on the clock`;
     - its headline `Kári is gone` / `Kári er ekki lengur hér` is focused;
     - its body reads `the normal rules decide it`;
     - its primary is `end the match ▸`, guarded for 500ms after it appears;
     - its secondary is `keep waiting ▸`.
   - **Given** you chose `keep waiting`, **Then** the live row carries the offer instead: line 1 `10 of 10 played`, line 2 `Kári is gone · end the match ▸` as a secondary action.
   - Your row reads `1310 · you · 10 of 10 · done`.
5. **Your own connection lost.**
   - **Given** your connection is lost, **When** your row renders, **Then** its sub-line reads `offline · reconnecting` / `án tengingar · tengist aftur`, your lane is outlined, the turn frame goes to ink and the field takes no pick.
   - **Given** your connection is back after 0:34, **Then** line 2 reads `back · you were away 0:34 · the clock kept running` for 4s.
6. **Phone slips.** **Given** a phone, **When** the resign or end-early slip opens, **Then** it fills exactly the field's square (20px padding) and never covers the scoreboard or the foot. Its elements sit on F8's rows, and the secondary drops to a second line when the two actions do not fit in 318px.

---

### User Story 9 - The design system, the docs and the fixtures say what is built (Priority: P2)

The design system, CLAUDE.md and the visual baselines describe the scoreboard, nine tokens and the capitalised brand. None of them still describes bars, a ledger clock, coral or a lowercase wordmark.

**Why this priority**: The project treats these documents as the contract for every later UI change, and the visual suite is its guard.

**Independent Test**:
- `pnpm docs:check` passes with the retired phrases added to its list.
- `pnpm test:visual` passes on the new fixture phases.
- The design system lists nine colour tokens.

**Acceptance Scenarios**:

1. **Given** WOTTLE_DESIGN_SYSTEM.md, **When** it is read, **Then**:
   - §2 lists nine tokens with the new `--opp`, `--opp-text` and `--err` values and their uses;
   - §3 has the display tier ladder and the capitalised wordmark;
   - §5 describes the scoreboard in place of the bars and the ledger clock;
   - §5.1 adds the last-moved letter state;
   - §6 says time is not motion, and nothing blinks.
2. **Given** CLAUDE.md's Design section, **When** it is read, **Then** it describes the scoreboard (no bar lanes, no ledger clock, no inverted flash), nine tokens including `--err` and its only use, terracotta for the opponent, and the capitalised wordmark.
3. **Given** `/dev/room`, **When** the new phases are requested, **Then** each renders from static fixtures with no database: `missed`, `stakes`, `pick-cleared`, `last-moved`, `gone`, `offline`, `starting`, and the phone `phone-match`, `phone-match-664`, `phone-match-360`. Every existing match phase is re-baselined.

---

### Edge Cases

- **Both players done early.** When both have ten moves and the clock is still running, both lanes are empty. The clock row keeps counting until settlement, and neither row reads `behind pace`.
- **A player with ten moves played** never reads `behind pace`, whatever the clock says.
- **0:00 with the queue draining.** The clock track is empty and the label reads `time`. A move in flight still shows at 30% until it resolves.
- **The total is floored.** A miss at total 3 shows `−3`, and a miss at total 0 shows `0`. A zero penalty is drawn `0` in `--muted`, not crimson, because nothing was lost.
- **Stakes of zero.** When the player's total is 0, line 2 reads `3 moves left · nothing to lose` / `3 leikir eftir · engu að tapa`, never `−0`.
- **Pace with no moves left for the viewer.** The label reads `match clock`, not a pace; the pace is shown only while a move is yours.
- **Pace rounding.** Seconds ÷ moves left is rounded to the nearest second. It is never shown as `≈0s`: under 1s per move it reads `<1s a move`.
- **Legacy negative totals.** Matches from 2026-09-21–22 can hold a negative total. It is drawn with a real minus in the value column, in its seat colour, not `--err`.
- **A seat-coloured total under 17px on a phone** (the 36px value column) uses `--opp-text` for the opponent.
- **Long names.** A name longer than the name column is truncated with an ellipsis. The full name is in the row's accessible name.
- **A refused move** (frozen or moved) changes no letter, so it never becomes a seat's last move; the previous tick stays.
- **On desktop the `⋯` menu** sits in the ledger's first row, as drawn; there is no separate desktop foot during a match.
- **The tick and a band on the same cell.** The tick is drawn on top of the band, along the bottom edge, and stays until the letter freezes. A letter that freezes in the same move drops its tick at once.
- **Reduced motion.** The clock's load during `starting` shows its end state. The pick-cleared flash is held for its 2s. The numeral and ticks still step every second.
- **The match-over state** keeps the scoreboard: the clock holds what was left (`match over · 4:52 of 5:00`, numeral `0:08`), and the rows carry the rating change and final totals (`1204 → 1212 · +8 · wins`). The rest of the result screen is out of scope and unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**The scoreboard**

- **FR-001**: During a match, the room MUST draw exactly one scoreboard box above the field and no player bar above or below it. The box holds three rows in this order: the match clock, the opponent, the viewer.
- **FR-001a**: The scoreboard MUST be drawn in the match states only: `starting`, the live match, and match over as drawn on the MatchRail sheet. The lobby, queue and profile keep their current bars until their own stage. The field resizes when the scoreboard takes over from the bars; keeping one field mounted from the queue through the match (the "one field" principle, §8 item 1) is a later stage.
- **FR-002**: The three rows MUST share one ten-column track:
  - the clock's ten 30s blocks, each of six 5s ticks, emptying one tick every 5s from the right (remaining ticks = ⌈seconds left ÷ 5⌉);
  - each player's ten moves, emptying from the right as moves resolve, shown at 30% while in flight, and outlined while that player is disconnected or offline.
- **FR-003**: Each player row MUST carry the player's seat square and name, a sub-line, and their total in the value column. The total is in the seat colour, using the text variant under 17px.
- **FR-004**: Sub-lines MUST follow the canvas strings:
  - **Opponent:** `<rating> · 6 of 10 · playing` / `· scoring` (the row names no seat word; its square and place say who it is, as on the canvas); `10 of 10 · done`; `reconnecting · 0:42 left`; `8 of 10 · gone for 2:04`; `ready` while starting.
  - **Viewer:** `<rating> · you · move 4 of 10` in `--you` while the move is theirs; `· scoring`; `10 of 10 · done`; `move 8 · behind pace`; `offline · reconnecting`; `ready`.
  - **Match over:** the rating change and, for the winner, `· wins`; while ratings are not yet written, `rating pending`, as today.
  - **Phone:** the short forms `6 of 10` and `move 4`.
- **FR-005**: Row 1 MUST carry the label, the track and the numeral (mono, tabular, stepping every second). The label is:
  - the pace while a move is the viewer's (`≈27s a move` / `≈27 sek á leik`, seconds left ÷ the viewer's moves left, rounded);
  - otherwise `match clock` / `leikklukka`;
  - in the last 15 seconds, `last 12s`;
  - at 0:00, `time`;
  - while starting, `starts in 3`;
  - at match over, `match over · 4:52 of 5:00`.
- **FR-006**: Urgency MUST be weight only, as in User Story 2's scenarios 1–4. No element of the scoreboard or ledger may blink, flash or invert. Spec 050's last-15-seconds inverted face is retired.
- **FR-007**: The viewer's sub-line MUST add `behind pace` / `á eftir áætlun` when moves left − (seconds left ÷ 30) ≥ 1 and the viewer has a move left. The pace carets proposed in the match-rail amendment are not built.
- **FR-008**: Desktop geometry:
  - rows 40px;
  - columns: name 216px · track · value 64px;
  - 16px gaps and 14px padding;
  - a 1.5px `--ink` frame on `--paper`.
- **FR-009**: Phone geometry:
  - the scoreboard's width is the field's width (358px at 390);
  - rows 34px;
  - columns: name 112 · track · value 36;
  - 10px gaps and 8px padding;
  - no tick marks: blocks fill in 5s steps.
- **FR-010**: Accessibility:
  - the clock row MUST be `role="timer"` and not live;
  - the live row announces 1:00 and 0:15;
  - each player row's lane MUST expose "7 of 10 moves left" as its value text;
  - the clock track's tick graphics are hidden from assistive technology (the numeral carries the time); each player lane stays exposed as a progressbar with its value text;
  - the 1:00 and 0:15 announcements are one-off events in the live row's polite region, raised when the clock crosses each mark, never on reload past it.

**One grid**

- **FR-011**: At 1440×900:
  - the field MUST be 713px square outside: ten 71px cells inside a 1.5px frame on each edge (710 + 3);
  - there is a 12px gap between the scoreboard and the field;
  - the stack starts at y=24.
- **FR-012**: The ledger's first three rows MUST mirror the scoreboard's rows:
  - wordmark, context and `⋯`;
  - territory or the state's line;
  - the face-off header, whose 1.5px `--ink` rule is level with the box's bottom border.

  After a 12px gap, ten 71px move rows MUST each sit level with a row of the board. The live row is one of them.
- **FR-013**: Below 1440×900 the grid MUST scale in whole pixels: the cell is floor(min(height left after the scoreboard, the 12px gaps and the page margins; width left after the ledger, the gutter and the page margins) − 3) ÷ 10, capped at 71px; the field is 10 × cell + 3px of frame; each ledger move row equals the cell; the scoreboard rows stay 40px and the ledger's first three rows mirror them. Field states never scroll.
- **FR-014**: The ledger MUST hold no clock. The caption's clock box and its draining bar are removed, along with the phone ledger's clock block and clock strip.

**Phone**

- **FR-015**: At 390×844, from the top:
  - the scoreboard;
  - the field (358²);
  - the ledger block: the live row with `history ▸`, then territory;
  - the foot, pinned to the bottom edge with the safe area: `⋯` at 44×44 and the language label.
- **FR-016**: As the height shrinks, territory MUST hide first; the live row keeps two lines at 390×664. At 360×640 the field is `min(358, 100vw − 32)`, and the scoreboard matches its width.
- **FR-017**: The sheet MUST lie between the field and the foot, never over the scoreboard or the foot.
- **FR-018**: Phone slips MUST fill exactly the field's square and follow F8's layout.

**Colour**

- **FR-019**: `--opp` MUST be `#B56A4F`, with bands at `rgba(181,106,79,0.14)` settled and `0.30` live.
- **FR-020**: `--opp-text` MUST be `#A1583D`, used for opponent text under 17px.
- **FR-021**: A ninth token, `--err` `#AD1F3D`, MUST be added and used only for the number of points lost:
  - the `−5` (or floored) of `no word`, in the ledger and in the missed beat's line 2 (`−5 · move 5 opens`);
  - the `−5` of `not played`;
  - the stakes number in `−15 if unplayed`.

  Its label MUST stay `--muted`. A zero penalty is not crimson.
- **FR-022**: `--err` MUST NOT be used for seats, rating changes, urgency, frames, focus or any control. A test MUST fail on any other use.
- **FR-023**: Seat colours MUST still come only through the seat-relative helper. No colour may be keyed to `player_a` / `player_b`.

**Brand**

- **FR-024**: Every displayed instance of the product name MUST be capitalised (`Wottle`, `Orðusta`). This covers the ledger wordmark, page titles and metadata, the rules page and prose copy. Identifiers, URLs, cookie names and file names are unchanged.
- **FR-025**: During a live match the tab title MUST read `<clock> · move <n> · <Brand>` / `<clock> · leikur <n> · <Brand>`, updating each second. Otherwise it reads the brand.
- **FR-026**: A test MUST fail if a copy file or metadata builder emits a lowercase brand name.

**Match-room details (C4, C6, C8)**

- **FR-027**: The last-moved tick:
  - each seat's most recent move MUST mark its two swapped cells with a 2px seat-colour bar on the bottom inner edge;
  - the tick is dropped when the letter freezes, and a seat has at most two ticked cells;
  - the cell's accessible name MUST end with the mover's last move.
- **FR-028**: A resolved move with no word MUST show the missed beat. Line 1 is `move N · no word`. Line 2 is `−5 · move N+1 opens`, or the floored value with `a total never falls below 0`.
- **FR-029**: Under 1:00, with a move the viewer's and nothing picked, line 2 MUST read the computed stakes:
  - `N moves left · −X if unplayed`, where X comes from the existing timeout-penalty rule;
  - `nothing to lose` when X is 0.
- **FR-030**: An illegal pick on a frozen letter MUST name the word and its owner (`frozen · GILT · Kári · pick another`).
- **FR-031**: Pick cleared, refusals, submit errors and the viewer's own connection state MUST be drawn on live row line 2, not as notices. Pick cleared holds 2s and flashes the opponent's tick on that cell once. When several apply, line 2 shows exactly one, in this order: offline > back > submit error > refused or illegal pick > pick cleared > end-early offer > missed beat or stakes > the instruction. A held line (2s or 4s) is replaced at once by a higher one and resumes only if its time is left.
- **FR-032**: Every live row line 2 string in both languages MUST fit on one line at 1440 in the 340px ledger. A test renders the longest strings; a string that does not fit is shortened in the copy (not by widening the ledger), and the change is recorded in design system §8.
- **FR-033**: The opponent's resolved moves MUST be announced in a polite, rate-limited region after the viewer's own beat, in the form `Kári SKÓ +11 · 5 of 10`. Each move is announced at most once (keyed by its receipt sequence), only from moves that arrive live; a reload or a poll that catches up never replays past moves.
- **FR-034**: At go, focus MUST move to the field and line 1 MUST be announced.
- **FR-035**: The resign slip MUST follow C6: the label and headline, and the body `Kári wins · your rating moves as a loss` without a number (the stake is added in the table stage); `keep playing ▸` primary and focused; `yes, resign ▸` secondary on a second line; Esc keeps playing.
- **FR-036**: The end-early slip and its live-row fallback MUST follow C8:
  - the headline is focused;
  - the primary is guarded for 500ms after it appears;
  - `keep waiting ▸` moves the offer to line 2, and the game never raises the slip again in this match (the current 10s re-raise is removed).
- **FR-037**: The opponent's absence after the 90s window MUST read `gone for m:ss`, counting up, never a frozen `0:00 left`. The reconnect window and `gone for` MUST be measured on the server-corrected clock (the same `serverNow` drift the match clock uses), never on the device clock alone.
- **FR-038**: The viewer's own lost connection MUST set their row to `offline · reconnecting`, outline their lane, turn the turn frame to ink and block picks. On return, line 2 reads `back · you were away m:ss · the clock kept running` for 4s. The away time is measured by the client from when its transport lost the match to when it recovered, without a page load.

**Documents and fixtures**

- **FR-039**: WOTTLE_DESIGN_SYSTEM.md MUST be updated:
  - §2: nine tokens and values;
  - §3: the display tier and the capitalised wordmark;
  - §5: the scoreboard replaces the bars (§5.3) and the ledger clock;
  - §5.1: the last-moved state;
  - §5.4 and §8: the live row strings above;
  - §6: time is not motion, nothing blinks;
  - §9: timer role, lane value text, announcements.
- **FR-040**: CLAUDE.md's Design section MUST describe the scoreboard, the one grid, nine tokens, `--err`'s only use and the capitalised brand. Its references to bar lanes, the ledger clock and its inverted flash, coral, eight tokens and the lowercase wordmark are removed.
- **FR-041**: The rules document's §12 rows for the clock, scoring, frozen tile, reconnection window and resigning MUST be updated to match.
- **FR-042**: `/dev/room` MUST gain the phases listed in User Story 9. Every match-room baseline MUST be refreshed (darwin locally, Linux from CI), and `pnpm docs:check` MUST list the retired phrases (`coral`, the lowercase wordmark rule, `ledger clock`, `BarLane` as a match element).

### Key Entities

- **Scoreboard view**: a pure derivation from match state and the current second. It gives:
  - the clock row: label, ticks remaining, numeral, phase (`running`, `under-minute`, `last-seconds`, `time`, `starting`, `over`);
  - two player rows, each with name, seat, sub-line, the state of each of ten segments (`left`, `used`, `in-flight`, `outlined`), total and the behind-pace flag.
- **Last moves**: per seat, the two cells of that seat's most recent resolved move that are not frozen. Derived from the move history the room already holds.
- **Stakes**: moves left and the penalty they would cost at 0:00 under the floor rule. Derived from the viewer's total and unplayed count.
- **Colour tokens**: nine: `--paper`, `--ink`, `--rule`, `--tint`, `--muted`, `--you`, `--opp`, `--opp-text`, `--err`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1440×900 and 1280×800, every ledger row edge is level with the matching left-column edge to within 1px:
  - three scoreboard rows;
  - the gap;
  - eleven board-row boundaries.
- **SC-002**: In a 3-second recording of `last-seconds`, the only pixels that change are the numeral, the ticks and the stepping label. There is zero blinking or inversion.
- **SC-003**: In every match fixture, each `--err` pixel belongs to the number of a points-lost value, with 0 instances elsewhere. Every opponent seat element samples `#B56A4F` or `#A1583D`.
- **SC-004**: 0 displayed lowercase brand names across both copy files, metadata and rendered fixtures.
- **SC-005**: No field state scrolls at 390×844, 390×664 or 360×640, and the foot is visible in all three.
- **SC-006**: Every live row line 2 string, in both languages, fits one line at 1440 (0 wraps in the overflow test).
- **SC-007**: A player can tell whether they are behind pace without arithmetic: the `behind pace` words appear exactly when moves left − blocks left ≥ 1 (100% agreement across a table of cases).
- **SC-008**: The visual suite passes at three viewports over all fixture phases, and `pnpm docs:check`, lint, typecheck and the unit suite pass.
- **SC-009**: A move's reveal and the move hold take the same time as before this stage (600ms hold). The scoreboard adds no latency to a move.

## Assumptions

- **No server change.** Every derivation runs on the client from what the room already receives:
  - pace, behind pace, stakes, the last-moved cells, the missed beat and the gone duration;

  If a value is not available client-side, it is derived from the move history and state the room already holds.
- **The table (C1), the leave slip (C7), stepped out (needs the S5 heartbeat), reactions and the ledger foot's new menu items** are out of scope. The foot keeps its current items, with `resign` as today.
- **The pick-cleared tick flash** reuses the tick drawing, not a new animation.
- **The display tier (§8 item 5)** is applied where the match room uses those sizes. The pages that need the larger tiers are later stages.
- **Seat colour on pages (§8 item 6)** is honoured as far as the match room goes. Pages are later stages.
- **Icelandic strings** marked (?) in the source are used as drafted and added to gap 4's native read.
- **Fixture boards** reuse the existing fixture boards. The English fixture (EN-M) follows the canvas values where a phase is drawn from it.
