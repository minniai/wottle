# Feature Specification: Languages by URL — Orðusta and wottle

**Feature Branch**: `060-locales`
**Created**: 2026-09-22
**Status**: Draft
**Design**: plan `/Users/ari/.claude/plans/pasted-content-id-13f6-make-any-peppy-sun.md` (phases P1 routing · P2 copy · P3 game language · P4 ratings)
**Input**: User description: "Make any language accessible over URL direction with /en, /dk, /is etc with the correct dictionary and language. Translate the game to Icelandic (where it is called Orðusta and make the game in Icelandic as the main default url."

## Background

Every player-facing string is English today, every match is played with the Icelandic dictionary, and nothing in a URL names a language. The game's audience is Icelandic first, and in Icelandic it is called **Orðusta**. The engine already keeps a dictionary and a letter-value table for each of five languages (is, en, se, no, dk), but nothing chooses between them: the language is not stored on a match, the queue and lobby mix every player, and there is one rating per player.

This spec makes the language a property of the URL for the interface and a property of the match for the game. Icelandic lives at the unprefixed URLs; every other language lives under its own path segment. This pass ships Icelandic and English; the next language is added as data.

Decisions recorded 2026-09-22 (each was a question to the product owner; the answer is binding):

| Question | Decision |
| --- | --- |
| Languages playable in this pass | Icelandic and English; Danish and others later, data-only |
| URL shape | Icelandic unprefixed (`/`, `/lobby`, `/match/…`); English under `/en/…`; `/is/…` redirects to the unprefixed URL |
| Matchmaking across languages | Never: queue, lobby, invites and presence are separate for each language |
| Ratings across languages | Separate: a player has one rating per language; today's ratings become the Icelandic ones |
| Name | `orðusta` (Orðusta in prose) in Icelandic; `wottle` in every other language |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An Icelandic player finds Orðusta at the plain address (Priority: P1)

A player opens the site's root address. Everything they read — the sign-in slip, the lobby, the queue, the room's live row and bars, the ledger, the match-over slip, the profile, the rules page, the browser tab title — is in Icelandic, and the game is called Orðusta. The board is Icelandic letters and words score against the Icelandic dictionary, exactly as today.

**Why this priority**: Icelandic is the game's primary audience and the default address; it is the change most players will see.

**Independent Test**: Open `/`, sign in, queue two players, play a match to the end; every visible string is Icelandic and the wordmark reads `orðusta`.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open `/`, **Then** the sign-in slip, wordmark and page title are in Icelandic and the document declares its language as Icelandic.
2. **Given** a signed-in player at `/lobby`, **When** they find an opponent and play, **Then** every live-row line, bar sub-line, ledger caption, notice and slip is Icelandic, and nothing in the room is English.
3. **Given** any visitor, **When** they open `/is/lobby`, **Then** they are permanently redirected to `/lobby`.
4. **Given** a player at `/rules`, **When** the page loads, **Then** the rules are written in Icelandic.

---

### User Story 2 - An English player plays wottle in English with English words (Priority: P2)

A player opens `/en`. The interface is English and the game is called wottle. Their match is dealt an English board, words score against the English dictionary with English letter values, and they are paired only with other English players.

**Why this priority**: It is the first proof that a language is more than a translation: interface, dictionary, board and matchmaking all follow the URL.

**Independent Test**: Two players sign in at `/en`, queue, and play; the board uses English letter frequencies, an English word scores, an Icelandic-only word does not.

**Acceptance Scenarios**:

1. **Given** a visitor, **When** they open `/en`, **Then** every string is English, the wordmark reads `wottle`, and the document declares English.
2. **Given** two players queued at `/en`, **When** they are paired, **Then** their match is an English match: its board is drawn from English letter frequencies, and a move forming an English dictionary word scores it with English letter values.
3. **Given** one player queued at `/lobby` and one at `/en/lobby`, **When** both wait, **Then** they are never paired with each other.
4. **Given** a player in the English lobby, **When** they look at who is here, **Then** they see only players present in the English lobby, and can challenge only them.

---

### User Story 3 - A match always speaks its own language (Priority: P2)

A match's language is decided when it is created and never changes. Anyone who opens that match's address under another language's prefix is sent to the same match under its own language, so the words on the board and the words around it always agree.

**Why this priority**: A mismatch (Icelandic board, English interface, or the reverse) breaks the game's reading; storing the language on the match also makes rematches and invites correct.

**Independent Test**: Create an English match, then open `/match/<id>`; the browser lands on `/en/match/<id>`.

**Acceptance Scenarios**:

1. **Given** an English match, **When** a participant opens `/match/<id>`, **Then** they are redirected to `/en/match/<id>`.
2. **Given** a challenge sent from the English lobby, **When** it is accepted, **Then** the match is English.
3. **Given** a finished Icelandic match, **When** the players rematch, **Then** the rematch is Icelandic regardless of the address either player is on.

---

### User Story 4 - A rating for each language (Priority: P3)

A player who plays in both languages holds two ratings. The lobby, the match-over slip and the profile show the rating for the language of the page (or of the match). Players who played before this change keep their rating as their Icelandic rating and start English at the starting rating.

**Why this priority**: Separate ratings are what make separate queues fair; it can ship after the queues themselves.

**Independent Test**: A player with Icelandic rating 1320 plays and wins an English match; their English rating moves from the starting rating, their Icelandic rating stays 1320, and `/profile/<name>` and `/en/profile/<name>` show each.

**Acceptance Scenarios**:

1. **Given** a player rated 1320 before this change, **When** the change ships, **Then** their Icelandic rating is 1320 and their English rating is the starting rating.
2. **Given** an English match that finishes, **When** ratings are settled, **Then** only both players' English ratings change.
3. **Given** a player's profile, **When** it is opened under `/en`, **Then** it shows the English rating, its chart, and English matches only.

---

### User Story 5 - Switch language from the room (Priority: P3)

From the lobby or a finished match, a player can move to the same page in the other language with one link in the ledger foot (`english ▸` in Icelandic, `íslenska ▸` in English).

**Why this priority**: Convenience; the address alone already gives full access.

**Independent Test**: At `/lobby`, follow `english ▸`; the browser is at `/en/lobby`, still signed in.

**Acceptance Scenarios**:

1. **Given** a signed-in player at `/lobby`, **When** they follow the language link, **Then** they arrive at `/en/lobby` signed in as the same player.
2. **Given** a live match, **When** the player looks for the language link, **Then** it is not offered.

---

### Edge Cases

- An unknown prefix (`/xx/lobby`): treated as a page that does not exist under Icelandic, i.e. not found; it never silently becomes a language.
- A future language whose path segment differs from its standard language tag (Danish at `/dk`, tag `da`): the document declares the standard tag.
- A player queued in one language who opens the other language's lobby in a second tab: they are in at most one queue at a time; the new queue replaces the old.
- A pending challenge between a player in each language cannot exist: challenges are only offered between players present in the same language's lobby.
- A signed-in session carries across languages: the same name and identity everywhere; only the rating and the lobby differ.
- Internal links, redirects and address-bar rewrites inside the room (queue → found → match, lobby landing) keep the current language prefix.
- Messages the server shows the player (sign-in failure, queue failure, rematch failure, preview refusal) appear in the page's language.
- The rules page and profile, which sit outside the room, also follow the prefix.
- A match's letters and words always follow the match's language even when an interface string mentions them (e.g. the frozen-letter notice quotes the letter as the board shows it).

## Requirements *(mandatory)*

### Functional Requirements

**Addressing**

- **FR-001**: The site MUST serve Icelandic at the unprefixed addresses and every other supported language under its own path segment (`/en/…` in this pass).
- **FR-002**: Addresses beginning `/is` MUST permanently redirect to the same path without the prefix.
- **FR-003**: Every internal link, redirect and address rewrite MUST keep the current language's prefix.
- **FR-004**: Adding a language MUST require only data: its path segment, standard language tag, name, strings, dictionary, letter values and letter frequencies.
- **FR-005**: Each page MUST declare its language to the browser and assistive technology, and its title and description MUST be in that language.

**Interface language**

- **FR-006**: Every player-facing string — room, slips, notices, live row, bars, ledger, lobby, queue, profile, menu, accessible labels, rules page, metadata and server messages shown to the player — MUST be available in Icelandic and English, and the page MUST show the one matching its address.
- **FR-007**: The wordmark MUST read `orðusta` in Icelandic and `wottle` in every other language.
- **FR-008**: Each language MUST own its word order and plural forms; Icelandic strings MUST be grammatical for every number shown.
- **FR-009**: Dates and numbers MUST be formatted for the page's language.
- **FR-010**: The Icelandic strings MUST follow the design system's copy rules (sentence case, no exclamation marks, one idea per line, lowercase wordmark). <!-- retired-name -->
- **FR-011**: A missing string in any language MUST fail the build rather than fall back silently.

**Game language**

- **FR-012**: A match MUST have one language, set at creation and never changed.
- **FR-013**: A queue match MUST take the language of the lobby the players queued from; a challenge match the language of the lobby it was sent from; a rematch the language of the original match.
- **FR-014**: A match's board MUST be drawn from its language's letter frequencies, and every move MUST be validated against its language's dictionary and scored with its language's letter values; the move preview MUST do the same.
- **FR-015**: A match opened under another language's prefix MUST redirect to the same match under its own language.
- **FR-016**: Warm-up and queue placeholder boards in a lobby MUST use that lobby's language's letters.
- **FR-017**: Icelandic matches MUST behave exactly as they do today (same dictionary, letter values, frequencies and scoring).

**Matchmaking**

- **FR-018**: Players MUST only be paired by the queue with players queued in the same language.
- **FR-019**: A lobby MUST show, count and allow challenges to only the players present in that language's lobby.
- **FR-020**: A player MUST be in at most one language's queue at a time.

**Ratings**

- **FR-021**: A player MUST hold a separate rating, peak and win/loss/draw record for each language.
- **FR-022**: Settling a match MUST change only the ratings for the match's language.
- **FR-023**: Every rating shown (lobby, match-over slip, profile, rating chart, match history) MUST be the one for the page's or match's language.
- **FR-024**: Existing ratings and records MUST become the Icelandic ones; a player with no rating in a language MUST be shown the starting rating.

**Switching**

- **FR-025**: The lobby and final states MUST offer one link to the same page in the other language; a live match MUST NOT.

### Key Entities

- **Language**: a supported language — path segment (empty for Icelandic), standard tag, game name, strings, dictionary, letter values, letter frequencies.
- **Match** (extended): gains its language.
- **Challenge** (extended): gains the language of the lobby it was sent from.
- **Lobby presence / queue entry** (extended): gains the language the player is present or queued in.
- **Language rating** (new): a player's rating, peak and record in one language.
- **Rating change** (extended): records the language it applies to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor at `/` sees no English string on any room state, the rules page or the profile (verified across all 25 fixture states and the Icelandic visual set).
- **SC-002**: Every English room state renders identically to today when opened under `/en` (existing visual baselines pass unchanged).
- **SC-003**: Over repeated queue trials with one Icelandic and one English player waiting at the same time, zero cross-language pairings occur.
- **SC-004**: 100% of English matches score English dictionary words and reject Icelandic-only words; 100% of Icelandic matches score exactly as before (all existing scoring regressions pass).
- **SC-005**: Move resolution stays within today's latency target with both dictionaries loaded.
- **SC-006**: Every player's Icelandic rating after the change equals their rating before it.
- **SC-007**: Adding a third language requires no change outside its own data and one registry entry (demonstrated by a test that registers a stub language).

## Assumptions

- The English word list shipped in the repository (about 79,000 words) is good enough for launch; a larger list can replace it as data.
- The Icelandic translation is drafted by the implementer and reviewed by a native speaker before release.
- Player names, sessions and profiles are shared across languages; only lobby, queue and rating are separate.
- Switching language remounts the room; this is acceptable because it is only offered from the lobby and final states.
- Server and log text not shown to players stays English.
- Internal storage keys and cookie names containing "wottle" are not renamed.

## Out of Scope

- Playable Danish, Swedish or Norwegian (their data exists; they are added after this spec).
- Choosing a language by browser preference or remembering the last language; the address is the only authority.
- Translating documentation.
- Dropping the old single-rating fields (a follow-up, like the other retired columns).
