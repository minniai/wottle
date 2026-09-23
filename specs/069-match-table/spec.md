# Feature Specification: The table

**Feature Branch**: `069-match-table`
**Created**: 2026-09-23
**Status**: Draft
**Input**: Stage 3 of the game flow redesign: the table. Nobody is rated for a match they did not sit down at. Source of truth: `docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md`: §1 verdict problems 1 and 5, C1 (table), C2 (starting), C3 (void), F5 (phone table), the §4 flow rows for the table (T9, T25–T30, T59–T61), §7.3 seating and the table, §7.5 invariants 8 and 9, §7.9 rows S3, S7 and S12, §8 item 2 (the ready and void slips) and §8b's rows for the rules document (S13). Owner decisions in §10 are settled and are not re-asked; the timings are confirmed (20s to sit down; a 5-minute cooldown after two table leaves in 10 minutes). Design canvas https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo, artboards Table, Starting, Void and PhoneTable.

## Context

Today a player who has left can be put into a rated match and lose it (verdict problem 1):
- only `cancel ▸` takes a player out of the queue; Back, closing the tab, the rules link and the language link leave them queued;
- the queue pairs the player who has waited longest by last-seen time, with no freshness check, so it prefers the most likely ghost;
- the clock starts after a 10s grace whether or not both players have loaded.

And nobody says "I'm ready" (verdict problem 5): a challenge or rematch drops a player onto a bare board, the queue's "found" moment still reads `searching` under `starts in 3`, and the board is served while the match is still pending.

This stage puts a **table** between being paired and playing. Every match begins there. The field is an empty ruled frame; the server holds the letters until both players have sat down. A player who pressed the button that made the match, or whose tab is visible and in use, sits down at once; anyone else has 20s and a `ready ▸`. When both are seated the server sets the start 4.5s ahead, the 3·2·1 plays in the scoreboard's clock row and the letters land. If the table does not fill in time, or someone leaves it, the match is **void**: nothing is rated or recorded, the seated queue player goes back to the front of the queue, and the absent player's search stops.

The queue is made fair at the same time: oldest first by the time a player joined it, only players seen in the last 10s, a hidden tab pauses its search, a 3:00 "still searching?" check, and requeue at the front after a void. A player who leaves two tables in 10 minutes waits 5 minutes before searching again.

## Clarifications

### Session 2026-09-23

- Q: Does the table-leave cooldown also block accepting an incoming challenge or rematch? → A: No. It blocks searching and sending challenges only; accepting stays open, since an accept is the player's own press and seats them at once.
- Q: What does the void slip offer after a challenge table? → A: `challenge again ▸` (a new challenge to the same player through the existing send action, refused during the cooldown and by the existing busy and gone checks) and `lobby`.
- Q: How does a player learn of a table when they are not on the lobby page? → A: Every room page (lobby, queue, profile) checks every 3s for a table waiting for the player and takes them to it; the rules page does not. Stage 4's push (S6) replaces the check.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sit down at the table (Priority: P1)

Birna is paired with Kári. She lands on the table: the scoreboard names both players, the field is an empty ruled frame at 32% under a slip, and the slip says who she is playing, what is at stake and whether each of them is seated. If she found the match by her own press, or her tab was visible and she had used it in the last 30s, she is already seated; otherwise she presses `ready ▸` within 20s.

**Why this priority**: This is the whole promise of the stage. Without it a player can still be rated for a match they never saw.

**Independent Test**: Pair two players where one tab is hidden. The visible player is seated at once; the hidden one sees `ready ▸` and a 20s drain on return. No letters are sent to either client until both are seated.

**Acceptance Scenarios**:

1. **Given** a match has just been created, **When** either player opens it, **Then** the room is at the table:
   - the scoreboard's clock row reads `match clock` over `starts when both sit` / `leikklukka` over `fer af stað þegar báðir sitja`, with a full track that does not run and `5:00`;
   - the opponent's row reads `<rating> · opponent · on the way` / `· mótspilari · á leiðinni`, becoming `· ready` / `· við borðið` when they sit; the viewer's row reads `<rating> · you · ready` or `· you · not ready` / `· þú · við borðið` or `· þú · á leiðinni`; neither row shows a total;
   - the field is the empty ruled frame, with no letters, at 32% under the ready slip;
   - the ledger caption's context reads `opponent found` / `mótspilari fundinn`, the territory line reads `0 · 100 free · 0`, and the ten move rows are empty with no live row.
2. **Given** the table, **When** the ready slip renders, **Then** it reads, in order:
   - the label `opponent found · 0:14` / `mótspilari fundinn · 0:14`, counting down the time left to sit down;
   - the headline, the opponent's name in the board face in `--opp` and their rating, focused on arrival and announced once;
   - the facts `english words · 10 moves each · one 5:00 clock` / `íslensk orð · 10 leikir hvor · ein 5:00 klukka`, built from the match's language and the game config;
   - the stakes `win +8 · draw 0 · loss −8` / `sigur +8 · jafntefli 0 · tap −8`, the viewer's rating change for each outcome (a rating loss is ink, never `--err`);
   - two seat lines, each with its square: `■ Kári  on the way` and `■ Birna · you  ready`;
   - the actions for the viewer's state;
   - a 4px drain bar on the slip's inner bottom edge that empties over the 20s.
3. **Given** the viewer is not seated, **When** the slip renders, **Then** row 1 holds the primary `ready ▸` / `ég er til ▸`, which is not focused and ignores activation for its first 500ms, and row 2 holds the secondary `leave` / `fara`.
4. **Given** the viewer is seated and waiting, **When** the slip renders, **Then** row 1 reads `you are seated` / `þú ert við borðið` with no primary (a wait has no primary), and row 2 keeps `leave`. The exit is never where `ready ▸` was.
5. **Given** a match is created by the viewer's own press (accepting a challenge or rematch, or a send or rematch press that crossed the other player's), **When** the table opens, **Then** the viewer is already seated.
6. **Given** a match is created for a player whose tab is visible and who used it in the last 30s, **When** the table opens, **Then** that player is already seated.
7. **Given** anyone else, **When** the table opens, **Then** they have 20s from the match's creation to press `ready ▸`.
8. **Given** a seat changes, **When** the other player's room learns of it, **Then** their seat line and scoreboard sub-line change to `ready` and the change is announced politely.
9. **Given** the table, **When** the tab title is read, **Then** it is `Kári · opponent found · Wottle` / `Kári · mótspilari fundinn · Orðusta`; if the tab is hidden when the table opens, the `challenge` cue sounds (respecting the sound toggle).
10. **Given** any client asks the server for a match that is not yet started, **When** the server answers, **Then** it returns no board.
11. **Given** a table is created for a player who is on the lobby, the queue or a profile page, **When** that page next checks (at most 3s later), **Then** it takes the player to the table as a new history entry.

---

### User Story 2 - The start (Priority: P1)

The moment the second player sits down, the server sets the start 4.5s ahead. Both rooms show `ready` on both seat lines and `starts in 3`; the slip lifts, the 3·2·1 plays in the scoreboard's clock row while the letters land row by row, and at go the clock runs, focus moves to the field and the match-start sound plays.

**Why this priority**: The start is the only moment both players must share. It has to come from the server's clock, not from each client's guess.

**Independent Test**: Seat both players in two browsers. Both rooms count 3·2·1 from the same server time, the letters land during `3`, and at go `move 1 · your move` appears on both with the clock at `5:00` draining.

**Acceptance Scenarios**:

1. **Given** the second player sits down, **When** the server records the seat, **Then** in one step it writes the board, sets the start to that moment + 4.5s and the deadline to the start + 5:00, and tells both players.
2. **Given** the start is set, **When** a room learns of it, **Then** both seat lines read `ready`, the slip's label reads `starts in 3` / `hefst eftir 3`, and the slip lifts (150ms fade) at the start − 3.3s.
3. **Given** the slip has lifted, **When** the count runs, **Then** the scoreboard is in its `starting` state (spec 068): the clock row counts `starts in 3 · 2 · 1` from the server's start time, both rows read `ready`, the letters land row by row during `3` (M4, about 720ms), and the live row reads `move 1` over `pick when the clock starts` / `leikur 1` over `veldu þegar klukkan fer af stað`.
4. **Given** the count reaches go, **When** the match opens, **Then** the clock shows `5:00` and starts to drain, the 3px turn frame draws, the `match-start` sound plays (respecting the toggle), focus moves to the field, line 1 reads `move 1 · your move` and is announced, and line 2 reads `pick a letter`.
5. **Given** the start is set, **When** the tab title is read during the count, **Then** it is `3 · Kári · Wottle`, then `2 · …`, `1 · …`.
6. **Given** a client that learns of the start late (the polling fallback), **When** it renders, **Then** it joins the count where it is; past go it opens the live match directly.
7. **Given** reduced motion, **When** the count runs, **Then** the letters appear at once and the fades are 0ms, but the count still steps once a second (time is not motion).

---

### User Story 3 - A table that does not fill is void (Priority: P1)

Kári's tab was hidden and he never pressed `ready ▸`. At 0:00 the slip rewrites: `Kári did not sit down · nothing was rated`. Birna, who was searching, is back in the queue at the front and can cancel. Nothing appears in anyone's history. When Kári comes back, the lobby tells him `you did not sit down · your search stopped`.

**Why this priority**: The void is what makes the table safe. Without it the table would only delay the ghost's loss.

**Independent Test**: Let a table's 20s run out with one player unseated. Neither player's rating, record or recent matches change, the seated queue player is searching again at the head of the queue, and the unseated player is not searching.

**Acceptance Scenarios**:

1. **Given** the time to sit down runs out without both seated, **When** the server or either client checks the table, **Then** the match becomes void with the reason `not seated` and the unseated player recorded as the one who voided it.
2. **Given** a player presses `leave` at the table, or Back from the table or during the count, **When** the server records it, **Then** the match becomes void with the reason `left`, recorded against that player, and the player returns to the lobby.
3. **Given** a void, **When** the slip rewrites (no motion), **Then** it reads the label `no match` / `engin viðureign`, the headline by reason:
   - `Kári did not sit down` / `Kári settist ekki`;
   - `Kári left the table` / `Kári fór frá borðinu`;
   - `You did not sit down in time` / `Þú settist ekki í tæka tíð`;

   and the body `nothing was rated` / `hefur ekki áhrif á Elo stig`. The headline is focused.
4. **Given** a void of a queue table, **When** the viewer was seated, **Then** they are back in the queue automatically, at the front (their original join time kept); the body adds `you are back in the queue` / `þú ert aftur í leitinni`, the viewer's row reads `you · searching`, and the only action is the secondary `cancel ▸` / `hætta við ▸` (a wait). When the search pairs them again they go to the new table.
5. **Given** a void of a challenge table, **When** the slip rewrites, **Then** its actions are `challenge again ▸` / `skora aftur á ▸`, which sends a new challenge to the same player and returns the viewer to the lobby with it sent (refused with the remaining time during the cooldown, or with the existing reason when the player is busy or gone), and `lobby` / `lobbí`.
6. **Given** a void of a rematch table, **When** the slip rewrites, **Then** its actions are `result ▸` / `úrslit ▸` (the previous match's result) and `lobby`.
7. **Given** a player who did not sit down, **When** the table voids, **Then** their search stops, and when they next open the lobby its notice reads `you did not sit down · your search stopped` / `þú settist ekki · leitin stöðvaðist`.
8. **Given** a void match, **When** ratings, profiles, recent matches, the lobby's statistics or a rematch offer are read, **Then** it appears in none of them, and no rating row is written for it.
9. **Given** a match that has not started, **When** a player tries to resign it, **Then** the server refuses; leaving the table is the only way out.
10. **Given** a void match's address, **When** it is opened later, **Then** it shows the void slip over the empty frame, never a board.

---

### User Story 4 - A queue that never pairs a ghost (Priority: P1)

Birna presses `find an opponent ▸`. The queue pairs her with the player who joined earliest among those seen in the last 10s. If she switches to another tab, her search pauses on every device and she is skipped; on return it reads `search paused · resume ▸`. After 3:00 it asks `still searching?`. After a void she is back at the front.

**Why this priority**: The table stops a ghost from being rated; the fair queue stops a ghost from being paired in the first place.

**Independent Test**: Put three players in the queue: one whose last heartbeat is 12s old, one who joined first, one who joined second. A new searcher is paired with the one who joined first; the stale one is never picked.

**Acceptance Scenarios**:

1. **Given** several players are searching in a language, **When** a new pairing is made, **Then** candidates are taken in the order they joined the queue, oldest first, and only those whose search heartbeat is within the last 10s.
2. **Given** a searching player's tab goes hidden, on any device, **When** the heartbeat reports it, **Then** the search is paused and the queue skips them; on return the queue screen reads `search paused · resume ▸` / `leit í bið · halda áfram ▸`, and `resume ▸` puts them back at their original place.
3. **Given** a search reaches 3:00, **When** the queue screen renders, **Then** it reads `Still searching? · 3:00` / `Leitar enn? · 3:00` with the primary `keep searching ▸` / `halda áfram að leita ▸`, the secondary `cancel ▸` and a 30s drain; with no answer the search stops and reads `search stopped · find again ▸` / `leit stöðvuð · leita aftur ▸`.
4. **Given** a queue table voids, **When** the viewer was seated, **Then** they are requeued at the front (User Story 3, scenario 4).
5. **Given** a player searching, **When** they leave the queue page by Back, closing the tab, the rules link or the language link, **Then** their heartbeat lapses and after 10s they are no longer a candidate.
6. **Given** a searching player, **When** the tab title is read, **Then** it is `searching 0:07 · Wottle` / `leitar 0:07 · Orðusta`.
7. **Given** a pairing, **When** it is made, **Then** the searcher's room goes to the table at the match's address as a new history entry, so Back from the table leaves it (User Story 3, scenario 2).

---

### User Story 5 - Leaving tables has a cost (Priority: P2)

Kári leaves two tables within 10 minutes. For the next 5 minutes he cannot search or send a challenge; the lobby shows `find again in 4:12` in place of `find an opponent ▸`.

**Why this priority**: Without it a player could dodge opponents by leaving every table they dislike, at no cost to them and a real one to the other player.

**Independent Test**: Record two `left` voids against one player within 10 minutes; a search or challenge attempt is refused with the remaining time, and the lobby shows the countdown.

**Acceptance Scenarios**:

1. **Given** a player has two `left` voids recorded against them within 10 minutes, **When** they try to search or send a challenge within 5 minutes of the second, **Then** the server refuses with the time remaining.
2. **Given** the cooldown, **When** the lobby renders, **Then** the find action reads `find again in 4:12` / `leita aftur eftir 4:12`, counting down, and is not a control until it ends.
3. **Given** a `not seated` void, **When** the cooldown is counted, **Then** it does not count: only `left` voids do.
4. **Given** a player who voids by leaving, **When** the other player was seated, **Then** the other player is never penalised.
5. **Given** a player in the cooldown, **When** someone challenges them or asks for a rematch, **Then** they can still accept it; the accept seats them at once.

---

### User Story 6 - The table on a phone (Priority: P2)

On a phone the ready slip is exactly the field's square. What does not fit (the facts line) moves to the ledger block below, in the live row's position. The screen stays awake at the table and while searching.

**Why this priority**: Most players will find a match on a phone; the slip must fit its square and the exit must stay visible.

**Independent Test**: At 390×844, 390×664 and 360×640 the table shows the scoreboard, the slip within the field's square with `ég er til ▸` and `fara`, and the facts line below; nothing scrolls.

**Acceptance Scenarios**:

1. **Given** a phone, **When** the table renders, **Then** the slip is the field's square and holds, in order: label, headline (name at 28px and rating), a series line for rematches, stakes, rule, the two seat lines, rule, the actions, and the drain on its bottom edge.
2. **Given** a phone, **When** the table renders, **Then** the ledger block below carries the facts line `íslensk orð · 10 leikir hvor · ein 5:00 klukka` in the live row's position.
3. **Given** a phone (coarse pointer) that supports it, **When** the player is at the table or searching, **Then** the screen is kept awake, and released when they leave either.
4. **Given** a phone, **When** the count runs, **Then** the scoreboard's clock row counts and the letters land in the field, as on desktop.

---

### User Story 7 - The rules, the design system and the fixtures say what is built (Priority: P2)

The rules document, the design system, CLAUDE.md and the `/dev/room` fixtures describe the table, the start and the void as built, and the visual suite has baselines for them.

**Why this priority**: The rules document is the authority for what a player is rated for; it must change in the same PR (S13).

**Independent Test**: `pnpm docs:check` passes; `/dev/room?phase=table`, `table-seated`, `starting`, `void`, `void-queue` and `searching-paused` render from static fixtures; the visual suite passes over them at three viewports.

**Acceptance Scenarios**:

1. **Given** the rules document, **When** §2a is read, **Then** "every outcome is rated" reads "every match that starts is rated. A table where both players do not sit down within 20s, or that a player leaves before go, is void: not a match, no rating, no history, no rematch."
2. **Given** the rules document's §12, **When** it is read, **Then** it has a row *The table* (seating, 20s, void), the *Clock* row names the `starting` phase, and the *Every match is rated* row excludes voids.
3. **Given** the design system, **When** §1.1 and §5.9 are read, **Then** the slip kinds include **ready** and **void**, and the ranking reads match over > end early > resign > ready or void; §5.3 lists the table sub-lines `on the way` / `ready`.
4. **Given** `/dev/room`, **When** the new phases are requested, **Then** each renders with no database, in both languages, at 1440×900, 1280×800 and 390×844, and the phone table at 390×664 and 360×640.

---

### User Story 8 - The resign slip names the loss (Priority: P3)

Now that the match state carries each player's stakes, the resign slip's body reads `Kári wins · your rating moves as a loss · −9`, the number in ink.

**Why this priority**: Deferred from spec 068 (its clarification Q3 and `TODOS.md`) because the stakes were not in the match state; this stage puts them there.

**Independent Test**: Open the resign slip in a live match; the body ends in the viewer's loss stake, the same number the table showed.

**Acceptance Scenarios**:

1. **Given** a live match, **When** the resign slip opens, **Then** its body ends `· −<loss stake>` in `--ink`, equal to the table's `loss −<n>`.

---

### Edge Cases

- **Both players unseated at 0:00.** The void names whoever did not sit down; if neither did, each sees `You did not sit down in time`, both searches stop, and neither is requeued.
- **Leave during the count.** A leave between the last seat and go voids the match as `left`; the letters already sent are discarded and the slip returns as the void slip.
- **Both press `ready ▸` at the same moment.** Seating is a compare-and-set per seat; the second seat completes the table exactly once and the start is set once.
- **A seat pressed after the deadline.** Refused; the room shows the void.
- **A player with the match open in two tabs.** A press in either tab seats them; both tabs show the same table.
- **The room never loads for one player.** The void is still decided: by the other player's client when it sees the deadline pass, and otherwise by the server's periodic sweep within 30s.
- **Clock skew.** The countdown and the count use the server-corrected time (spec 068's drift correction), so both rooms step together.
- **A requeued player whose tab is hidden.** They are requeued, but paused, and are skipped until they resume.
- **The cooldown across sessions.** It is counted from recorded voids, so signing out or reloading does not clear it.
- **Pending matches at release.** Matches created before this stage that are still pending when it ships are treated as tables with their original deadline passed, so they void rather than start without seats.
- **Sign out at the table.** Refused, as for a live match (spec 067); `leave` is the way out.
- **Reduced motion.** Fades and the letters' landing are instant; the drain bar, the 20s countdown and the 3·2·1 still step once a second.

## Requirements *(mandatory)*

### Functional Requirements

**The table**

- **FR-001**: Every match, whatever its origin (queue, challenge, crossed challenge, rematch, crossed rematch), MUST begin at the table; no match's clock starts before both players are seated.
- **FR-002**: At creation a player MUST be seated if their own press created the match, or if their tab was visible and they had given it input within the last 30s. Everyone else MUST be unseated with 20s from creation to sit down.
- **FR-003**: The server MUST NOT return a match's letters to any client before both players are seated.
- **FR-004**: Seating MUST be a compare-and-set per seat. The seat that completes the table MUST, in the same step, write the board, set the start to that moment + 4.5s and the deadline to the start + 5:00, and notify both players.
- **FR-005**: The room MUST render the table as User Story 1 describes: the scoreboard with the table sub-lines and a clock row that does not run, the empty ruled field at 32% under the ready slip, and the ledger with `opponent found`.
- **FR-006**: The ready slip MUST contain the label with the countdown, the focused headline, the facts, the stakes, the two seat lines, the actions by state and a 20s drain, in that order.
- **FR-007**: `ready ▸` MUST be the primary only while the viewer is unseated, never focused, and MUST ignore activation for 500ms after it appears. Once seated the slip MUST show `you are seated` with no primary; `leave` MUST remain a secondary in its own row.
- **FR-008**: The stakes MUST be the viewer's rating change for a win, a draw and a loss under the same rule that rates the match, provided by the server.
- **FR-009**: The match state MUST carry the table: each seat's seated time, the time to sit down, the origin, and, once void, the reason and who voided it.

**The start**

- **FR-010**: The room MUST lift the slip at the start − 3.3s and play the count in the scoreboard's `starting` state from the server's start time, with the letters landing during `3`.
- **FR-011**: At go the room MUST run the clock, draw the turn frame, play `match-start` (respecting the sound toggle), move focus to the field and announce line 1.
- **FR-012**: A client that learns of the start late MUST join the count where it is, or open the live match if go has passed.
- **FR-013**: The previous start rule (starting after a grace period or on heartbeats, whether or not both players have loaded) MUST be retired.

**The void**

- **FR-014**: A table MUST become void when its time to sit down passes without both seated (`not seated`), or when a player leaves before go (`left`), recording who voided it.
- **FR-015**: The void MUST be decided lazily when any client or loader reads the table past its deadline, and by a periodic server sweep at least every 30s.
- **FR-016**: A void match MUST write no rating and MUST be excluded from every history, record, statistic, recent-matches list and rematch offer.
- **FR-017**: On a void of a queue table, a seated player MUST be requeued at the front, keeping their original join time, and MUST keep searching from the void slip without navigating; the player who did not sit down MUST have their search stopped and MUST see `you did not sit down · your search stopped` in the lobby on return.
- **FR-018**: The void slip MUST show `no match`, the headline by reason, `nothing was rated`, and the actions by origin (queue: `you are back in the queue` and `cancel ▸`; challenge: `challenge again ▸` and `lobby`; rematch: `result ▸` and `lobby`). Its headline MUST be focused.
- **FR-019**: Resigning a match that has not started MUST be refused. Leaving the table (`leave`, or Back from the table or during the count) MUST void it as `left`.

**The queue**

- **FR-020**: The queue MUST pair candidates in the order they joined, oldest first, among only those whose search heartbeat is within 10s.
- **FR-021**: A hidden tab MUST pause its search on every device; a paused player MUST be skipped; `resume ▸` MUST restore their place.
- **FR-022**: At 3:00 of searching the queue MUST ask `still searching?` with a 30s drain, and stop the search if unanswered.
- **FR-023**: A pairing MUST take the searcher to the table at the match's address as a new history entry.

**The cooldown**

- **FR-024**: Two `left` voids recorded against a player within 10 minutes MUST refuse their searches and the challenges they send for 5 minutes after the second, counted from the recorded voids. Accepting an incoming challenge or rematch MUST stay open.
- **FR-025**: The lobby MUST show the cooldown in place of the find action as `find again in m:ss`, counting down.

**Signals and phones**

- **FR-025a**: Every room page (lobby, queue, profile) MUST check at least every 3s for a table waiting for the player and take them to it; the rules page does not check. On the queue page the queue's own poll is that check.

- **FR-026**: Tab titles MUST follow the beat: `Kári · opponent found · Wottle`, `3 · Kári · Wottle`, `searching 0:07 · Wottle` (Icelandic equivalents under `Orðusta`).
- **FR-027**: A table that opens in a hidden tab MUST play the `challenge` cue (respecting the sound toggle).
- **FR-028**: On a phone the ready and void slips MUST be exactly the field's square, with the facts line moved to the ledger block's live-row position; nothing may scroll at 390×844, 390×664 or 360×640.
- **FR-029**: On coarse-pointer devices that support it, the screen MUST be kept awake at the table and while searching.
- **FR-030**: The slip is a dialog; the headline MUST be announced assertively once; each seat change MUST be announced politely.

**Rating stake in the resign slip**

- **FR-031**: The resign slip's body MUST end with the viewer's loss stake in ink.

**Documents and fixtures**

- **FR-032**: The rules document MUST carry the §8b amendments for the table (§2a, §12 *The table*, *Clock* `starting`, *Every match is rated* excluding voids) in the same PR.
- **FR-033**: The design system MUST add the ready and void slip kinds and the table sub-lines; CLAUDE.md's Design and architecture sections MUST describe the table, the void and the queue rules.
- **FR-034**: `/dev/room` MUST add the phases `table`, `table-seated`, `void`, `void-queue` and `searching-paused` (with `starting` updated to follow the table), and the visual suite MUST have baselines for them.
- **FR-035**: Every new string MUST exist in both copy files; Icelandic strings marked (?) in the source MUST be added to the native-read list.

### Key Entities

- **Table** (part of a match before go): the two seats and when each was taken, the time to sit down, the origin, and, once void, the reason (`not seated` | `left`) and who voided it.
- **Void**: a match's end with no play; it carries no scores or ratings and is excluded everywhere a finished match is read.
- **Queue entry**: a searching player's language, the time they joined (kept across a requeue), their last search heartbeat, and whether their search is paused.
- **Table-leave record**: the `left` voids recorded against a player, from which the cooldown is counted.
- **Stakes**: for each player, the rating change a win, a draw and a loss would bring.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 rated matches in which either player was never seated, across the whole test suite and a 100-round race test of seats, leaves and deadlines.
- **SC-002**: 0 responses that carry a board for a match that is not yet started (contract test over every read path).
- **SC-003**: A searcher whose last heartbeat is older than 10s is never paired (0 pairings in the queue test), and among fresh candidates the one who joined first is always paired first.
- **SC-004**: Both players' rooms step the 3·2·1 within 250ms of each other, and go is at the server's start time ± 250ms.
- **SC-005**: A table whose time runs out becomes void within 1s for a player who has it open, and within 30s when neither player has it open.
- **SC-006**: A seated queue player is searching again within 1s of a void, ahead of everyone who joined after them.
- **SC-007**: The table, start and void work at 1440×900, 1280×800, 390×844, 390×664 and 360×640 with nothing scrolling, and the visual suite, axe, lint, typecheck, unit suite and `pnpm docs:check` pass.
- **SC-008**: A player whose tab is visible and in use reaches `starts in 3` without pressing anything when the other player is also present.

## Assumptions

- **Visibility and input without the stage 4 presence.** The seating rule's "visible tab with input in the last 30s" is reported on the heartbeats that exist today (the queue's search poll, the lobby's poll and the match state poll). Stage 4's per-tab presence (S5) replaces the source later without changing the rule.
- **`away` is stage 4.** The absent player's search stops and their lobby shows the notice; the `away` presence state itself arrives with S5.
- **Links are a later stage.** `challenge again ▸` uses today's send action; stage 4 restyles it with the composer. Invite links (S11) and their waiting table are not built.
- **OS notifications and reactions are out of scope.** The `challenge` cue and the tab title are the only signals; OS notifications arrive with the notification toggle in stage 4, reactions in phase 2.
- **The queue screen keeps its current layout.** The pause, the 3:00 check and `search stopped` are written into the current queue room's lines; the lobby's line slot (B7) is stage 4.
- **The scoreboard at the table.** The table joins the match states that draw the scoreboard (spec 068 drew it for starting, live and match over), as the canvas's Table, Void and PhoneTable artboards draw it.
- **The found state is retired.** The queue's `found` phase is replaced by the table.
- **Record and series lines** on the slip are phase 2 (S14) and rematch series (stage 5); the slip omits them until then.
- **Icelandic strings** marked (?) in the source are used as drafted and added to gap 4's native read.
