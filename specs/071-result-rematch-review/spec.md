# Feature Specification: The result, rematch and review

**Feature Branch**: `071-result-rematch-review`
**Created**: 2026-09-24
**Status**: Draft
**Input**: Stage 5 of the game flow redesign: the result, rematch and review. Source of truth: `docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md`: D1 (result), D2 (rematch negotiation), D3 (review), F4 (phone result), F7 (phone review), the §4 flow rows for the end of a match (T38–T47, T54, T65, T66 and the history policy), §7.8's rematch etiquette, §7.9 rows S8 and S9, and §8b's rows for the rules document (S13). Owner decisions in §10 are settled and are not re-asked: the rematch action is `annan leik? ▸` / `rematch ▸`; the review action is `yfirfara viðureignina ▸` / `review the match ▸`; a rematch request lasts 30s within a 2:00 window. Design canvas https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo, artboards Result, RematchIncoming, Review, PhoneResult and PhoneReview. Out of scope: best-here hints (S17, phase 2). Once S17 ships, review waits for the hints (D3); that state is not built now.

## Context

Stages 1–4 carry a player from the door to the last move. What happens after the last move is still spec 048's first draft.

- **The result does not say why the match ended.** The match-over slip carries a verdict and totals, but its detail line does not separate a match both players finished from one where a player ran out of time, resigned or was gone. Focus does not move to it, and its actions can be pressed the moment it appears.
- **Rematch has no limits.** A request can be sent at any time after the match, by a player who left long ago. Nothing stops a declined player from asking again. A request that arrives after the slip was lifted raises nothing, or raises the slip again over what the player was reading. The new match is not created through the one path every other match uses.
- **There is no review.** `review the match ▸` only lifts the slip and shows the final field. You cannot see how the board got there, what the opponent played at move 5, or where the lead changed. The lobby's `review ▸` links and the band map already point at `?review=last`, but nothing reads the parameter. `/summary` redirects to the live match URL.
- **The rules document** does not describe review.

This stage finishes the match. The result slip lands after the last reveal, focuses its headline and says once why the match ended. Rematch becomes one request per match, 30s long, offered only while both players are still on this match within 2:00 of its end, accepted through the single match-creation path, and closed for good by a decline or silence. Review becomes a state of the same page: `?review=n` shows the field as it stood after step n, steps through every move in the order the server received them, and is driven by a scrubber in the scoreboard's clock row, labelled controls and keys.

## Clarifications

### Session 2026-09-24

- Q: What does a declined or expired rematch count toward? → A: It starts the pair's 60s cooldown (shared with challenges), but does not count toward stage 4's three-declines rule.
- Q: Does a hidden tab on the result or review count as being on the match for the rematch offer? → A: Yes. Any fresh tab whose page is this match counts, visible or hidden.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The result says who won and why (Priority: P1)

A match ends: both players played ten, the clock ran out, someone resigned, or someone ended it early. The last reveal plays and holds. Then the result slip lands over the faded field. Its headline says who won, and focus moves to it so a screen reader reads it at once. One detail line says why the match ended. Below it are the viewer's best word, both rating lines and the actions.

**Why this priority**: Every match ends here. It is the moment a player learns the outcome, and today it does not say why.

**Independent Test**: Render the result fixture for each end reason in both languages. Finish a live match between two browsers and check the timing, focus and guard.

**Acceptance Scenarios**:

1. **Given** a match whose last move has just resolved, **When** the final reveal finishes its hold, **Then** the slip lands 600ms later over the field faded to 32%, focus is on its headline, and the headline is announced once, assertively.
2. **Given** the slip has just landed, **When** the player presses any action within 500ms, **Then** nothing happens. After 500ms the actions work.
3. **Given** a match both players finished, **When** the slip shows, **Then** the label reads `VIÐUREIGN LOKIÐ · 4:52` / `MATCH OVER · 4:52`, the headline `Birna vann` / `Birna wins` in the winner's seat colour (a draw is `Jafntefli` / `Draw` in ink), the score `134 – 88` in seat colours, and the detail line `MEÐ 46 STIGUM · 10 ORÐ GEGN 8 · SVÆÐI 27–21` / `BY 46 POINTS · 10 WORDS TO 8 · TERRITORY 27–21`.
4. **Given** each other end reason, **When** the slip shows, **Then** the detail line states it once: one player incomplete (`KÁRI PLAYED 8 OF 10 · BY 12 POINTS`), neither finished (`NEITHER FINISHED · BY 12 POINTS`), a resignation (`KÁRI RESIGNED · 3:12`), or an early end (`ENDED EARLY · KÁRI WAS GONE`). The same fact appears nowhere else on the slip.
5. **Given** the viewer scored at least one word, **When** the slip shows, **Then** it carries `BESTA ORÐIÐ ÞITT · BORÐA 29` / `YOUR BEST WORD · BORÐA 29`. With no scored word, that line is absent.
6. **Given** the slip, **When** it shows, **Then** it carries both rating lines (`■ Birna · you  1204 → 1212 · +8`, `■ Kári  1187 → 1179 · −8`, or `rating pending` until the change is written), then action row 1 `ANNAN LEIK? ▸` / `REMATCH ▸` (primary, not focused) and `nýr mótspilari ▸` / `new opponent ▸`, then action row 2 `yfirfara viðureignina ▸` / `review the match ▸` and `lobbí` / `lobby`.
7. **Given** the slip is up, **When** the player presses Esc or `review the match ▸`, **Then** the slip lifts. **When** they press `result ▸` in the foot, **Then** it returns. The game never raises it again by itself.
8. **Given** the match is over, **When** the player looks at the tab, **Then** the title reads `Birna vann · Orðusta` / `Birna wins · Wottle`. Behind the slip, the scoreboard holds the clock where it stopped, both totals and the rating lines, and the winner's row ends `· vann` / `· wins`. The ledger is in its final state; on a phone its sheet closes on a totals row.
9. **Given** the match is over, **When** the player presses Back, **Then** they reach the lobby in one press. The live match's Back guard never shows again, and closing the tab raises no warning.

---

### User Story 2 - Ask for a rematch, once (Priority: P1)

Both players are still on the result or the review. One presses `rematch ▸`. The request lasts 30s with a visible drain, and the sender can cancel it. The other player sees the request on the slip, or on the ledger's first line if they lifted the slip or are reviewing. If they accept, or both asked at once, a new match opens at the table. If they decline, or 30s pass, rematch is gone for both players for this match.

**Why this priority**: A rematch is the cheapest next match and the main way two players keep playing. Without limits it is also a nuisance channel.

**Independent Test**: Finish a match between two browsers. Send, cancel, send again (refused: one request per match), decline, let a request expire, accept, and cross two requests. Check each state on both sides.

**Acceptance Scenarios**:

1. **Given** both players are on this match's result or review within 2:00 of its end, **When** one presses `rematch ▸`, **Then** action row 1 becomes `rematch sent · 0:24` / `beiðni send · 0:24` with a 4px drain and a secondary `cancel ▸` / `hætta við ▸` at the row's right end. The other actions stay visible and working.
2. **Given** a request is sent, **When** the sender presses `cancel ▸`, `new opponent ▸` or `lobby`, **Then** the request is withdrawn and the other player's request line disappears.
3. **Given** a request arrives while the recipient's slip is up, **When** it arrives, **Then** action row 1 becomes `Kári asks for a rematch · 0:24` / `Kári vill aðra viðureign · 0:24` with a drain, a primary `ACCEPT ▸` / `SAMÞYKKJA ▸` (not focused, ignored for 500ms) and a secondary `decline` / `hafna`. The change is announced politely.
4. **Given** the recipient has lifted the slip or is in review, **When** a request arrives, **Then** the slip is not raised again. The request becomes the ledger's first line in call style (`Kári asks for a rematch · 0:24`, drain, `accept ▸` and `decline`), with the challenge cue, the tab title `(1) Kári asks for a rematch · Wottle`, the favicon letter in the opponent's colour and a polite announcement.
5. **Given** a request, **When** the recipient accepts, or both players have sent requests, **Then** both players go to the table of a new match in the same language. The accepter and any player whose request crossed are seated. The original requester is seated by the usual input rule. The old result is replaced in history, not stacked.
6. **Given** a request, **When** the recipient declines, **Then** both read `Kári declined` / `Kári hafnaði`, `rematch ▸` is gone for both players for this match, a 60s cooldown starts for the pair, and the primary becomes `new opponent ▸`.
7. **Given** a request, **When** 30s pass unanswered, **Then** both read `no answer` / `ekkert svar`, with the same consequences as a decline.
8. **Given** a request has already been sent for this match, **When** either player tries to send another, **Then** it is refused: one request per match.
9. **Given** the rematch is accepted, **When** the new match opens, **Then** the scoreboard carries the series on both player rows (`match 2 · Birna 1–0` / `viðureign 2 · Birna 1–0`).
10. **Given** a void or abandoned match, **When** a player asks for a rematch, **Then** it is refused.

---

### User Story 3 - Review the match step by step (Priority: P1)

After the match, a player presses `review the match ▸`, or opens a past match from the lobby. The same field shows the board as it stood after one step. A step is one move, in the order the server received it. The scoreboard's clock row becomes a scrubber: the step, the clock as it read when that move arrived, and a bar at that point. Both player rows show the score and moves at that step. The ledger's rows show which moves are reached, and a cursor line says what the step did. The player steps with labelled controls, the keys, or a ledger cell.

**Why this priority**: Review is how a player learns from a match: what the opponent played, when the lead changed, and where their own misses were. It is also where the lobby's `review ▸` links already lead.

**Independent Test**: Open `/match/:id?review=7` for a completed fixture match. Check the field, the scoreboard at step 7, the ledger, the cursor line and every control. Step with the keys and the controls, and check the URL and history.

**Acceptance Scenarios**:

1. **Given** a completed match, **When** the player opens `?review=7`, **Then** the field shows the board after step 7, with a band for every word scored up to step 7. Step 7's own words are at 30% and earlier words at 14%. Step 7's two swapped cells carry the last-moved tick.
2. **Given** review at step k, **When** the scoreboard shows, **Then** the clock row is the scrubber (`SKREF 7 AF 20` / `STEP 7 OF 20`, the clock as it read when the move was received, `3:31`, and a bar at that fraction). The player rows show each total at step k and the moves played by step k (`1204 · 3 of 10 at step 7`).
3. **Given** the scrubber has focus, **When** the player presses → or ←, Home or End, or Space, **Then** it steps forward or back, jumps to the first or last step, or starts and stops autoplay. Its value is read as `step 7 of 20, Birna, LEK ÆSKU plus 33`. These keys act only while the scrubber has focus. The field's arrow keys and the buttons' Space are untouched.
4. **Given** review on desktop, **When** the player looks at the controls, **Then** there are five labelled controls: `first · back · play ▸ · next · last` / `fyrst · aftur · spila ▸ · næst · síðast`. `play ▸` becomes `pause` / `hlé` while autoplay runs, one step per second, and stops when pressed or at the last step.
5. **Given** review at step k, **When** the ledger shows, **Then** its caption reads `yfirferð · 4:52` / `review · 4:52`. Cells up to step k are ink, step k's cell takes the live-row style on the mover's side, and cells after step k are muted and named, e.g. `move 8, Kári, not yet reached`. Activating any cell jumps to its step. The rows are one widget with a roving tabindex.
6. **Given** review at step k, **When** the cursor line shows, **Then** line 1 reads `move 3 · Birna · LEK · ÆSKU +33` / `leikur 3 · Birna · LEK · ÆSKU +33` and line 2 `froze 6 · Birna leads 51–18` / `6 frosnir · Birna leiðir 51–18`. A miss reads `move 4 · Kári · no word −5`, with the number crimson and its label muted.
7. **Given** a step that the server refused, **When** it is shown, **Then** the letters stay where they were and line 2 reads `refused · frozen` / `hafnað · frosinn`. The step is counted but changes no score.
8. **Given** the clock ended the match with unplayed moves, **When** the player steps past the last move, **Then** a final step `time · −N not played` / `tími · −N óleikið` applies the unplayed-move penalties, so the last step's totals equal the result.
9. **Given** review, **When** the player steps forward, **Then** the letters exchange (150ms) and the step's bands draw (400ms). **When** they step back, **Then** the change is instant. Under reduced motion, every step is instant.
10. **Given** review, **When** the foot shows, **Then** it carries `◂ úrslit` / `◂ result` on the left. On the right is the one primary: `REMATCH ▸` while the rematch is offered, else `CHALLENGE AGAIN ▸` if the opponent is here, else `NEW OPPONENT ▸`. Then `⋯` holds `lobby`.

---

### User Story 4 - Review lives at a URL on the same page (Priority: P1)

Review is `?review=n` on the match page. Nothing remounts when you enter or leave it. Entering review adds one history entry, and each step replaces it, so Back from review returns to the result and Back from the result returns to the lobby. Old links (`/summary`, the lobby's `review ▸`, the band map) land on review.

**Why this priority**: Review has to be shareable and bookmarkable, and must not fill history with twenty entries.

**Independent Test**: Enter review from the result, step five times, and press Back once (result) and again (lobby). Open `/match/:id/summary` and `?review=last` directly. Open `?review=99` and `?review=abc`.

**Acceptance Scenarios**:

1. **Given** the result, **When** the player presses `review the match ▸`, **Then** the URL becomes `?review=<last step>` in one new history entry and the slip lifts.
2. **Given** review, **When** the step changes, **Then** the URL's `review` value changes in place with no new history entry.
3. **Given** review, **When** the player presses Back or `◂ result`, **Then** they are on the result with the slip up. **When** they press Back again, **Then** they are in the lobby.
4. **Given** any completed match, **When** someone opens `/match/:id/summary`, **Then** they are redirected to `/match/:id?review=last`.
5. **Given** `?review=last`, an out-of-range number or a value that is not a number, **When** the page opens, **Then** it shows the last step (numbers are clamped to the first and last step) and the URL is corrected in place.
6. **Given** a live or pending match, **When** a participant opens `?review=n`, **Then** the parameter is ignored and removed, and the live match shows.

---

### User Story 5 - Review for anyone who has the link (Priority: P2)

A completed match's review can be opened by anyone: a non-participant or a signed-out visitor. They see the same review, read-only, with no rematch or challenge.

**Why this priority**: The result of a finished match is not private, and a shared review link should work. It is less central than the participants' own review.

**Independent Test**: Open a completed match's review signed out and as a third player.

**Acceptance Scenarios**:

1. **Given** a completed match and a viewer who did not play in it, **When** they open `/match/:id` or `?review=n`, **Then** they see the review read-only, with the line `this match is over · Birna – Kári` / `viðureigninni er lokið · Birna – Kári`, and no rematch, challenge or result slip.
2. **Given** a signed-out visitor, **When** they open the review, **Then** it renders without a session, and the foot's primary is `enter the lobby ▸` / `inn í lobbíið ▸`.
3. **Given** a void match, **When** anyone opens its review, **Then** they are sent to the lobby (the door when signed out): a void is not a match and has nothing to review.
4. **Given** a non-participant review, **When** it shows, **Then** the match's first player takes the near seat, and the names on each row, not colour alone, say who is who.

---

### User Story 6 - When rematch is not offered (Priority: P2)

A rematch is offered only while both players are on this match within 2:00 of its end, and only once. When it is not offered, the result offers the next best thing: a new opponent, or a challenge to the same player once their cooldown ends.

**Why this priority**: It covers every result opened late, after a decline, or after the opponent has gone.

**Independent Test**: Render the result with the opponent gone, past 2:00, after a decline and during a cooldown, and open an old match's result from history.

**Acceptance Scenarios**:

1. **Given** the opponent has left this match's result and review, **When** the viewer looks at the slip, **Then** `rematch ▸` is gone, the opponent's scoreboard sub-line reads `has left` / `hætti`, and the primary is `new opponent ▸`.
2. **Given** more than 2:00 since the match ended, or a result opened later from history, **When** the slip shows, **Then** there is no `rematch ▸`. The primary is `new opponent ▸`, with a secondary `challenge again ▸` / `skora aftur á ▸` if the opponent is here.
3. **Given** the pair's 60s cooldown is running, **When** the slip shows, **Then** `challenge again ▸` reads `again in 0:52` / `aftur eftir 0:52` and cannot be pressed until the cooldown ends.
4. **Given** `challenge again ▸`, **When** it is pressed, **Then** it sends an ordinary challenge through the lobby's challenge rules (60s, same language), and its state shows in the line slot.

---

### User Story 7 - Other calls while on the result (Priority: P3)

While the player is on the result or review, a third player challenges them. The call appears on the ledger's first line, below an incoming rematch if both exist.

**Why this priority**: It is rare, and the stage-4 line already exists; this story fixes its order and wording.

**Independent Test**: With a rematch request and a third-party challenge both pending on the result, check both ledger lines and their order.

**Acceptance Scenarios**:

1. **Given** the result lifted or review, **When** a third player's challenge arrives, **Then** it is a ledger line with a secondary `accept ▸`, placed below any incoming rematch.
2. **Given** both a rematch request and a third-party challenge, **When** either is accepted, **Then** the other is answered as `started another match`.

---

### User Story 8 - The phone result and review (Priority: P2)

On a phone the result slip fills exactly the field's square and never covers the scoreboard, so both totals stay visible. Review keeps the field and scoreboard, puts the scrubber in the clock row, and pins five step controls to the foot.

**Why this priority**: Phones are a large share of play, and the desktop layout does not fit them.

**Independent Test**: Render the phone result and phone review fixtures at 390×844, 390×664 and 360 wide.

**Acceptance Scenarios**:

1. **Given** a phone, **When** the result slip shows, **Then** it fills the field's square, with the label, the 28px headline, the score, a detail line of the first two clauses only (`MEÐ 46 STIGUM · 10 ORÐ GEGN 8`), the rating lines and both action rows. A rematch negotiation replaces action row 2 with its line and drain.
2. **Given** a phone below the slip, **When** the ledger shows, **Then** it reads `lok · 4:52` over `Birna vann 134–88`, a live row only while a call or rematch request is pending, and a foot with `⋯` and `úrslit ▸` when the slip is lifted.
3. **Given** phone review, **When** it shows, **Then** the scoreboard's clock row is the scrubber (`skref 7 · klukkan þá · 3:31`, a slider at least 32px tall). The cursor line replaces the live row on two lines. The rows are in the sheet (`saga ▸` / `history ▸`). The pinned foot holds `◂ úrslit` and five 44×44 controls drawn as glyphs `|◂ ◂ ▸ ▸ ▸|`, each with a spoken label (`fyrst`, `aftur`, `spila`, `næst`, `síðast`).

---

### User Story 9 - The rules document describes review (Priority: P3)

The rules document's "what the player sees" table gains a *Review* row and an amended *Match over* row, in the same change as the code.

**Why this priority**: The rules document is the contract between the rules and the rendering; review is new rendering.

**Independent Test**: Read `wottle_game_rules.md` §12.

**Acceptance Scenarios**:

1. **Given** §12, **When** it is read, **Then** *Match over* describes two action rows, headline focus and the detail by reason. A *Review* row describes steps in receipt order, refused steps and the time step, and notes that best-here hints are phase 2.

---

### Edge Cases

- **The match ends while the player is away** (on a page or another tab). The result is kept for them (stage 4's `your match is over · result ▸`). Opening it shows the slip without the 600ms wait, since the reveal already happened. The rematch is offered only if both are back on the match within the 2:00 window.
- **The opponent reloads the result.** Their presence on the match continues after the reload, and the rematch stays offered.
- **A request is sent in the last seconds of the 2:00 window.** It still lasts its full 30s. The window governs sending, not answering.
- **Both players press `rematch ▸` within the same second.** One match is created, and both land at its table. Neither sees an error.
- **The requester presses `new opponent ▸` while their own request is pending.** The request is withdrawn and the search starts.
- **Accepting a rematch while the accepter has a search or an outgoing challenge out.** The search is cancelled and the challenge withdrawn by the single match-creation path, as with any accept.
- **Either player is already in another pending or live match.** The accept is refused as busy. The request closes for both with `Kári started another match` / `Kári hóf aðra viðureign`, with the same consequences as a decline.
- **A match with no moves at all** (both players incomplete at 0:00 with nothing played). Review has one step: the time step.
- **A match ended by resignation.** The steps stop at the last received move. There is no time step, and the result's detail line carries the reason.
- **A match ended early.** The absent player's unplayed moves are penalised as at 0:00, so review closes with the step `ended early · −N not played` / `lokið snemma · −N óleikið`.
- **Autoplay while the player presses a control.** Any control, key or cell stops autoplay first.
- **The tab is hidden during autoplay.** Autoplay pauses.
- **Review of a match in the other locale.** It redirects to its own locale, keeping `?review=n`.
- **Rematch while the viewer's previous match is still settling ratings.** The rating lines read `rating pending`, and the rematch works regardless.
- **The recipient leaves while a request is pending** (closes the tab or navigates away). The request ends as `Kári has left`, with no cooldown, and `rematch ▸` is gone because the opponent has left.
- **The 2:00 window ends while the slip is up and no request is out.** `rematch ▸` is replaced by `new opponent ▸` as the primary, with the 500ms guard on the control whose meaning changed.

## Requirements *(mandatory)*

### Functional Requirements

**The result (D1, F4)**

- **FR-001**: The result slip MUST land 600ms after the final reveal's hold ends, fade the field to 32%, move focus to its headline, and announce the headline once, assertively. When the result is opened without a reveal (a reload, from history, or after being away), it MUST show without the wait.
- **FR-002**: Every action on the result slip MUST ignore activation for 500ms after it appears or changes meaning.
- **FR-003**: The slip MUST carry, in order: the label with the match length, the headline (winner's name + `wins`, or `Draw`), the score in seat colours, one detail line, the viewer's best word if they scored one, both rating lines, and two action rows.
- **FR-004**: The detail line MUST state why the match ended exactly once, by reason: both finished (margin · words · territory), one incomplete (who played how many · margin), neither finished (margin), resigned (who · when), ended early (who was gone). On a phone it MUST show only its first two clauses.
- **FR-005**: The Icelandic detail for an early end MUST follow the name-safe rule (no gendered participle such as `farinn`). Its wording is marked for native reading.
- **FR-006**: Esc and `review the match ▸` MUST lift the slip, and `result ▸` in the foot MUST restore it. The game MUST never raise a lifted result slip again.
- **FR-007**: Once the match is complete, the live match's Back guard and the close-tab warning MUST be disarmed. One Back from the result MUST reach the lobby.
- **FR-008**: The tab title on the result MUST read `<winner> wins · <wordmark>` (or `Draw · <wordmark>`).

**Rematch (D2, S8)**

- **FR-010**: A rematch MUST be offered only while both players are present on this match's result or review (a fresh tab on this match, visible or hidden), within 2:00 of the match's end, and only for a match that started (never void or abandoned).
- **FR-011**: Each match MUST allow at most one rematch request. Crossed requests count as one, and start the match.
- **FR-012**: A request MUST last 30s, shown to both players as a countdown and a draining bar. Its sender MUST be able to cancel it, and `new opponent ▸` or `lobby` MUST withdraw it.
- **FR-013**: The recipient MUST see an incoming request on the slip's action row 1 while the slip is up, with `accept ▸` as primary (not focused, 500ms guard) and `decline`. While the slip is lifted or in review, the request MUST be the ledger's first line instead, and the slip MUST NOT be raised.
- **FR-014**: An incoming request MUST play the challenge cue, set the tab title to `(1) <name> asks for a rematch · <wordmark>`, set the favicon letter in the opponent's colour, and be announced politely.
- **FR-015**: Accepting, or crossed requests, MUST create the new match through the one match-creation path used by every other match. It MUST be in the same language, open at the table, and seat the accepter and crossing requesters at once and the original requester by the input rule. Both players MUST be taken to the new match's table, replacing the old match's history entry.
- **FR-016**: A decline or an expiry MUST remove `rematch ▸` for both players for this match, show `<name> declined` or `no answer`, and start the pair's 60s challenge cooldown. As with a declined challenge, the cooldown holds the requester's challenges to that opponent. A rematch decline or expiry MUST NOT count toward the three-declines rule.
- **FR-017**: The new match's identity MUST reach the players by reading the old match's state after a poke, never in a broadcast payload.
- **FR-018**: After an accepted rematch, both player rows of the new match's scoreboard MUST carry the series (`match 2 · Birna 1–0`).
- **FR-019**: When a rematch is not offered, the primary MUST be `new opponent ▸`. A secondary `challenge again ▸` MUST appear when the opponent is here, and read `again in m:ss` while the pair's cooldown runs.
- **FR-020**: An opponent who has left this match's result and review MUST read `has left` on their scoreboard sub-line, and `rematch ▸` MUST be withdrawn with that reason. A pending request addressed to them MUST end without a cooldown.
- **FR-021**: A third-party challenge that arrives on the result or in review MUST be a ledger line below any incoming rematch. Accepting either MUST answer the other as `started another match`.

**Review (D3, F7, S9)**

- **FR-030**: Review MUST be a state of the match page at `?review=n`. Entering it MUST NOT remount the field. Entering review MUST add one history entry, each step MUST replace it, and Back from review MUST return to the result.
- **FR-031**: A completed match's steps MUST be every move in the order the server received it, refused moves included. When the match settled with unplayed moves (at 0:00, or ended early), a final closing step MUST apply their penalties. The totals after the last step MUST equal the match's result.
- **FR-032**: At step k the field MUST show the board after step k, with bands for every word scored up to k: step k's words at 30%, earlier words at 14%, and the last-moved tick on step k's swap. A refused step MUST leave the letters in place and read `refused · frozen`.
- **FR-033**: At step k the scoreboard's clock row MUST be the scrubber. It MUST show the step (`STEP 7 OF 20`), the clock as it read when that move was received, and a bar at that fraction, and it MUST be a slider with the value text `step 7 of 20, <mover>, <words> plus <points>`. The player rows MUST show each total and moves played at step k.
- **FR-034**: While the scrubber has focus, ←/→ MUST step, Home/End MUST jump to the ends, and Space MUST toggle autoplay. No other key binding in the room MAY change.
- **FR-035**: Desktop review MUST offer five controls with words: `first · back · play ▸ · next · last`. The phone MUST offer the same five as 44×44 glyphs with spoken labels, pinned in the foot. Autoplay MUST advance one step per second, stop at the last step, and stop on any other input or when the tab is hidden.
- **FR-036**: The ledger in review MUST mark cells up to step k as reached, step k as current (live-row style, the mover's side) and later cells as not yet reached (muted, and named so). Each cell MUST jump to its step, and the rows MUST form one composite widget with a roving tabindex. On a phone, the rows MUST live in the sheet.
- **FR-037**: The cursor line MUST describe step k on two lines: the move, the mover and the words with points (or `no word −5`, or `refused · frozen`, or `time · −N not played`), then the letters frozen and who leads by how much.
- **FR-038**: Stepping forward MUST use the letter exchange (150ms) and the band draw (400ms). Stepping back MUST be instant. Everything MUST be instant under reduced motion.
- **FR-039**: The review foot MUST carry `◂ result` and one primary, by availability: rematch, else challenge again, else new opponent. For a signed-out viewer the primary MUST be `enter the lobby ▸`.
- **FR-040**: `?review=last`, out-of-range numbers and values that are not numbers MUST resolve to the last step (numbers clamped to the range), with the URL corrected in place. On a match that is not complete, the parameter MUST be ignored and removed.
- **FR-041**: `/match/:id/summary` MUST redirect to `/match/:id?review=last` in the match's locale.
- **FR-042**: A completed match's review MUST be readable by anyone, without a session, read-only: no rematch, challenge or result slip, and a line naming the match (`this match is over · Birna – Kári`). A void match's review MUST redirect to the lobby, or to the door when signed out.
- **FR-043**: The moves of a completed match MUST be served in one read, in receipt order with their scored words. The read MUST be open to anyone for completed matches only.

**Rules document (S13, §8b)**

- **FR-050**: `wottle_game_rules.md` §12 MUST amend *Match over* (headline focus, two action rows, the detail by reason; reactions noted as phase 2) and add *Review* (steps in receipt order, refused steps, the time step; best-here noted as phase 2), in the same change as the code.

**Fixtures, copy and tests**

- **FR-060**: The room fixtures MUST add phases for the result by each end reason, rematch sent, rematch incoming on the slip, rematch incoming in review (the RematchIncoming artboard), rematch declined or expired, rematch not offered with a cooldown, review at a step, review at a refused step, review at the time step, and non-participant review, each with phone views. Each MUST have visual baselines.
- **FR-061**: Every new string MUST exist in both languages, pass the copy parity test and the name-safe grep, fit its slot without wrapping at 1440 and 390, and be marked for native reading where it is new Icelandic.

### Key Entities

- **Rematch request**: one per completed match. It records the requester, when it was sent, its status (pending, accepted, declined, expired, withdrawn, superseded) and, once accepted, the new match. It is readable from the old match's state by both players.
- **Rematch offer**: derived, not stored. It says whether `rematch ▸` is offered to a viewer now, from the match's end time, both players' presence on this match and the request's status.
- **Review step**: derived from a completed match's moves. For each step it holds the mover, the move number, the receipt clock, the swap, the words and points or the refusal, the board after it, the letters frozen by it and both totals after it. The final time step, when there is one, holds the penalties.
- **Series**: derived from the chain of rematches. It holds the match number in the series and the running score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every result fixture, both languages and every end reason, the detail line states the reason once, and no other line on the slip repeats it.
- **SC-002**: At the end of a live match, the slip appears 600ms (±100ms) after the final hold, and focus is on its headline in 100% of runs.
- **SC-003**: Across 100 rounds of two players pressing `rematch ▸` at the same moment, exactly one new match is created each time, and both players land at its table.
- **SC-004**: A rematch request that arrives while the recipient's slip is lifted or in review raises the slip 0 times, and it reaches the ledger's first line within 2 seconds.
- **SC-005**: After a decline or expiry, no further rematch request for that match succeeds, and `challenge again ▸` cannot be pressed until the 60s cooldown has run.
- **SC-006**: For every completed fixture match, the totals after review's last step equal the match's recorded totals, and the board after the last step equals the recorded final board.
- **SC-007**: A reviewer can reach any step of a 20-step match in at most 3 inputs (Home or End, then arrows, or one ledger cell), and entering review then stepping 20 times adds exactly one history entry.
- **SC-008**: Each review step renders within 100ms of the input on a mid-range phone, once the match's moves have loaded.
- **SC-009**: The review page passes automated accessibility checks with no violations, at 1440×900 and 390×844, in both languages.
- **SC-010**: A signed-out visitor opening a completed match's review link sees it on the first try, with no redirect to the door.

## Assumptions

- The scoreboard (spec 068) replaces the player bars that D1, D3 and F7 describe. "Bars" in the source read as the scoreboard's player rows, and the scrubber takes the scoreboard's clock row, as the canvas draws it. The lead chart is dropped, per the 22–23 September amendment ("review drops the lead chart"); the cursor line and the scoreboard's totals at step k carry the lead.
- D3's `jump to misses ▸` filter is not built in this stage: the canvas, drawn after the amendments, omits it. The ledger already marks every miss in crimson, and a cell jumps to its step.
- The review foot's `⋯` holds `lobby` only. `copy link ▸` belongs with invite links (stage 6), and `report name` is phase 2 (S15).
- Reactions (S16) and best-here hints (S17) are phase 2 and not built. Their slots on the slip and in the cursor line are simply absent.
- "Present on this match" means a fresh tab whose page is this match (result or review), visible or hidden, as reported by stage 4's per-tab presence. A player who navigates away or closes the tab has left after the usual freshness window.
- The rematch cooldown after a decline or expiry reuses stage 4's per-pair challenge cooldown (60s), so `challenge again ▸` and the lobby agree.
- The 2:00 window starts at the match's completion time, as recorded by the server.
- Non-participant review draws player A's seat on the "you" side. Seats are told apart by the names on each scoreboard row and the ledger's columns, never by colour alone.
- The existing rematch requests store (spec 016) is kept and extended, not replaced. The series context already derived from the rematch chain is reused.
- The rules document's §2a void wording (the first §8b row) already shipped with spec 069, so only the §12 rows remain.

## Dependencies

- Spec 067 (stage 1): the one match-creation path (`create_match_between`) and the busy refusal.
- Spec 069 (stage 3): the table, seating by input and the void.
- Spec 068: the scoreboard, the ledger's head rows and the last-moved tick.
- Spec 070 (stage 4): per-tab presence, payload-free pokes, the per-pair cooldown, the ledger call line, and the `your match is over · result ▸` line slot state.
- Spec 050: receipt-ordered moves with their board snapshots, refusals and the unplayed-move penalty.
