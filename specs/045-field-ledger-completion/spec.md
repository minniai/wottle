# Feature Specification: Field & Ledger Completion

**Feature Branch**: `045-field-ledger-completion`
**Created**: 2026-09-15
**Status**: Draft
**Input**: User description: "analyse the Claude Design implementation review in docs/design_documentation/260915-design-scope-clarification/IMPLEMENTATION_REVIEW.md and Wottle Implementation Review.dc.html and all relevant documents in that folder, and make sure to implement a complete design according to the design-scope-clarification."

**Sources** (binding for this feature):

- `docs/design_documentation/260915-design-scope-clarification/IMPLEMENTATION_REVIEW.md` — twenty-five findings (A1–E2) against spec 044, each with file and line evidence. Section 3 lists what already matches the design value by value: **that list is out of scope and must not change.**
- `docs/design_documentation/260915-design-scope-clarification/Wottle Implementation Review.dc.html` — visual companion. Section 02 renders the field twice from the committed stylesheet: **fixture A** (what ships today) and **fixture B** (the target). Fixture B is the acceptance image for the field.
- `docs/design_documentation/260915-design-scope-clarification/README.md` — the handoff: seven steps R1–R7, the exact target values for field paint, room composition, phone ledger, interaction, motion, tokens and the fixture route, and the three decisions given on 15 September 2026.
- `docs/design_documentation/260915-design-scope-clarification/TASKS.md` — task-level detail T001–T041 (copied into this feature's `tasks.md`).
- `docs/design_documentation/260915-design-scope-clarification/WOTTLE_DESIGN_SYSTEM.md`, `WOTTLE_DESIGN_PLAN.md`, `DOCS_CONSISTENCY.md` — the design bundle **as authored**, before the five team decisions of 14 September. Where the bundle and the decisions disagree, the decisions win, and this feature updates the repo's copy of the bundle to say so.
- `docs/design_documentation/260915-design-scope-clarification/Wottle UX Audit.dc.html` — the design source. Fig. 2 desktop match, Fig. 5 phone, Fig. 6 lobby, Fig. 7 matchmaking, Fig. 8 post-game, Fig. 9 profile, Fig. 10 states.

## Summary

Spec 044 rebuilt every player-facing screen as one room. The review found the architecture complete and faithful — one room, seat-relative colour through one function, bars with lanes, bands with chevrons from the reading direction, a ledger that shares ten rows and folds, notices as live-row lines, every room state, profile on the room grid, the retired components gone — and the pixels never checked. The Playwright, axe and reference-screenshot tasks were recorded as "not run locally — no Supabase", and the unit layer is JSDOM, which does not paint.

Three paint defects shipped as a result. The field's paper ground is hidden beneath its own rule colour, so every cell renders grey and the 1px rules are invisible. The letter size reads a `--cell-size` custom property that is never declared, so letters are a fixed 26px at every screen size instead of 55% of the cell. The chevrons that mark each word's reading start are drawn at 0.15 device pixels. Alongside them, the phone ledger never collapses: below 900px the whole ledger stacks under the bottom bar and the page scrolls, and the sheet component written for that case is imported by nothing but its own test.

This feature is a **completion, not a rebuild**. It closes the review's findings in the order the review gives, and it starts by making the room visible without a database — a fixture route rendering each room state from static data — because the absence of a rendered check is what let the paint defects ship. Nothing in `components/room/`, `lib/room/` or the room states is restructured beyond the two view/controller splits the fixture route needs.

**Fidelity is high.** Every value is binding: tokens, type sizes, geometry and motion come from the design system with the five team decisions of 14 September applied, plus the three decisions given on 15 September. Where the code and the design disagree, the code is wrong.

## Clarifications

### Session 2026-09-15 (decisions given by the team)

- Q: Are directory challenges (direct invites) ranked? → A: **Unranked.** Choosing your own opponent should not move a rating. Matches carry a `rated` flag, invites create it `false`, the rating update is skipped, captions read `unranked`, and the lobby copy reads `challenge for an unranked match`. **This supersedes spec 044's clarification of 2026-09-14** ("All matches stay rated as today… no `unranked` label anywhere"), which is now void.
- Q: Coral is 3.4:1 on paper, and the design system allows coral text only at 17px and above, but ledger words are 14px and scored-letter numerals are smaller still. The implementer excluded both from the automated contrast check. → A: **Add one text-only colour, `--opp-text #C2402A` (5.1:1 on paper)**, used wherever coral is *text* below 17px: ledger words, scored numerals, the profile's `vs` rows. Letters on the field, lanes, totals and seat squares stay `--opp`. The palette becomes eight values; the two coral contrast-check exclusions are removed. The third exclusion — the future-round labels in the permitted grey, hidden from assistive technology — is a design-system exception and stays.
- Q: The design's value numeral is 18% of the cell, which is 6.5px in a 36px phone cell. → A: **Floor it at 9px and hide it below a 32px cell.** The letter's accessible name still carries the value, so nothing is lost to a screen reader.

### Decisions inherited from 2026-09-14 (spec 044; not defects, and not reopened here)

Each player has one 5:00 clock for the whole match; the second tap commits and preview is opt-in from the `⋯` menu, priced by a read-only server call; the queue field is a per-player placeholder swapped for the real board at match start; a run valid in both directions scores once, read forward, so every band carries exactly one chevron; 0:00 is a timeout pass in every remaining round and both players at 0:00 ends the match. The implementation already follows all five. **The design bundle in the repository still says 10:00, preview-by-default and two chevrons, and this feature updates it.**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The room can be seen without a database (Priority: P1)

A developer or reviewer opens a single URL on a laptop with no environment file, no Supabase running and no second player, and sees any room state — landing, lobby, queue, opponent found, match, reveal, final, disconnect, profile — rendered from fixed data at any window size. Screenshots of those states are what every later story is judged by.

**Why this priority**: The review's root cause. Every visual assertion in the repository today needs two signed-in players against a live database, so none of them ran, so three paint defects and an unwired phone ledger shipped. Until the room renders cheaply, no fix can be verified and no regression can be caught. This story is worth shipping alone even if nothing else in this feature lands: it turns "looks right to me" into an artefact.

**Independent Test**: On a machine with no `.env.local`, start the app and open the fixture route for each of the nine states at 1440×900, 1280×800 and 390×844. Every state renders fully; no request reaches a database; the match state shows the field as the review's fixture A (the "before" image).

**Acceptance Scenarios**:

1. **Given** a development environment with no database configured, **When** the fixture route is opened for any of the nine room states, **Then** the room renders complete — both bars, the field with one hundred letters, the ledger — from static data only.
2. **Given** the fixture route, **When** the application runs in production, **Then** the route is not found, unless an explicit opt-in flag is set.
3. **Given** the fixture route, **When** its source is inspected, **Then** nothing under it reaches a database client or a server action, and this is enforced by a test.
4. **Given** the nine states at the three reference window sizes, **When** the visual suite runs, **Then** it captures one image per state per size and compares them with committed reference images, with animations disabled and fonts loaded.
5. **Given** the lobby and queue states, **When** they render on the fixture route, **Then** they render from the same presentational components the live application uses, so a screenshot of the fixture is evidence about the live room.

---

### User Story 2 - The field looks like the design (Priority: P1)

A player in a match sees a paper-coloured field of one hundred capitals, divided by fine rules that cross the tinted word bands, framed by a single dark line. The letters fill their cells the same way at every screen size. Each band carries one clearly visible chevron at the reading start of its word.

**Why this priority**: The field is the game. Today it renders as a flat grey slab with no visible divisions and letters that are too small on a laptop and too large on a phone, and the chevrons that tell a player which way a word reads are invisible at every size. This is the single largest gap between the code and the design, and the review's fixture B is an exact target image for it.

**Independent Test**: Open the match state on the fixture route at 1440×900 and at 390×844 and compare with fixture B in the review companion: paper cells, one-pixel rules crossing the bands, a heavier frame, letters at 55% of the cell at both sizes, and chevrons at the left edge of the horizontal word and the top edge of the vertical one.

**Acceptance Scenarios**:

1. **Given** a rendered field, **When** a cell's background is measured, **Then** it is paper, not the rule colour, at every cell including those beneath a band.
2. **Given** a rendered field, **When** the divisions between cells are measured, **Then** each interior edge is a one-pixel rule in the rule colour, the outer frame is a heavier dark line, and no rule is drawn outside the frame.
3. **Given** a field at any size, **When** a letter is measured, **Then** its size is 55% of the cell's size and the value numeral is 18% of the cell, floored at 9px.
4. **Given** a field whose cells are smaller than 32px, **When** it renders, **Then** the value numerals are hidden and each letter's accessible name still states its value.
5. **Given** a scored word band, **When** its chevron is measured, **Then** the stroke is 1.5px on screen at every field size, and the chevron sits at the reading start of the word.
6. **Given** a player picking a letter, **When** the ledger's live row names it, **Then** the row states the letter's real point value, not zero.
7. **Given** a player tapping a letter frozen in an earlier round, **When** the notice appears, **Then** it names the round in which that letter froze, not the current round.
8. **Given** a player bar beside the field, **When** the seat square and the total are measured, **Then** they align with the field's frame with no inset.

---

### User Story 3 - The room sits as one composition (Priority: P2)

A player on a desktop sees the field and the ledger separated by one gutter of the designed width, the pair centred in the window, whatever the window's width. The ledger's live row is tinted edge to edge with its rule at the left edge and the round label inside the tint. A player waiting in the queue sees the queue's own progress in that same live row rather than in a plain line of text.

**Why this priority**: The layout reads as an accident today — at 1440×900 the gap between field and ledger is about three times the designed width, because the stack is centred inside its own column instead of the room being centred as a whole. It is highly visible on every screen and cheap to fix, but it comes after the field because the gutter can only be measured once the field is its true size.

**Independent Test**: Open the match state at 1440×900 and 1280×800 and measure from the field's right edge to the ledger's left edge; open the queue state and confirm the progress line renders in a tinted live row.

**Acceptance Scenarios**:

1. **Given** the room on a window 1100px wide or wider, **When** the distance from the field's right edge to the ledger's left edge is measured, **Then** it is the designed wide gutter, and the field-and-ledger pair is centred in the window.
2. **Given** the room on a window between 900px and 1100px, **When** the same distance is measured, **Then** it is the designed narrow gutter.
3. **Given** the ledger's live row, **When** it renders, **Then** the tint spans the full width of the ledger with the rule at its left edge and the round label inside the tint, aligned with the round labels of the rows above.
4. **Given** a player in the queue, **When** the field is being set and when the opponent is found, **Then** the progress and the countdown appear in a tinted live row above the hint line, in the same form the match uses.
5. **Given** a request for a match that does not exist, **When** the page loads, **Then** the player arrives in the lobby room with a notice line stating that the match does not exist, rather than on a bare unstyled page.

---

### User Story 4 - The room fits a phone (Priority: P2)

A player on a phone sees the opponent's bar, the field, their own bar and one live row, with no page scrolling. Tapping the live row opens the rest of the ledger — the seat header, the ten rounds, the notices and the controls — in the space below it, scrolling within itself and never covering the field or either bar. Closing it returns to the four-part layout.

**Why this priority**: On a phone today the entire ledger stacks beneath the bottom bar and the page scrolls, which breaks the design's central rule that nothing is ever placed over the field and that the room fits the window. It is the largest remaining structural gap, and it depends on the full-width live row from the previous story.

**Independent Test**: Open the match state at 390×844, confirm the page does not scroll with the sheet closed or open, confirm the sheet's top edge is at or below the bottom bar's lower edge, and confirm cells remain comfortably tappable.

**Acceptance Scenarios**:

1. **Given** a window 900px wide or narrower, **When** the room renders, **Then** the ledger shows only the caption, the live row, the territory bar and its counts, and the live row offers to open the history.
2. **Given** the collapsed ledger, **When** the player activates the live row, **Then** the remaining ledger opens beneath it, scrolls within its own bounds, and its top edge never rises above the bottom bar's lower edge.
3. **Given** the open sheet, **When** the player presses Escape or activates the close control, **Then** the sheet closes and focus returns to the live row.
4. **Given** the room at 390×844 with the sheet closed and with it open, **When** the document height is compared with the window height, **Then** the page does not scroll in either case.
5. **Given** the room at 390×844, **When** any field cell is measured, **Then** it is at least 35px square, and every control inside the sheet meets the 44px touch-target minimum.
6. **Given** the open sheet, **When** an automated accessibility audit runs, **Then** it reports no violations.

---

### User Story 5 - The room answers the hand and the keyboard as specified (Priority: P2)

A player drags one letter onto another to swap them, as well as tapping both. Tapping anywhere outside the field cancels a pick. `?` opens the rules and `M` mutes or unmutes. When two letters exchange, they travel to each other's places rather than teleporting; a pin that is released fades out; a found opponent's name is written in rather than appearing. A disconnected player's lane is drawn as the designed dash pattern.

**Why this priority**: Five specified behaviours have no implementation, and the reducer already accepts the events for two of them, so the room feels less responsive than its own design without being visibly broken. It is independent of the layout stories and can be built in parallel with them.

**Independent Test**: In a live match, drag one letter onto another and confirm the swap commits; pick a letter and tap the ledger caption to confirm it cancels; press `?` and `M` and confirm the rules and the sound setting respond.

**Acceptance Scenarios**:

1. **Given** a field with no letter picked, **When** the player presses on one letter and releases over a different one, **Then** the swap is made exactly once and no separate tap is registered.
2. **Given** a field with no letter picked, **When** the player presses and releases on the same letter, **Then** it is picked, as a tap.
3. **Given** a picked letter, **When** the player presses anywhere outside the field that is not a ledger action control, **Then** the pick is cancelled.
4. **Given** a picked letter, **When** the player presses a ledger action control, **Then** the pick is not cancelled and the control acts.
5. **Given** any room state, **When** the player presses `?` or `M` while not typing in a text field and without a modifier key, **Then** the rules open or the sound setting flips.
6. **Given** two letters exchanging places in a preview or a commit, **When** the exchange renders, **Then** each letter travels from the other's position to its own over 150ms.
7. **Given** a pinned letter that is released, **When** the pin is removed, **Then** it fades over 200ms; **and given** an opponent found, **When** their name appears in the bar, **Then** it fades in over 200ms.
8. **Given** a disconnected opponent, **When** their lane renders, **Then** it is the designed 6px/4px dash pattern, not a browser-chosen one.
9. **Given** a player who prefers reduced motion, **When** any of the above motion occurs, **Then** it completes instantly.

---

### User Story 6 - Only the design's own vocabulary is left in the tree (Priority: P3)

A developer reading the codebase finds exactly the design's colour tokens and no others, no leftover code or assets from the previous look, no engine setting that contradicts the rules, and a design bundle in the repository that describes what the code actually does.

**Why this priority**: None of this is visible to a player, but every stale alias and every out-of-date design document is how the next reader inherits the gap the review found. It also carries the three decisions given on 15 September, which do change what a player sees.

**Independent Test**: Search the stylesheets and the theme configuration for the retired colour and font names and find nothing; confirm the token test asserts the exact expected set; run the documentation consistency check.

**Acceptance Scenarios**:

1. **Given** the stylesheets and the theme configuration, **When** they are searched for names from the previous look, **Then** nothing is found, and the check is case-insensitive.
2. **Given** the colour tokens, **When** they are asserted, **Then** the set is exactly the eight values — seven plus the text-only coral — and their derived tints, and nothing else.
3. **Given** coral used as text below 17px anywhere in the room or the profile, **When** its contrast on paper is measured, **Then** it meets the AA minimum, and no selector is excluded from the automated contrast check.
4. **Given** a match created from a directory challenge, **When** it completes, **Then** no rating changes, the captions read `unranked`, and the lobby copy offers `challenge for an unranked match`.
5. **Given** a match created from the ranked queue, **When** it completes, **Then** ratings change exactly as today.
6. **Given** the previous look's remaining code and asset bundle, **When** the tree is inspected, **Then** they are deleted or moved to the archive, with a one-paragraph pointer left where the bundle used to be.
7. **Given** the engine configuration, **When** it is read, **Then** it carries no per-round time limit, which the rules do not have.
8. **Given** the profile's rating chart, **When** it renders at any width, **Then** its axis labels are not stretched.
9. **Given** the design bundle in the repository, **When** it is read, **Then** it states the 5:00 clock, opt-in preview, one chevron per band, eight tokens, the numeral floor, the phone sheet geometry and the challenge ranking as decided, and the consistency check passes.

---

### User Story 7 - Someone has looked at it (Priority: P3)

A person compares each room state, at desktop and phone size, against the figure it was designed from, ticks every line of a written checklist, and records the result. The reference images are committed so that any later change that alters the room fails a test until someone looks again.

**Why this priority**: It is the check every other story is measured by, so it comes last — but without it this feature repeats spec 044's failure. It also clears the outstanding "not run locally — no Supabase" notes by running the full two-player suite against a real database once.

**Independent Test**: The checklist file exists, is complete, and names who compared what and when; the reference images are committed; the visual suite passes against them in continuous integration without a database.

**Acceptance Scenarios**:

1. **Given** each room state at desktop and phone size, **When** a person compares it with its figure using the checklist, **Then** every line is ticked or has a recorded exception, and the result is committed with the feature.
2. **Given** the reference images, **When** the visual suite runs in continuous integration without a database, **Then** it passes, and it fails on any unintended change to the room.
3. **Given** a real database, **When** the full two-player suite runs end to end, **Then** every specification passes and the accessibility audit is clean on landing, lobby, queue, match, final and profile, and the result is recorded with its date — replacing spec 044's "not run locally" notes.
4. **Given** the repository's own guidance documents, **When** they are read after this feature, **Then** they name the fixture route, the visual suite and the eight tokens.

### Edge Cases

- **A window too short for the design's field.** The field is the largest square that fits between the bars up to the design maximum; on a short window it shrinks, and the cell-derived letter and numeral sizes must follow it down, including past the point where numerals are hidden.
- **A phone in landscape.** Below 900px wide the collapsed ledger applies regardless of orientation; the field remains the largest square that fits and the page must still not scroll.
- **A drag that ends outside the field.** Releasing outside the field's bounds must cancel cleanly, leaving no picked letter and dispatching no swap.
- **A drag followed by the browser's synthetic click.** A completed drag must not also register as a tap on the letter under the release point.
- **`?` or `M` while typing a name.** The landing state's name input must receive both characters; the hotkeys must not fire.
- **A frozen letter covered by two words.** When a letter belongs to two scored words from different rounds, the frozen notice names one round deterministically; the earliest is the sensible reading.
- **The sheet open when the round resolves.** The reveal continues on the field beneath the sheet; the sheet's own rows update; nothing is drawn over the field.
- **A match that exists but the viewer may not see.** The existing guards — non-participants to the lobby for a live match, read-only for a completed one — stay as they are; only the "does not exist" case changes.
- **Reduced motion during the reveal.** The reveal, the exchange, the pin fade and the name write all complete instantly, and the ledger and totals still reach their final values.
- **Fonts not yet loaded when a reference image is captured.** The visual suite must wait for fonts, or it will produce unstable images.

## Requirements *(mandatory)*

### Functional Requirements

**Seeing the room without a database**

- **FR-001**: The application MUST provide a fixture view that renders each of the nine room states — landing, lobby, queue, found, match, reveal, final, disconnect, profile — entirely from static data, with no database, no network transport and no authenticated session.
- **FR-002**: The fixture view MUST be unavailable in production unless an explicit opt-in flag is set, and MUST be proven by an automated test to reach no database client and no server action.
- **FR-003**: The fixture view MUST render the same presentational components the live room renders, which requires the lobby and queue views to be separable from their controllers exactly as the match view already is; controller behaviour MUST NOT change.
- **FR-004**: An automated visual suite MUST capture each fixture state at 1440×900, 1280×800 and 390×844, with animations disabled and fonts loaded, and compare it with a committed reference image.
- **FR-005**: The visual suite MUST run in continuous integration without any database service, and MUST become blocking once the reference images are committed.

**The field**

- **FR-006**: Every field cell MUST render on the paper ground, including cells beneath a word band.
- **FR-007**: The divisions between cells MUST be one-pixel rules in the rule colour, drawn so that they cross the word bands, with no rule outside the field's frame; the frame MUST remain the 1.5px dark line.
- **FR-008**: Letter size MUST be 55% of the cell size and value-numeral size 18% of the cell size, both derived from the field's measured size at every breakpoint, with no fixed fallback.
- **FR-009**: The value numeral MUST NOT render below 9px, and MUST be hidden entirely when a cell is narrower than 32px; the cell's accessible name MUST continue to state the value in that case.
- **FR-010**: Word-band chevrons MUST be drawn with a 1.5px on-screen stroke at every field size, at the reading start of the word.
- **FR-011**: The ledger's live row MUST state the real point value of a picked letter.
- **FR-012**: The frozen-letter notice MUST name the round in which that letter was frozen; when two scored words cover the letter, the earliest round MUST be named.
- **FR-013**: The player bars MUST have no horizontal inset, so the seat square and the total align with the field's frame.

**Room composition**

- **FR-014**: The field and the ledger MUST be separated by exactly the designed gutter at every window width — the wide value at 1100px and above, the narrow value between 900px and 1100px — and the pair MUST be centred in the window as one unit.
- **FR-015**: The ledger's live row MUST be a single element spanning the ledger's full width, tinted, with its rule at the left edge and the round label inside the tint and aligned with the rows above.
- **FR-016**: The queue state MUST present its progress and its countdown in a live row of the same form, above the hint line.
- **FR-017**: A request for a match that does not exist MUST land the player in the lobby room with a notice line stating that the match does not exist; no page outside the room's grammar may render.

**The phone**

- **FR-018**: At 900px wide and below, the ledger MUST render only the caption, the live row, the territory bar and its counts, and the live row MUST offer to open the history.
- **FR-019**: The remaining ledger MUST open in flow beneath the live row, scroll within its own bounds, and never rise above the bottom bar's lower edge or cover the field or either bar.
- **FR-020**: Escape or the close control MUST close the sheet and return focus to the live row.
- **FR-021**: At 390×844 the page MUST NOT scroll with the sheet closed or open, field cells MUST be at least 35px square, and every control in the sheet MUST meet the 44px touch-target minimum.
- **FR-022**: The field's available height on phones MUST account for the phone bar height, and the field's rendered width MUST be the value the cell-size derivation uses, so letters scale correctly on phones.
- **FR-023**: An automated accessibility audit MUST be clean with the sheet open.

**Interaction and motion**

- **FR-024**: Pressing on one letter and releasing over a different one MUST commit that swap once, and MUST NOT also register a tap; pressing and releasing on the same letter MUST remain a tap; releasing outside the field MUST cancel.
- **FR-025**: While a letter is picked, pressing outside the field MUST cancel the pick, except on the ledger's action and notice controls, which MUST act without cancelling.
- **FR-026**: `?` MUST open the rules and `M` MUST toggle sound, in every room state, ignored while a text field has focus and when a modifier key is held.
- **FR-027**: Two letters exchanging places, in a preview or a commit, MUST travel from each other's positions over 150ms.
- **FR-028**: A released pin MUST fade over 200ms, and a found opponent's name MUST fade in over 200ms.
- **FR-029**: The disconnected lane MUST be drawn with the designed 6px/4px dash pattern rather than a browser-chosen one, without gradients.
- **FR-030**: Every behaviour in FR-027 to FR-029 MUST complete instantly when the player prefers reduced motion.

**Colour, ranking and debt**

- **FR-031**: The palette MUST be exactly eight colour values — the seven plus a text-only coral for text below 17px — with the derived tints, and the token test MUST assert the exact set.
- **FR-032**: Coral used as text below 17px — ledger words, scored-letter numerals, the profile's `vs` rows — MUST use the text-only coral; letters on the field, lanes, totals and seat squares MUST keep the display coral; the seat-colour function MUST provide both.
- **FR-033**: No coral-text selector may be excluded from the automated contrast check. Exactly one exclusion remains: the future-round labels in the single permitted grey, which the design system names as its one exception and which are hidden from assistive technology — the ledger caption carries the round. The exclusion list MUST carry that justification inline and MUST contain nothing else.
- **FR-034**: Matches MUST carry a rated flag; matches created from a directory challenge MUST be unrated and MUST NOT change either player's rating; their captions MUST read `unranked` and the lobby MUST offer `challenge for an unranked match`. Queue matches MUST remain rated.
- **FR-035**: The retired look's colour and font aliases MUST be deleted from the stylesheets and the theme configuration, and the acceptance search that guards against them MUST be case-insensitive.
- **FR-036**: The retired look's remaining code MUST be deleted and its asset bundle moved to the archive, leaving a one-paragraph pointer at the old location.
- **FR-037**: The engine configuration MUST NOT carry a per-round time limit, which the rules do not define.
- **FR-038**: The profile's rating chart MUST render its axis labels undistorted at any container width.

**Documents**

- **FR-039**: The design bundle in the repository MUST be updated to state what the code does: the 5:00 clock and its accessible maximum, opt-in preview, one chevron per band, eight colour tokens with the text-only rule, the numeral floor and hiding threshold, the phone sheet's geometry, the 150ms exchange, and the challenge ranking as decided.
- **FR-040**: The documentation consistency check MUST cover the design bundle and MUST fail on the retired statements — a ten-minute clock, preview by default, two chevrons.
- **FR-041**: The repository's guidance documents MUST name the fixture route, the visual suite and the eight tokens.

**Being seen**

- **FR-042**: A written visual checklist MUST be completed by a person against each figure, at desktop and phone size, and recorded with this feature.
- **FR-043**: The reference images MUST be committed and the visual suite made blocking.
- **FR-044**: The full two-player suite MUST be run once against a real database with a clean accessibility audit on every state, and the result recorded with its date, replacing spec 044's "not run locally" notes.

### Key Entities

- **Room state fixture**: a fixed, typed description of one room state — board, players, clocks, rounds, territory, notices — using the existing state types only, with no new types introduced.
- **Rated flag**: a per-match fact stating whether the match moves ratings; true for queue matches, false for directory challenges; read by the rating step and by the ledger captions.
- **Seat colour set**: the existing seat-relative colour resolution, extended with a text colour that differs from the display colour for the opponent seat only.
- **Ledger live line**: the queue state's own progress text, carried on the ledger model so the queue can render it in the same live row the match uses.
- **Collapsed ledger state**: whether the ledger shows only its live band, and whether its sheet is open; local to the phone layout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with no database configured can see any of the nine room states at any of the three reference sizes within one minute of starting the application.
- **SC-002**: A rendered match at 1440×900 and at 390×844 is indistinguishable from the review's fixture B on every point it names: paper cells, one-pixel rules crossing the bands, the heavier frame, letters at 55% of the cell, numerals at the top right, and 1.5px chevrons at each word's reading start.
- **SC-003**: The distance between the field and the ledger measures the designed gutter within one pixel at 1440×900 and at 1000×800.
- **SC-004**: At 390×844 the page does not scroll with the ledger sheet closed or open, field cells are at least 35px square, and the sheet never overlaps the field or either bar.
- **SC-005**: A player can complete a swap by dragging as reliably as by tapping, and cancel a pick by tapping anywhere outside the field.
- **SC-006**: Every piece of text in the room and the profile meets the AA contrast minimum, with exactly one documented exclusion — the future-round labels, which are hidden from assistive technology and whose round is carried by the ledger caption.
- **SC-007**: A directory challenge leaves both players' ratings unchanged, and is labelled unranked wherever the queue match is labelled ranked.
- **SC-008**: The colour palette contains exactly eight values, and a search for the previous look's names across the stylesheets, theme, code and documents returns nothing.
- **SC-009**: The visual suite runs in continuous integration without a database and fails on any unintended change to the room.
- **SC-010**: A person has compared every room state with its figure against a written checklist, and the completed checklist is committed with this feature.
- **SC-011**: The full two-player suite and the accessibility audit have been run once against a real database and recorded with their date, and no task in this feature or spec 044 is left marked "not run locally".
- **SC-012**: Nothing listed in the review's section 3 as already matching the design has changed.

## Assumptions

- The review's file and line evidence is accurate as of the merge of spec 044; each finding is re-confirmed against the file before it is edited.
- The review's section 3 is the definition of what is already correct. `lib/room/fieldInteraction.ts`, the reveal plan, band geometry, clock lane states, seat-colour resolution, notices, verdict, lobby tables, queue placeholder landing, disconnect and claim, rematch, read-only replay, the profile layout and the copy module are **out of scope** and must not be restructured.
- The two view/controller splits for lobby and queue are extractions with no behaviour change, following the split that already exists for the match view; their controller tests pass unchanged.
- The fixture route is a development and test surface, not a player-facing feature, and carries no navigation into it.
- The rated flag defaults to true, so every existing match and every queue match keeps today's behaviour; only the invite path sets it false.
- The earliest covering round is the reading for a frozen letter belonging to two scored words, chosen because it is when the letter actually froze.
- The design bundle's figures remain the visual authority; where a figure and the five decisions of 14 September disagree, the decisions win and the bundle text is corrected, not the figure re-drawn.
- Reference images are captured on one browser engine in continuous integration; a small difference tolerance absorbs anti-aliasing.
- Spec 044's acceptance scenario 4 claims "every cell is a whole-cell hit target of at least 44px effective size" at 390×844. That was never achievable — 390 − 32px of room padding = 358, ÷ 10 = 35.8px — so FR-021 records the true floor and the constitution's touch-target rule was scoped to discrete controls (v1.5.0). Spec 044 is left as the historical record.
- No change to scoring, the round engine, the state machine, the word engine or any rule of play is in scope.

## Out of Scope

- Any restructuring of `components/room/`, `lib/room/` or the room states beyond the two view extractions.
- Any change to game rules, scoring, the round engine, matchmaking mechanics or the realtime transport, other than the rated flag and its effect on the rating step.
- The legacy `boards` table cleanup, board-generation improvements and production readiness items listed as next steps in the repository's guidance.
- Re-drawing the audit figures, or any new design work beyond correcting the bundle's text to the recorded decisions.
- Player-facing navigation to the fixture route.
