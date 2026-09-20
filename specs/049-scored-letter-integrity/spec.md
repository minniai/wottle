# Feature Specification: Scored-letter integrity and ownership

**Feature Branch**: `049-scored-letter-integrity`
**Created**: 2026-09-20
**Status**: Draft — Background and US1 amended 2026-09-20 after the diagnosis (research.md §1)
**Input**: User description: "Scored-letter integrity and ownership: a server invariant that every scored word still spells on the persisted board and no frozen letter changes after its freeze, closing the instant-scoring race; and scored letters coloured by their frozen tile's first owner, never ink"

## Background

A live match on 20 September 2026 (Dari 177 · Kari 106) showed four bands over letter runs that are not Icelandic words — `ÞKHL`, `GÁAAT`, `DUT`, `ÝGRR` — and three letters drawn in ink where two players' words cross.

The first looked like a data defect and is not one. The diagnosis (research.md §1) read that match's rows: every scored word spells correctly on its round's persisted board and on the final board; no frozen letter ever moved. What the client drew was the match's **starting** board — regenerated from the seed — with ten rounds of correct bands and freezes on it. When a match completes, its round pointer advances to 11, no round 11 exists, and the state loader silently regenerates the board from the seed instead of serving the last played round's. Every completed match has done this; the match-over slip of spec 048 invites a look at the final field, which is why it was seen now. The same match also shows a second defect: two minutes after it completed, a delayed server hook rewrote its row with round-5 values (round pointer 6, stale clocks, no winner), because the round-end write carries no guard against a stale writer. The instant-scoring race first suspected is not implicated and is out of scope.

The second is a design rule doing what it says: a letter in words of both seats is drawn in ink (design system §5.1, rules §12). The players read it as "a black letter that belongs to nobody". Freezing is already first-owner-wins, so every frozen letter has exactly one owner; the rendering should say so.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The field shows the board the match was played on (Priority: P0)

A player looking at a finished match sees the letters as they were when the last round resolved, with every band spelling its word. A match's board is never invented; if the data is ever inconsistent the room shows no band rather than a wrong one, and the server says so loudly.

**Why this priority**: A word duel whose final field shows non-words as scored is broken at its core, and the players are right not to trust the score.

**Independent Test**: Open any completed match (the three of 20 September 2026 included); the field is the last round's board and every band spells its word. Seed a record whose letters no longer match; no band, one warning. Replay a delayed round-end write; the completed row is untouched.

**Acceptance Scenarios**:

1. **Given** a completed match, **When** its state is loaded, **Then** the board, the scores and the last summary all come from the highest round that was played, never from the round pointer and never from the seed.
2. **Given** an in-progress match whose round pointer names a round that has no row, **When** its state is loaded, **Then** the board is the highest existing round's, the match is routed to recovery, and the fault is logged; the board is not regenerated.
3. **Given** a match with no round at all, **When** its state is loaded, **Then** round 1 is created from the seed as today — the one place the seed is a source.
4. **Given** the round-end write reaches the match row after another writer has already advanced or completed it, **When** it runs, **Then** it changes nothing and logs that it was late; the round pointer, the clocks, the state, the winner and the reason never move backwards.
5. **Given** the persisted board after any round resolves, **When** the server compares every word record against it, **Then** each spells its word letter for letter, and every frozen letter is unchanged since its freeze; a failure logs at error level with the record and the letters found and routes the round to recovery.
6. **Given** a word record whose letters do not match the board reaches a client anyway, **When** the field renders, **Then** no band is drawn for it, one warning is reported, and the ledger row still lists the word.
7. **Given** the matches of 20 September 2026, **When** their rows are read, **Then** each non-word band is traced to the mechanism above (done: research.md §1).

---

### User Story 2 - Every scored letter has one owner and one colour (Priority: P1)

A scored letter is drawn in the colour of the player who scored it first, always. When a later word crosses it, the crossing word colours only the letters it newly froze; the shared letter keeps its owner's colour and tint. Nothing on the field is ink but free letters.

**Why this priority**: Territory is the game's spatial story; a black letter reads as no one's ground, and the rules already say it is the first scorer's.

**Independent Test**: Open the `reveal` fixture (LEK crossing GILT); the shared L is coral with GILT's tint, LEK's band covers E and K only. Play a live crossing and confirm both clients agree.

**Acceptance Scenarios**:

1. **Given** GILT (opponent, round 2) and LEK (viewer, round 3) crossing at one letter, **When** the field renders, **Then** that letter is drawn in the opponent's colour with the opponent's band tint, and LEK's band covers only its other letters, with its chevron at the reading's start of the whole word.
2. **Given** the same crossing, **When** the ledger row for round 3 lists LEK, **Then** hovering it lights the whole word on the field, including the crossing letter, without changing its colour.
3. **Given** two players' words cross in the same round, **When** the round resolves, **Then** the crossing letter belongs to the earlier submission and is drawn in that player's colour.
4. **Given** any field, **When** its cells are read, **Then** no scored cell has the `shared` state; the value numeral on every scored letter is in its owner's text colour.
5. **Given** a screen reader, **When** it reads a crossing letter, **Then** its label names one owner (`frozen by Kári`), never two.

---

### Edge Cases

- A word record whose coordinates are the wrong length for its word (data corruption): treated as not spelling, no band, logged.
- The fast path and the combined pass both write the same word in the same round: the combined pass's delete-then-insert remains canonical; the integrity check runs after it.
- A completed match whose row was already written backwards (the 20 September match): the loader ignores the pointer, so it renders correctly with no data repair; its stale clocks are invisible behind the rating lines.
- Recovery creates the next round while the original resolution is still running: both writers now carry the guard; whichever lands second changes nothing.
- A partial freeze (the 24-unfrozen floor): a word's unfrozen letters are not frozen by design; the integrity check compares letters, not freezes, for those cells, and the existing rule that a settled band covers only frozen letters stands.
- Recovery re-scores a stuck round: the check runs again on its result.
- A crossing letter whose owner later resigns or disconnects: ownership does not change; colour does not change.
- The territory counts in the ledger already count per owner; nothing changes there, and the check in US2 scenario 4 confirms the counts equal the number of cells drawn in each colour.

## Requirements *(mandatory)*

### Functional Requirements

**Integrity (US1)**

- **FR-001**: After every round resolution, before the next round opens, the server MUST verify that every word record of the match spells its word on the persisted board and that no frozen cell's letter differs from the letter recorded at its freeze.
- **FR-002**: A failed verification MUST be logged at error level with match id, round, the record and the letters found, MUST NOT be swallowed, and MUST route the round into the stuck-round recovery path rather than opening the next round on inconsistent data.
- **FR-003**: For a completed or abandoned match, the state loader MUST serve the board, the scores and the last summary of the highest round that was played. For an in-progress match whose round pointer has no row, it MUST serve the highest existing round's board and trigger recovery. It MUST regenerate a board from the seed only for a match that has no round at all; any other missing or unreadable snapshot is an error, logged and routed to recovery.
- **FR-004**: The round-end write to the match row MUST be conditional on the round it read and on the match not being completed, so that a delayed writer changes nothing; a rejected write is logged at warn level with the values it carried.
- **FR-005**: The client MUST draw a settled band only when the letters under its cells spell the word; otherwise it draws none and, outside production, reports the record once.
- **FR-006**: The client's existing development-only integrity report MUST become a production-safe signal: reported once per match at warn level, never thrown.
- **FR-007**: The match of 20 September 2026 MUST be diagnosed from its rows before the fix is designed in `plan.md`; the finding is recorded in `research.md` and, if it contradicts Background, this spec is amended. **Done 2026-09-20**: it did, and it was.

**Ownership (US2)**

- **FR-008**: A scored letter's colour and value-numeral colour MUST come from its frozen tile's owner, resolved to a seat through `getSeatColors`, never from which bands cover it.
- **FR-009**: The `shared` cell state and the ink-at-weight-700 treatment MUST be removed from the field, the stylesheet, the fixtures and the tests.
- **FR-010**: A band MUST cover only the letters its word froze first; a crossing letter belongs to the earlier word's band. Chevron placement is unchanged: at the reading's start of the whole word, even when that letter belongs to another band.
- **FR-011**: Row hover MUST still light every letter of the hovered word, including letters owned by another word.
- **FR-012**: Design system §2 (the shared-letter numeral), §5.1 (letter states), §5.2 (crossings), rules document §12 (the crossing row) and `CLAUDE.md` MUST be amended in the same change; the `reveal` and `settle` fixture baselines MUST be updated.

### Key Entities

- **Word record** (existing): word text, round, player, coordinates in reading order. Gains no field; gains an invariant: its coordinates spell its word on the persisted board.
- **Frozen tile** (existing): owner, scored axes. Gains an invariant: the letter at its cell never changes after the freeze. Its owner is the single source of a scored letter's colour.
- **Band** (client): now covers the subset of a word's cells that this word froze first.

## Assumptions

- The diagnosis (research.md §1) replaced the first hypothesis; US1 and FR-003/FR-004 were rewritten to the mechanism found. The instant-scoring race window is real in code, produced no bad data in three matches, and is filed as a follow-up outside this spec.
- No data repair is needed: the loader change makes every affected match render correctly from the rows it has.
- Same-round crossings resolve to the earlier submission (already the engine's first-owner rule); no tile owner `both` is introduced.
- Ownership rendering changes no scoring, no freezing and no territory count; it is presentation over data that already exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across 50 consecutive completed matches in production after deployment, zero integrity failures are logged.
- **SC-002**: The three completed matches of 20 September 2026 render their final boards from their last played round; every band spells its word; a delayed round-end write replayed against a completed match changes nothing.
- **SC-003**: No fixture or live field renders a cell in the `shared` state; the count of coral cells plus teal cells equals the ledger's territory counts.
- **SC-004**: The acceptance grep for `shared` as a cell state and for ink-coloured scored letters returns nothing under `components/` and `app/styles/`.
- **SC-005**: The match of 20 September 2026 is explained: each of its four non-word bands is a correct record drawn over the seed-regenerated starting board (research.md §1.2).
