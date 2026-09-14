# Feature Specification: Field & Ledger Redesign

**Feature Branch**: `044-field-ledger-redesign`
**Created**: 2026-09-14
**Status**: Draft
**Input**: User description: "We are going to redesign the visuals and UX experience of the game. The new design is defined in docs/design_documentation/260914-wottle-new-design/. Analyse the documents in the folder, update all documentation based on the information, and write a specification for implementing the new design."

**Design sources** (binding for this feature):

- `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` — the Field & Ledger design system (tokens, type, components, motion, copy, accessibility). When this document and the code disagree, the code is wrong.
- `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_PLAN.md` — implementation plan and order of work (P0–P5).
- `docs/design_documentation/260914-wottle-new-design/DOCS_CONSISTENCY.md` — documentation edits that keep the repo consistent.
- `docs/design_documentation/260914-wottle-new-design/260914-wottle-new-design-v2.pdf` — the UX audit with figures (Fig. 2 desktop match, Fig. 5 phone, Fig. 6 lobby, Fig. 7 matchmaking, Fig. 8 post-game, Fig. 9 profile, Fig. 10 states). The audit records nineteen findings in the match screen (four of them bugs) and eight outside it; every finding maps to a requirement below.

## Summary

Wottle's current look (the April–June 2026 theme: cream paper, embossed tiles, seven stat cards around the board, separate landing / lobby / matchmaking / match / post-game / profile pages) spends contrast on decoration, covers the board with banners and overlays, shows the round number three times, draws two match-long clocks as unrelated numerals, and paints territory per tile so scored words disappear. The Field & Ledger redesign replaces it with three objects that never leave the screen:

- **The field** — a ruled grid of one hundred capitals. Scored words are drawn as tinted bands with a chevron at the reading start. Nothing is ever placed over it.
- **Two player bars** — the opponent's above the field, yours below. Each carries one player's name, rating, clock, total and a clock lane at the edge nearest the field. Both lanes share one scale so "who can afford to think" is a glance.
- **The ledger** — one column beside the field holding every fact about the match: round context, one row per round with both players' words, territory, hints, notices (rematch, resign, first-match rules) and the controls.

Lobby, matchmaking, match, post-game and profile become **states of the same room**, not pages. Colour is **seat-relative**: teal is always you, coral is always the opponent. The swap interaction gains an optional **preview** step (off by default; the second tap commits as today) so players who want it can see what a swap scores before committing.

**The one rule**: every visible element is a letter (or a state of a letter) on the field, a fact about one player in that player's bar, or a fact about the match in the ledger. Anything else is removed, not restyled.

## Clarifications

### Session 2026-09-14

- Q: Are challenge (direct-invite) matches rated, given the spec said "unranked" but every match writes Elo today? → A: All matches stay rated as today; lobby copy reads `here now · challenge for a ranked match`; no `unranked` label anywhere.
- Q: How is a player's "first match" detected for the three-sentence rules line? → A: Server-side — the viewer's `gamesPlayed` count (existing profile stats) is 0 when the match starts; no per-device flag.
- Q: At round resolution, do bands already drawn by the instant first-mover reveal animate again? → A: No — only words not yet drawn animate; already-drawn bands settle 30 % → 14 % with the rest, and totals count up by the remaining delta only.
- Q: Who can open `/match/[id]` for a match they are not playing? → A: Signed-in non-participants may open a **completed** match as the read-only final room (seat colours resolve with the viewer as neither seat: player A teal, player B coral, header without `· you`); non-participants opening a **live** match are redirected to the lobby. Signed-out visitors are redirected to the landing room.
- Q: Do signed-out visitors get server-priced previews on the warm-up field? → A: No. Signed out, the warm-up field swaps locally with no pricing and the hint reads `tap a second letter`; preview pricing (match and warm-up) requires a session. There is no anonymous pricing endpoint.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the match at a glance from the room (Priority: P1)

A player in a live match sees the opponent's bar above the field, their own bar below it, and the ledger beside it. They can tell in one glance who they are (teal, bottom), who the opponent is (coral, top), what round it is (ledger caption and live row), both totals (bar right), both clocks as two lengths on one scale (lanes), and which words each player has scored (ledger rows and field bands). Nothing covers the field. The whole room fits the window without scrolling.

**Why this priority**: This is the shell every other story renders into. It fixes the audit's structural findings (seven cards, sticky navigation, wrong height budget, round number shown three times, two clocks as unrelated numerals) and delivers the design's core promise even before the interaction changes land.

**Independent Test**: Start a match on a 1440×900 window. Verify bar / field / bar stack on the left, ledger on the right with its top rule aligned to the top bar and its foot flush with the bottom bar, no vertical scroll, and no element positioned over the field. Repeat at 1280×800 (field ≥ 560px) and 390×844 portrait (bar / field / bar / live row visible without scrolling).

**Acceptance Scenarios**:

1. **Given** a match in progress on a desktop window ≥ 1100px wide, **When** the room renders, **Then** the opponent's bar is on top, the player's own bar is at the bottom, the field is the largest square that fits between them (≤ 720px), and the ledger occupies a 340px column whose height equals the stack's height.
2. **Given** a match in progress, **When** any state change occurs (opponent submits, round resolves, disconnect, rematch request), **Then** no modal, banner, toast, overlay or announcement is drawn over the field; the change is written into a bar or the ledger's live row.
3. **Given** a match in progress on a window between 900px and 1100px wide, **When** the room renders, **Then** the ledger narrows to 260px and the gutter to 40px with the same structure.
4. **Given** a match in progress on a phone (390×844 portrait), **When** the room renders, **Then** the layout is a single column bar / field / bar / live row with no scrolling, the field spans the full width, and every cell is a whole-cell hit target of at least 44px effective size; the rest of the ledger opens as a sheet from the live row.
5. **Given** any room state, **When** a player looks for the round number, **Then** it appears exactly once as match context (ledger caption `ranked · round 4 of 10`) plus the live row's round label, and nowhere else.
6. **Given** any room state, **When** a player looks for navigation, **Then** there is no top bar; the `⋯` menu in the ledger foot holds sound, profile and sign out (lobby) or sound, resign and leave (match).

---

### User Story 2 - Pick and commit a swap, with an optional preview (Priority: P1)

A player taps a letter (it becomes picked in their colour) and taps a second letter to commit the swap — the default, as today. Escape, tapping elsewhere, or tapping the first letter again cancels a pick. A player who turns on the **preview** setting gets a middle step: the second tap exchanges the two letters in place as a preview, the ledger's hint line prices the word total the preview would make, and a third tap on either letter (or Enter) commits. Nothing is sent to the server until commit in either mode.

**Why this priority**: The audit's finding "the second tap is irrevocable" is the largest usability defect in the match: a mis-tap burns the round. The team chose to keep instant commit as the default (speed matters under first-submission-wins contention) and to offer preview as an opt-in, which makes the swap deliberate for players who want it without adding a dialog. Either way the pick/commit states must read clearly on the field.

**Independent Test**: In a match with default settings, tap A then B; confirm the swap is submitted and both letters show dashed rings in the player's colour. Turn on preview; tap A then B; confirm the letters have exchanged visually with dotted rings, the hint line shows a preview total, and no submission has been recorded. Press Esc; confirm the letters revert. Tap A, B, then B again; confirm the swap is submitted.

**Acceptance Scenarios**:

1. **Given** the field is idle and it is the player's move, **When** they tap a free letter A, **Then** A shows the picked state (player's seat colour, slight scale, inset ink ring, value numeral in ink) and the pick sound plays.
2. **Given** letter A is picked and preview is off (default), **When** the player taps a different free letter B, **Then** the swap is submitted, both letters become pinned (dashed ring in the player's colour), the player's clock lane stops, the commit sound plays and a haptic pulse fires where available.
3. **Given** letter A is picked and preview is on, **When** the player taps a different free letter B, **Then** A and B exchange in place within 150ms, both carry a dotted ring, the ledger hint line reads the total of any words the preview would form (or `tap again to play` when none), and nothing is submitted; tapping A or B again, or pressing Enter, submits as in scenario 2.
4. **Given** a pick or preview is showing, **When** the player presses Escape, taps outside the field, or taps the originally picked letter, **Then** the field returns to idle, any preview is reversed, and no sound plays.
5. **Given** the settings in the `⋯` menu, **When** the player toggles preview, **Then** the choice persists like the sound preference and the hint line reads `tap a second letter` (preview off) or `tap again to play` (preview on) accordingly.
6. **Given** the field is idle, **When** the player drags from letter A to letter B with a pointer, **Then** the result follows the same setting: a commit with preview off, a preview (A, B) with preview on.
7. **Given** a letter is frozen or pinned, **When** the player taps it, **Then** the letter shakes for 300ms in its own colour, the live row reads `frozen · <name> R<n> · pick another` for 2 seconds, and nothing else changes.
8. **Given** the player has a pick or preview showing, **When** the opponent's swap arrives and one of its letters is the player's picked letter, **Then** the opponent's two letters pin in coral immediately, the player's pick clears, and the live row states why.
9. **Given** the field has keyboard focus, **When** the player uses arrow keys, Space, Enter and Escape, **Then** arrows move focus between cells, Space picks or previews, Enter commits and Escape cancels.

---

### User Story 3 - See words, not tiles (Priority: P2)

Scored words are drawn on the field as bands: a light tint of the scorer's colour running along the word, with a small chevron at the end where reading begins, so a player can see which letters belong to which word, whose it is and which way it reads. A run that is a valid word in both directions is one record (the forward reading), so it carries one chevron. A letter shared by both players' words is drawn in ink inside two bands.

**Why this priority**: Territory is earned per word but the current UI paints it per tile, so words vanish into a mosaic of coloured squares. Bands restore the game's central object and are the basis of the reveal choreography (Story 5) and the ledger's row hover (Story 4).

**Independent Test**: Load a match state with a horizontal left-to-right word, a vertical bottom-to-top word, a crossing between a teal and a coral word, and a run that reads as a word both ways. Verify one band per word record with its chevron on the correct edge, both bands visible at the crossing, the shared letter in ink, and exactly one chevron (at the left/top end) on the two-way run.

**Acceptance Scenarios**:

1. **Given** a settled scored word reading left to right, **When** the field renders, **Then** a band at 14% of the scorer's seat colour covers exactly its cells, inset so the value-numeral gutter stays clear, with a chevron on the band's left edge pointing right; the letters inside take the scorer's colour and their value numerals take the scorer's colour.
2. **Given** words reading right to left, top to bottom, or bottom to top, **When** the field renders, **Then** the chevron sits at the reading start (right edge pointing left, top edge pointing down, bottom edge pointing up respectively).
3. **Given** a run that reads as a valid word in both directions (for example FÁR and RÁF), **When** the field renders, **Then** it is one record read forward (`fár`, left-to-right), one band with a single chevron at the left end, and one word in the ledger row.
4. **Given** a teal word and a coral word crossing at one letter, **When** the field renders, **Then** both bands are drawn in full and the shared letter is rendered in ink at heavy weight.
5. **Given** two words of the same seat on the same axis, **When** the field renders, **Then** their bands never touch end to end (guaranteed by the whole-run rule: BORÐA + GILT is only valid as the single run BORÐAGILT).
6. **Given** a player hovers or taps a round row in the ledger, **When** the row is active, **Then** that round's bands stay at full tint and all other bands dim, and the row shows per-word points.

---

### User Story 4 - Follow the match in the ledger (Priority: P2)

The ledger beside the field lists the match context, a column header for each seat, one row per round showing both players' words and round totals, a territory bar with counts, a one-line hint, any notices, and the controls. The current round is the live row, tinted and marked, carrying the player's state (`picking · T (2)`, `played ●`) and then the scored words as they land. The ledger never scrolls.

**Why this priority**: The ledger replaces seven cards, two popups, two history panels and a tutorial with one object. It is where the round number, scored words, territory, rematch and resign now live, so it must exist before those surfaces can be removed.

**Independent Test**: Play three rounds in a two-player match. Verify the caption reads `ranked · round 4 of 10`, rows 1–3 show both players' words and totals in seat colours, row 4 is the live row with state text, rows 5–10 show only their labels in the future-row grey, the territory bar and counts match the field, and the ledger's foot is flush with the bottom bar.

**Acceptance Scenarios**:

1. **Given** a match in round 4, **When** the ledger renders, **Then** the caption line shows the wordmark `wottle` left and `ranked · round 4 of 10` right, followed by a column header `■ <you> · you` / `■ <opponent>` with the seat squares in seat colours.
2. **Given** ten rounds in a match, **When** the ledger renders at any height ≥ the stack's minimum, **Then** the ten round rows share the available height equally and the ledger does not scroll.
3. **Given** the current round, **When** the player has picked letter T (value 2) but not committed, **Then** the live row reads `picking · T (2)`; after commit it reads `played ●`; after reveal it lists the words and the round total.
4. **Given** a round where a player scored words, **When** the row renders, **Then** the words appear joined by ` · ` in the scorer's seat colour with the round total pinned top right.
5. **Given** a row that would need more than three lines, **When** the ledger renders, **Then** rounds older than the last three collapse to totals only, with words available on hover.
6. **Given** the opponent requests a rematch after a match, **When** the ledger renders, **Then** the notice `<name> asks for a rematch · accept ▸ · decline` appears as a live-row-styled line and no dialog opens.
7. **Given** a player chooses resign from the `⋯` menu, **When** the confirmation shows, **Then** it is the line `resign the match? · yes, resign ▸ · no` in the live row, and it reverts after 5 seconds without action.
8. **Given** a player whose completed-match count is 0 (server-side `gamesPlayed`), **When** the room enters the match state, **Then** the live row carries the three-sentence rules text and a `? rules` control remains in the ledger foot for later matches.
9. **Given** the territory bar, **When** the field has 32 teal frozen letters, 25 coral and 43 free, **Then** the bar shows you / free / opponent proportions in seat colour / rule colour / seat colour with the counts line beneath.

---

### User Story 5 - Clocks as two lengths on one scale (Priority: P2)

Each player bar's edge nearest the field is a lane whose full width represents the whole match budget (5:00 per player). The filled portion, in the seat colour, is the time that player has left. Under one minute the lane thickens and blinks (colour only). The mm:ss numeral sits at the bar's centre, in ink while running and in muted grey when stopped. When a player submits, their lane stops draining.

**Why this priority**: Both clocks are match-long budgets but were drawn as two unrelated numerals with a five-tone urgency ramp and two different renderings (audit findings). The lane makes relative time a glance and removes the third-hue alarm colour.

**Independent Test**: In a match, submit a swap; confirm your lane stops and your numeral goes muted while the opponent's continues. Run a clock under 1:00; confirm the lane thickens to 8px and blinks at 1Hz without changing hue. Disconnect the opponent; confirm their lane becomes a dashed pattern and holds.

**Acceptance Scenarios**:

1. **Given** a match in progress, **When** both bars render, **Then** each has a 4px lane on the edge nearest the field, filled in the seat colour proportionally to remaining time over the full match budget, with the remainder in the rule colour.
2. **Given** a player has submitted for the round, **When** the bar renders, **Then** their lane holds its length and their numeral is muted at regular weight; the opponent's lane keeps draining with the numeral in ink at medium weight.
3. **Given** a clock under 1:00, **When** the lane renders, **Then** it is 8px and blinks at 1Hz in colour only; with reduced motion it holds solid.
4. **Given** the opponent disconnects, **When** the bar renders, **Then** the sub-line reads `reconnecting · 0:42 left` counting down the grace period, the lane becomes a dashed pattern in coral and holds, and the player's own clock holds too; no overlay appears.
5. **Given** any lane, **When** assistive technology inspects it, **Then** it exposes a progress role with a min of 0, a max of 300 (the match budget in seconds), the current seconds, and a text value such as `6:45 remaining, running`.

---

### User Story 6 - The reveal: five beats, one signal each (Priority: P2)

When a round resolves, the field draws each scored word's band along the word, one after another; the ledger writes the word and points into the live row as each band lands; the totals count up; then the pins fade, the tint settles, the territory bar updates and the next row opens. Each of the round's five beats (set, think, commit, reveal, settle) has exactly one visual signal.

**Why this priority**: The reveal is the round's climax and was eight small signals (glow, popup, delta, announce, recap panel, pip advance, lock banner, frame pulse). One choreography replaces them and matches the design's principle of one signal per beat.

**Independent Test**: Resolve a round with three scored words. Verify bands draw sequentially (about 400ms each, 120ms apart), the live row gains one word per band, the totals count up over about 400ms, then pins fade and the next round row opens, all within about 2 seconds. With reduced motion, verify the end state appears immediately.

**Acceptance Scenarios**:

1. **Given** a round resolves with scored words, **When** the reveal runs, **Then** bands draw along each word at 30% tint, staggered, and the ledger live row appends each word with its points as its band lands.
2. **Given** the reveal has drawn all bands, **When** the settle beat runs, **Then** pins fade, band tint settles to 14%, totals finish counting up, the territory bar updates and the next round's row opens as the live row.
3. **Given** the first mover scores before the second mover has played, **When** the instant reveal arrives, **Then** the same choreography runs for the first mover's words only, and the second mover's pick is cleared if it landed on a newly frozen letter.
3a. **Given** the first mover's bands were already drawn mid-round, **When** the round resolves, **Then** only the not-yet-drawn words (the second mover's) draw, the first mover's bands settle from 30 % to 14 % with the rest, and the totals count up only by the delta not already shown; no band is drawn twice.
4. **Given** the user prefers reduced motion, **When** any round resolves, **Then** all transitions are instantaneous and only end states are shown.
5. **Given** a round resolves with no scored words, **When** the settle beat runs, **Then** pins fade and the next row opens with no other signal.

---

### User Story 7 - Landing and lobby are one room (Priority: P3)

A new visitor sees the same room: an empty top bar (`No opponent yet`), a real warm-up field they can pick and preview on, an empty bottom bar with an inline name input and a `play ▸` action, and a lobby ledger listing who is here and the visitor's recent matches. Submitting a name signs them in without navigating; the bottom bar becomes their bar. Pressing `play ranked ▸` enters the queue in the same room.

**Why this priority**: Landing and lobby were two screens for one act; the hero sold the game to someone already inside it; the directory was a card wall. Making the lobby a room state removes three screens and lets the field itself teach the swap.

**Independent Test**: Open the app signed out. Verify the room renders with the name input in the bottom bar. Pick and preview two letters on the warm-up field; confirm the hint line prices the word and nothing is scored or stored. Enter a name and press play; confirm the URL does not change to a separate landing/lobby page flow and the bar shows the name and rating.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** the room loads, **Then** the bottom bar shows an underlined `your name` input with sub-line `no account needed` and a `play ▸` primary action; the top bar shows `No opponent yet` / `ranked · about 0:10 to find one` / `play ranked ▸` (disabled until signed in).
2. **Given** the lobby room and a signed-in player with preview on, **When** they pick and preview two letters on the warm-up field, **Then** the preview works exactly as in a match and the live row prices the word, but no move is submitted, no word is scored and no territory is recorded.
2a. **Given** a signed-out visitor, **When** they pick two letters on the warm-up field, **Then** the letters swap locally, the hint reads `tap a second letter`, and no pricing request is sent (preview pricing requires a session).
3. **Given** a name is entered and submitted, **When** the session is created, **Then** the bottom bar becomes the signed-in bar (name, rating, `you`) in place, without a route change or loading skeleton.
4. **Given** other players are present, **When** the lobby ledger renders, **Then** the `here now · challenge for a ranked match` table lists each player with rating, the rating difference versus the viewer, and a `challenge ▸` action; the `your last matches` table lists opponent, score and rating change.
5. **Given** a player presses `challenge ▸` on another player, **When** the challenge is accepted, **Then** a rated match starts with that player using the existing invite path (all matches are rated; see Clarifications).
6. **Given** the lobby is empty of other players, **When** the ledger renders, **Then** the table shows `—` rows and the live row hint invites the player to press `play ranked ▸`; there is no illustrated empty state.

---

### User Story 8 - Queue and opponent found stay in the room (Priority: P3)

Pressing `play ranked ▸` turns the top bar into the searching state with a moving segment on its lane and a `cancel ▸` action. The field sets itself: a placeholder board's letters land in reading order, and when the real match board arrives at match start the letters that differ swap in place. When an opponent is found, their name and rating write into the top bar, the lane fills, the sub-line counts `round 1 in 3 · 2 · 1`, and the match begins with no separate screen and no route flash.

**Why this priority**: Matchmaking was a separate page with three animations and no letters. Keeping the field on screen during the wait makes the room feel continuous and gives the player something to look at that is the game itself.

**Independent Test**: Press play ranked with a second player queuing. Verify the top bar shows `Finding an opponent` with the travelling lane segment, letters landing one by one, the live row counting letters, then the opponent's name writing in and a 3-2-1 count in the sub-line before round 1 opens, with the field never unmounting.

**Acceptance Scenarios**:

1. **Given** a signed-in player presses `play ranked ▸`, **When** the queue state renders, **Then** the top bar reads `Finding an opponent` / `ranked · 0:07 · cancel ▸` with a 12%-wide coral segment travelling the lane once every 3 seconds, and the ledger caption reads `ranked · 10 rounds · 5:00 clocks`.
2. **Given** the queue state, **When** the field sets itself, **Then** placeholder letters land in reading order roughly 100ms apart and the live row reads `setting the field · 58 of 100 letters`.
2a. **Given** a placeholder field is set, **When** the real match board arrives, **Then** only the letters that differ swap in place (120ms each, end state only under reduced motion) and the field never unmounts.
3. **Given** an opponent is matched, **When** the found state runs, **Then** the top bar writes the opponent's name and rating within 200ms, the lane fills to the full budget, the sub-line counts `round 1 in 3 · 2 · 1`, and the room enters the match state without a route flash or versus screen.
4. **Given** the queue state, **When** the player presses `cancel ▸`, **Then** the room returns to the lobby state with the same field and no navigation.

---

### User Story 9 - The result is stated once, in the same room (Priority: P3)

When the match ends, the field freezes with all bands, the bars show final totals and rating change sub-lines, and the ledger shows a verdict block, all ten rows, territory, the rematch notice when requested, and the actions `rematch ▸ · new opponent ▸ · lobby`. There is no confetti, no red, no modal. The field stays until the player leaves.

**Why this priority**: The post-game hid the board and said the result five times. Stating it once in the ledger and leaving the field visible respects the design's voice and lets players review the whole match.

**Independent Test**: Complete a match. Verify the ledger verdict `<name> wins 170–127` with `by 43 points · 10 words to 8 · territory 32–25`, both bars' sub-lines showing `1191 → 1203 · +12 · wins` and `1204 → 1192 · −12`, the field still showing every band, and rematch negotiation happening entirely in the live row.

**Acceptance Scenarios**:

1. **Given** a match ends, **When** the final state renders, **Then** the field shows every band and the bars show final totals; no summary page or modal replaces the room.
2. **Given** ratings have been computed, **When** the bars render, **Then** each sub-line shows `<old> → <new> · ±n` with `· wins` on the winner's; if the rating is not yet available the sub-line reads `rating pending`.
3. **Given** the final state, **When** the ledger renders, **Then** a verdict block sits above the column header with the winner sentence and a mono line of margin, word counts and territory; a draw is stated in the same voice.
4. **Given** the final state, **When** the opponent requests a rematch, **Then** the ledger shows `<name> asks for a rematch · accept ▸ · decline` as a live-row-styled notice; accepting starts the rematch in the same room; declining removes the notice.
5. **Given** the final state, **When** the player chooses `new opponent ▸`, **Then** the room enters the queue state; `lobby` returns to the lobby state.
6. **Given** the verdict appears, **When** assistive technology is active, **Then** it is announced once assertively.

---

### User Story 10 - Profile in the same grammar (Priority: P4)

A player's profile is the same two-column grid: identity row, hairline 30-day rating chart and a four-cell record row on the left; `best words` and `recent matches` ledgers on the right, with `◂ lobby` and `change name · sign out` in the foot. Another player's profile uses the opponent colour. Tapping a match opens its final room state read-only.

**Why this priority**: The profile was a dashboard with a cloud of best words and cards. It is the last screen to convert and does not block play.

**Independent Test**: Open your own profile and another player's. Verify the seat colour is teal for yours and coral for theirs, the rating chart is a single hairline polyline over three gridlines with no fill or markers, and tapping a recent match opens the final room state.

**Acceptance Scenarios**:

1. **Given** a player opens their own profile, **When** it renders, **Then** the identity row shows a teal seat square, name, `playing since <month> · <n> matches`, and the rating right-aligned with `rating · peak <n> · <±n> this week`.
2. **Given** the rating chart, **When** it renders, **Then** it is a single 1.5px polyline in the seat colour over three rule-coloured gridlines with ink axes and mono labels; no area fill, markers or tooltip.
3. **Given** the record row, **When** it renders, **Then** it shows won / lost / drawn / win rate as four ruled cells.
4. **Given** the right column, **When** it renders, **Then** `best words` lists word (seat colour), points and `vs <name>`; `recent matches` lists opponent, score and rating change; tapping a match opens that match's final room state read-only.
5. **Given** another player's profile, **When** it renders, **Then** the seat colour is coral throughout.

---

### User Story 11 - Documentation matches the design (Priority: P4)

Repository documentation (rules, PRD, architecture, README, agent instructions, superseded specs and proposals) says what the game and its UI now are, and stops saying what they were.

**Why this priority**: The design was derived from the rules document, and the repo's docs are the source future work reads. Stale docs (the previous theme, the per-round clock notation, an eight-direction word finder, "hidden until both submit") would misdirect the rebuild.

**Independent Test**: Run the grep list in `DOCS_CONSISTENCY.md §10` (`pnpm docs:check`) over `README.md`, `CLAUDE.md`, `docs/` (excluding `docs/archive/` and the design bundle itself) and the active spec folders under `specs/` (shipped specs 001–043 are immutable records of what was built and are skipped; those whose UI was retired carry `SUPERSEDED.md`); it returns nothing. The rules document has a time-control section and a "what the player sees" subsection.

**Acceptance Scenarios**:

1. **Given** the rules document, **When** read, **Then** it contains a clock-model section (one match-long budget per player, running only while that player's move is open, with the consequence at 0:00 stated), a sentence on double-direction scoring, the BORÐA + GILT example, and a "what the player sees" subsection mapping each rule to its rendering.
2. **Given** the PRD and architecture documents, **When** read, **Then** time control, scoring directions, dictionary, timer colours, error colours, visibility and screens match the rules document and the design system, or the document is marked historical.
3. **Given** the previous design bundles and superseded specs, **When** read, **Then** each carries a superseded note pointing to the Field & Ledger plan and the replacing component.
4. **Given** `README.md` and `CLAUDE.md`, **When** read, **Then** they describe the Field & Ledger system, link the design system as binding, list the room components, and no longer describe the previous redesign as current.

---

### Edge Cases

- **Both players pick the same letter**: the first commit wins (existing rule). The second player's pick clears when the opponent's pin arrives; the live row states why. The second player's preview, if it included that letter, reverses.
- **Opponent's pin lands on a letter in the player's preview**: the preview reverses, the pin shows in coral, the live row explains, and the player's clock keeps running.
- **First-mover instant reveal freezes a letter the second mover has picked**: the pick clears silently on the field and the live row (which is polite live-region text) announces it.
- **A run valid in both directions**: one word record (the forward reading, rules §3.1), one band, one chevron, one word in the ledger row.
- **A word fully or partly overlapping frozen letters of the other seat**: bands for both seats are drawn; shared letters render in ink.
- **A ledger row overflowing three lines**: older rounds collapse to totals only; the ledger never scrolls.
- **Very long player names**: the name truncates with an ellipsis in the bar and the ledger header; the sub-line never wraps.
- **Clock reaches 0:00**: the player cannot submit further swaps; the round resolves with a timeout pass for them; the lane is empty and the numeral reads `0:00` muted. The match continues to round 10 for the opponent (existing server behaviour; see Assumptions).
- **Reduced motion**: every duration is 0ms and end-state only; the lane holds solid instead of blinking; the setting field appears complete.
- **Window resized mid-match**: the field recomputes its square from the room's size; no layout jump exposes an overlay or scroll.
- **Rating not yet computed at match end**: bars read `rating pending`; the verdict block still renders.
- **Realtime falls back to polling**: nothing visible changes except latency; no status badge is shown (a fact about the connection has no home in the room).
- **Player disconnects during the queue**: the queue is cancelled server-side as today; on return the room shows the lobby state.
- **Non-participant opens a match URL**: completed match → read-only final room (no actions except `◂ lobby`, no rematch, seat colours teal = player A / coral = player B, no `· you` marker); live match → redirect to the lobby room; signed out → landing room.
- **Sign-out during a match**: the `⋯` menu in a match offers leave (which resigns); sign-out is only in the lobby menu.

## Requirements *(mandatory)*

### Functional Requirements

**Room and layout**

- **FR-001**: The application MUST render lobby, queue, found, match, final and profile as states of one room composed of a top player bar, a field, a bottom player bar and a ledger; the field MUST remain mounted across these state transitions with no loading skeleton or route flash.
- **FR-002**: At widths ≥ 1100px the room MUST be a two-column layout (stack left, 340px ledger right, 56px gutter); at 900–1100px the ledger MUST be 260px with a 40px gutter; below 900px the room MUST be a single column bar / field / bar / live row with the remaining ledger available as a sheet opened from the live row.
- **FR-003**: The field MUST be the largest square that fits after the two bars and their gaps are placed, capped at 720px, computed from the room's actual size; the room MUST never require vertical scrolling at 1440×900, 1280×800 or 390×844.
- **FR-004**: The ledger's top rule MUST align with the top bar's top edge and its foot MUST be flush with the bottom bar's bottom edge at ≥ 1100px.
- **FR-005**: No element MUST ever be positioned over the field: no modals, banners, toasts, overlays, announcements or confetti in any room state.
- **FR-006**: There MUST be no persistent top navigation bar in any room state; account and match controls MUST live in the `⋯` menu in the ledger foot.

**Visual system**

- **FR-007**: All on-screen colour MUST come from the seven design tokens (paper, ink, rule, tint, muted, you, opp), with the single exception of the future-round label grey in the ledger; seat colours MUST appear only at full strength, 14% (settled band) and 30% (live reveal).
- **FR-008**: The UI MUST use no gradients, shadows, border radii, blur, avatars, icon sets, illustrations or emoji; the ink square and the chevron are the only marks.
- **FR-009**: Type MUST use exactly two families in the room: a slab serif for letters, names, words and headings, and a monospace face with tabular numerals for every numeral and label, at the scale given in the design system §3; no italics.
- **FR-010**: Seat colours MUST be relative to the viewer (teal = you, coral = opponent) and resolved through a single function of viewer seat and subject seat; no colour MUST be bound to the server's player slot.

**Field**

- **FR-011**: The field MUST render 100 flat paper cells separated by 1px rules inside a 1.5px ink frame, each with a centred uppercase letter at 55% of cell height and a value numeral at 18% of cell height in the top-right gutter.
- **FR-012**: Each letter MUST render exactly one of the states free, picked, previewed, pinned, scored, shared, illegal-pick shake or keyboard focus, with the marks defined in design system §5.1.
- **FR-013**: Each scored word record MUST be drawn as one band (tint of the scorer's seat colour, square ends, inset 20% of a cell on the short axis and 5% on the long axis, clipped to frozen letters for partial freezes) with a 1.5px chevron at the reading start on the edge matching its reading direction.
- **FR-014**: Each scored word record MUST carry its reading direction (left-to-right, right-to-left, top-to-bottom, bottom-to-top) so the field can place the chevron; a run valid in both directions is one record (forward reading) and MUST show exactly one chevron.
- **FR-015**: Coordinate labels, the lock banner, the round announcement overlay, move-feedback toasts, the invalid-move colour flash and the pulsing waiting frame MUST be removed from the field; coordinates MUST survive only in each cell's accessible label.
- **FR-016**: Value numerals MUST be muted on free letters, take the scorer's seat colour on scored letters, and ink on picked letters.

**Interaction**

- **FR-017**: The swap interaction MUST follow the state machine idle → picked → committed by default, and idle → picked → preview → committed when the preview setting is on; only the commit step sends a move; Escape, tapping elsewhere or re-tapping the picked letter MUST return to idle and reverse any preview.
- **FR-018**: During a preview (preview setting on) the ledger hint line MUST show the total of any words the preview would form, computed client-side from the visible board with the same scoring rules as the server, and MUST NOT draw hints on the field.
- **FR-019**: A user setting `preview` (default **off**) MUST insert the preview step; with it off the second tap commits directly (current behaviour). The setting MUST be toggled from the `⋯` menu and persist like the sound preference.
- **FR-020**: Pointer drag from one letter to another MUST behave like a second tap under the current setting (commit by default, preview when the setting is on).
- **FR-021**: Tapping a frozen or pinned letter MUST shake that letter for 300ms in its own colour and write `frozen · <name> R<n> · pick another` into the live row for 2 seconds.
- **FR-022**: When the opponent's swap arrives, their two letters MUST pin in coral immediately; if one of them was the player's pick or in the player's preview, the player's state MUST return to idle and the live row MUST state why.
- **FR-023**: The field MUST be operable by keyboard: arrows move focus, Space picks (and previews when the setting is on), Enter commits, Escape cancels, `?` opens rules, `M` toggles sound.

**Player bars**

- **FR-024**: Each bar MUST be 60px (56px on phones) with a three-part layout: seat square + name + one-line sub-line on the left; clock centred; total or primary action on the right; the opponent's bar MUST always be on top and the viewer's at the bottom.
- **FR-025**: Each bar's edge nearest the field MUST be a clock lane whose full width equals the 5:00 match budget, filled in the seat colour for remaining time and rule-coloured for the rest; under 1:00 the lane MUST be 8px and blink at 1Hz in colour only (solid under reduced motion).
- **FR-026**: The clock numeral MUST be ink at medium weight while running and muted at regular weight when stopped; a player's lane MUST stop when they submit.
- **FR-027**: On opponent disconnect the bar sub-line MUST read `reconnecting · <m:ss> left`, the lane MUST become a dashed pattern in the seat colour and hold, the viewer's clock MUST hold, and no overlay MUST appear; the claim-win path MUST remain reachable from the ledger once the grace period ends.
- **FR-028**: An empty seat MUST render a dashed-outline square, a state sentence (`No opponent yet`, `Finding an opponent`) and the primary action in place of a total.
- **FR-029**: Lanes MUST expose a progress role with min 0, max 300 (the match budget in seconds), current seconds and a text value such as `6:45 remaining, running`.

**Ledger**

- **FR-030**: The ledger MUST be a single non-scrolling column: caption (wordmark + context), column header (match and final only), rounds table, territory bar and counts, hint line, notices, foot.
- **FR-031**: The rounds table MUST have one row per round sharing the available height equally, with words joined by ` · ` in the scorer's seat colour and the round total pinned top right; future rows MUST show only their label.
- **FR-032**: The current round MUST render as the live row (tinted background, 3px ink left rule) carrying `picking · <letter> (<value>)`, `played ●`, then the words as they land; the live row MUST be a polite live region.
- **FR-033**: Hovering or tapping a round row MUST highlight that round's bands on the field and dim the others, and show per-word points in the row.
- **FR-034**: If a row would exceed three lines, rounds older than the last three MUST collapse to totals only, with words on hover.
- **FR-035**: Rematch requests, resign confirmation, first-match rules (shown when the viewer's server-side completed-match count is 0 at match start, never from a device flag) and illegal-pick notices MUST render as live-row-styled lines in the ledger and MUST NOT open a dialog; the resign confirmation MUST revert after 5 seconds.
- **FR-036**: The ledger foot MUST hold `? rules` and the state's actions on the left and a `⋯` menu on the right (lobby: sound, profile, sign out; match: sound, resign, leave).
- **FR-037**: The lobby variant MUST show a `here now` table (name, rating, difference versus viewer, `challenge ▸`), a `your last matches` table (opponent, score, rating change), the warm-up hint in the live row, and `—` rows while loading instead of skeletons.

**Room states**

- **FR-038**: Landing MUST be the lobby room with the bottom bar in the empty state: an underlined name input, `no account needed`, and `play ▸`; submitting MUST create the session and convert the bar in place without navigation.
- **FR-039**: The lobby MUST show a warm-up field (a real random board) on which pick and commit work locally with nothing submitted, scored or stored; preview pricing on the warm-up field MUST be available only to signed-in players (no anonymous pricing endpoint).
- **FR-040**: The queue state MUST show `Finding an opponent` / `ranked · <elapsed> · cancel ▸` with a travelling lane segment, and the field MUST set itself letter by letter from a placeholder board, with the live row counting letters; when the real board arrives at match start only the differing letters MUST swap in place.
- **FR-041**: The found state MUST write the opponent's name and rating into the top bar, fill the lane, count `round 1 in 3 · 2 · 1` in the sub-line, and enter the match state without a versus screen.
- **FR-042**: The final state MUST keep the field with all bands, show final totals and rating sub-lines (`<old> → <new> · ±n · wins`, or `rating pending`), a verdict block in the ledger (`<name> wins <a>–<b>` + `by <n> points · <w> words to <w> · territory <t>–<t>`), the rematch notice when requested, and the actions `rematch ▸ · new opponent ▸ · lobby`.
- **FR-043**: Challenges from the lobby directory MUST start matches through the existing invite path; challenge matches are rated exactly like queued matches (no `unranked`/`casual` label anywhere).

**Profile**

- **FR-043a**: A signed-in non-participant opening `/match/[id]` MUST see the read-only final room when the match is completed (no actions, no rematch, seats coloured player A teal / player B coral without a `· you` marker) and MUST be redirected to the lobby when the match is live; signed-out visitors MUST be redirected to the landing room.
- **FR-044**: The profile MUST use the same two-column grid: identity row, hairline rating chart and four-cell record row on the left; `best words` and `recent matches` ledgers with a `◂ lobby` / `change name · sign out` foot on the right; another player's profile MUST use the opponent colour; tapping a match MUST open its final room state read-only.

**Motion, sound and copy**

- **FR-044a**: A word's band MUST be drawn at most once per match; at round resolution the reveal MUST animate only words not already revealed by the instant first-mover path, and totals MUST count up only by the delta not yet shown.
- **FR-045**: Motion MUST use only the durations and easing in design system §6 (ring/pin 120ms, preview 150ms, band 400ms staggered 120ms, count-up 400ms, pin fade 200ms, name write 200ms, setting letters ~100ms apart); geometry MUST not animate except the preview exchange and the picked scale; under reduced motion everything MUST be 0ms and end-state only.
- **FR-046**: Sounds MUST be `tile-select` on pick, `valid-swap` on commit (with haptic where available) and a tick per band on reveal; nothing on cancel or error; sound MUST be toggled from the `⋯` menu and remembered as today.
- **FR-047**: All copy MUST follow design system §8: sentence case, mono uppercase labels, lowercase wordmark, no exclamation marks, the fixed strings as listed with the clock budget written as `5:00` (`ranked · 10 rounds · 5:00 clocks`); the retired strings listed in `DOCS_CONSISTENCY.md §10` (the hidden-until-both-submit line, the waiting-for-opponent banner, the clock tagline and the rematch exclamation) MUST not appear.

**Accessibility**

- **FR-048**: Every cell MUST expose a gridcell role and an accessible label of the form `row 8, column F, T, value 2, <state>`; the verdict MUST be announced assertively once; colour MUST never be the only carrier of seat, direction or clock state.
- **FR-049**: Text contrast MUST be ≥ 4.5:1 for ink, muted and teal on paper; coral MUST be used for text only at ≥ 17px.

**Removals**

- **FR-050**: The following surfaces MUST be removed, not restyled, once their replacement ships: stat cards, centre chrome, round pips, tiles-claimed card, scored-words card, left-rail cards (how to play, legend, your move), score-delta popup, round summary panel, round history panel, lock banner, round announcement, move-feedback toasts, coordinate labels, landing screen and hero, play-now card, lobby card wall and directory, empty-lobby illustration, matchmaking ring, versus block, final summary, post-game verdict/scoreboard cards, rematch banner, disconnection modal, profile sidebar/stat/best-words cloud/match list, and the top bar.

**Documentation**

- **FR-051**: The rules document MUST gain a clock-model section, a one-record-per-run sentence with a regression test named for it, the BORÐA + GILT example, and a "what the player sees" subsection, before the field work begins.
- **FR-052**: The PRD, architecture and ideation documents MUST be aligned with four orthogonal directions, the match-long clock model, the BÍN dictionary, broadcast-on-submit visibility, lane clocks, in-colour shake, and the single room, or marked historical.
- **FR-053**: The previous design-system bundle, the previous Claude Design handoff bundles, the previous phased plan, and every spec or proposal describing retired UI MUST carry a superseded note pointing to the Field & Ledger plan; the new design bundle MUST live at a stable documented path.
- **FR-054**: `README.md` and `CLAUDE.md` MUST describe the Field & Ledger system, link the design system as binding, add the design rules block from `DOCS_CONSISTENCY.md §8`, and list the room components; test documentation MUST name the new test ids.
- **FR-055**: At the end of the work, the grep list in `DOCS_CONSISTENCY.md §10` MUST return nothing over `README.md`, `CLAUDE.md`, `docs/` (excluding `docs/archive/` and the design bundle) and the active spec folders under `specs/`; shipped specs are historical records and are not rewritten (retired-UI ones carry `SUPERSEDED.md`). The check is `pnpm docs:check` and runs in CI.

### Key Entities

- **Room**: the single screen composition (top bar, field, bottom bar, ledger) and its state: lobby, queue, found, match, final, profile. Route may change; the room does not.
- **Seat**: the viewer-relative identity of a player, `you` or `opponent`, carrying a colour (teal / coral), a position (bottom / top) and a word in the sub-line. Distinct from the server's player slot.
- **Player bar**: one player's facts: seat square, name, rating, sub-line, clock, total, clock lane, and the empty / searching / found / playing / final states.
- **Field**: the 10×10 grid of letters, each with a value and a state (free, picked, previewed, pinned, scored, shared), plus the word bands drawn over the cells but under nothing.
- **Word band**: the rendering of one scored word record: scorer's seat, cells covered, reading direction (determines the chevron edge), and whether it is settled (14%) or live (30%).
- **Scored word record**: an existing entity (player, word, points, coordinates) extended with reading direction; exactly one record per run.
- **Ledger**: the match's facts: context caption, seat header, ten round rows (one live), territory counts, hint, notices, foot actions. Lobby variant: presence table, recent matches, hint.
- **Live row**: the current round's ledger row and the only place transient state text (picking, played, illegal pick, notices, first-match rules) is written.
- **Clock lane**: one player's remaining time drawn as a filled fraction of the match budget, with running / stopped / low / disconnected states.
- **Territory**: counts of frozen letters per seat and free letters, derived from frozen tiles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 1440×900 window with browser chrome, a match renders with zero vertical scrolling and the ledger's foot flush with the bottom bar; at 1280×800 the field measures at least 560px; at 390×844 portrait, bar / field / bar / live row are all visible without scrolling.
- **SC-002**: In every room state, zero elements are positioned over the field (verified by an automated overlap check over the field's bounding box).
- **SC-003**: Every colour sampled on screen belongs to the seven tokens (plus the future-row grey in the ledger), and a repository search for radii, shadows, gradients, third-hue utilities and the retired font names under the app and component folders returns zero matches.
- **SC-004**: A first-time player with no instructions completes a swap (pick → commit) within their first round in at least 9 of 10 moderated sessions, and, with preview on, zero of those sessions record an unintended commit.
- **SC-005**: Shown a settled field, players correctly identify which player scored a word and which way it reads in at least 95% of trials, using the band colour and chevron alone.
- **SC-006**: Shown the two bars, players correctly say which player has more time left within 2 seconds in at least 95% of trials.
- **SC-007**: A round resolving with three words completes its reveal and settle in under 2.5 seconds; with reduced motion the end state is visible immediately.
- **SC-008**: Lobby → queue → found → match → final → rematch runs with zero route flashes or loading skeletons and the field never unmounts (verified by a single field element identity across the flow).
- **SC-009**: The two-player end-to-end flow (sign in, queue, pair, pick → commit, pick → preview → commit with the setting on, Esc cancels a preview, opponent pin during preview, reveal, final, rematch notice) passes in CI, and automated accessibility checks report zero violations in every room state.
- **SC-010**: The documentation grep list returns nothing, and the rules document contains the clock model, one-record-per-run sentence, BORÐA + GILT example and "what the player sees" subsection.
- **SC-011**: Performance budgets are unchanged: move round-trip, validation and broadcast latencies stay within the constitution's limits; the preview hint prices a board within one frame on a mid-range phone.

## Assumptions

- **Clock budget stays 5:00 per player** (decision Q1, 2026-09-14). The design's `10:00` copy, lane scale and accessibility max are adapted to 5:00; no rule or server change.
- **Second tap commits by default** (decision Q2, 2026-09-14). Preview is an opt-in setting.
- **Queue field is a placeholder** (decision Q3, 2026-09-14). Letters that differ swap in when the real board arrives at match start; no server change.
- **One record per run is current behaviour.** The scanner produces a forward and a reversed candidate, but overlapping same-axis readings conflict and the cross-validator keeps one (the forward reading when both are words). FÁR/RÁF is therefore one record, `fár`; this spec pins it with a named regression test and does not change scoring. The design plan's "two chevrons" case does not occur.
- **0:00 on a clock keeps the match going.** The server already synthesises a timeout pass for a player whose clock has expired and continues to round 10 for the opponent; the bar renders `0:00` muted with an empty lane. No rule change.
- **Warm-up field never keeps score** (plan §12.4, recommended answer adopted).
- **All matches are rated**, including directory challenges (Clarifications 2026-09-14, Q1). Design plan §12.5's "unranked only" is not adopted because it would require a rating change, which is out of scope.
- **Rounds are ten.** The ledger has ten rows; the caption reads `round n of 10`.
- **Existing server contracts stay.** Move submission, broadcast on submit, instant first-mover reveal, rematch requests, claim-win and Elo are reused; the only contract change is adding the reading direction to scored word records.
- **Sound and haptic preferences** keep their current storage and defaults; the `⋯` menu is the new toggle location.
- **Routes may remain** (`/`, `/lobby`, `/matchmaking`, `/match/[id]`, `/profile`) as long as the room stays mounted and no state transition flashes.
- **Documentation updates land with the step that makes them true**, except the rules clarifications, which land first (per `DOCS_CONSISTENCY.md`). Documents that describe retired UI are marked superseded, never deleted.

## Decisions (resolved 2026-09-14)

| # | Question | Decision | Consequence |
|---|---|---|---|
| Q1 | Match clock budget: design assumes 10:00, game runs 5:00 | **Keep 5:00** | Lane full width = 5:00, progress max 300, copy `5:00 clocks`; design plan §1.3/§5, system §5.3/§8/§9 read with 5:00 substituted; no engine change |
| Q2 | Second-tap default | **Instant commit by default; preview opt-in** | FR-017/019/020 as written; design plan §4.3 inverted (`preview` setting replaces `instantCommit`); hint copy `tap a second letter` by default |
| Q3 | Queue field content | **Placeholder board, swap differing letters at match start** | FR-040; no board needed before pairing; live row omits `an opponent joins when the last one lands` |

## Out of Scope

- Changes to matchmaking, rating, scoring formula, coverage rule, freeze rule or conflict resolution.
- New game features beyond those the design implies (warm-up field, preview step, seat-relative colour, reading direction on word records).
- Long-form pages outside the room (help, about) and their typography.
- Multi-language support, authentication provider changes, observability and production hardening (tracked separately).
- Dropping the legacy `boards` table and other cleanups listed in the repo's next steps.
