# Feature Specification: Identity, and one commitment at a time

**Feature Branch**: `067-identity-one-match`
**Created**: 2026-09-23
**Status**: Draft
**Input**: Stage 1 of the game flow redesign. Source of truth: `docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md` — §1 verdict problems 2 and 3, §7.5 server invariants 0, 2, 4 and 13, §7.8 identity (must-have parts), §7.9 rows S1 and S2, and A1's returning and name-taken states. Owner decisions in §10 are settled and are not re-asked here. Design canvas https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo, artboards DoorReturning, DoorIs, DoorEn.

## Context

Two defects rank second and third in the game-flow verdict:

- **Anyone can become anyone.** Signing in is an upsert on the lowercased name with no secret, and the session cookie is unsigned, readable, editable JSON. Typing `birna` gives you Birna's rating, history and incoming challenges; editing the cookie gives you anyone.
- **One player can be booked into two rated matches at once.** Sending a challenge checks only the recipient, accepting never re-checks the sender, and accepting a rematch checks neither player. Each of the six ways into a match (queue, challenge accept, crossed challenges, rematch accept, crossed rematches, and later invite links) creates the match by its own path.

A related defect from verdict problem 8: signing out can resign a live rated match.

This stage fixes identity and match creation on the server, and adds the two door states the fix makes visible. Supabase Auth follows in the next phase and will replace much of the identity mechanism; the signed session and the single match-creation path are needed either way.

## Clarifications

### Session 2026-09-23

- Q: How much of S1's device key and claim hash to build before Supabase Auth? → A: Full S1: device key, claim hash, `name_taken`, silent renewal, and the first browser after release claims each existing name. The claim hash is the column Supabase Auth later links to an account.
- Q: When a browser holding Birna's claim enters a different, unclaimed name, what happens to Birna's claim? → A: The device key stays and also claims the new name; the browser can enter as either, and the returning door shows the most recently used name.
- Q: Should an old unsigned cookie be honoured once at release so its browser can claim its name? → A: No grace. Old cookies count as no session; each player types their name once to claim it; release when no match is in progress.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - My session cannot be forged (Priority: P1)

Birna is signed in. Someone who copies, edits or fabricates a session cookie — by changing the player id or name inside it, or by writing one from scratch — is treated as signed out. Nobody can act as Birna without the session the server issued to her browser.

**Why this priority**: Every rating, record, challenge and match assumes the identity the session names. Until the session cannot be forged, nothing else in the product is trustworthy. It is the top beta blocker.

**Independent Test**: Sign in, alter one character of the session cookie's content (or replace it with a hand-built one naming another player), reload any signed-in page: the room shows the signed-out door, and every server action or route answers as unauthenticated.

**Acceptance Scenarios**:

1. **Given** a session issued by the server, **When** its content is changed in any way, **Then** the server treats the request as having no session.
2. **Given** a cookie in the old unsigned format, **When** it reaches the server after release, **Then** it is treated as no session (and, for a browser with a device key, renewed silently per Story 2).
3. **Given** a valid session, **When** the signing secret is missing from the server's configuration, **Then** the server refuses to start or to issue sessions rather than falling back to unsigned ones.
4. **Given** a valid session older than its lifetime, **When** it reaches the server, **Then** it is treated as expired.

---

### User Story 2 - This browser keeps my name (Priority: P1)

Birna enters with her name. From then on this browser holds her name: nobody in another browser can enter as `birna`; when her session lapses she is back in without typing anything; and after signing out the door greets her by name.

**Why this priority**: A signed session alone still lets a stranger type `birna` and receive a fresh, valid session for Birna. The claim is what makes the name hers.

**Independent Test**: Enter as a new name in browser A. In browser B, try the same name: `that name is taken · pick another`. In A, let the session lapse (or delete only the session cookie) and reload: still signed in as the same player. Sign out in A: the returning door shows the name.

**Acceptance Scenarios**:

1. **Given** a name no browser has claimed, **When** a visitor enters it, **Then** they are signed in, and this browser receives a long-lived device key bound to that player.
2. **Given** a name claimed by another browser, **When** a visitor enters it (in any letter case), **Then** they are not signed in and the door's error line reads `that name is taken · pick another` / `þetta nafn er frátekið · veldu annað`.
3. **Given** a browser holding the device key for a player, **When** that browser enters the same name again, **Then** it is signed in as that player.
4. **Given** a browser holding a device key and no valid session, that has not signed out since it last entered, **When** it opens any page or calls any route, **Then** a new session for that player is issued without the door being shown. (A browser that signed out sees the returning door instead, Story 3.)
5. **Given** a player who existed before this release and has no claim, **When** the first browser after the release enters that name, **Then** that browser claims it, and every later browser is refused with `name taken`.
6. **Given** a browser whose device key names a player that no longer exists or whose claim no longer matches, **When** it opens a page, **Then** the key is ignored and cleared, and the empty door is shown.

---

### User Story 3 - Returning door (Priority: P2)

After signing out, Birna comes back to the door and sees `welcome back`, her name with a `--you` square, her rating in this language, `enter the lobby ▸`, and `not Birna? · use another name`, which shows the empty name input.

**Why this priority**: It is how the claim becomes visible and usable after sign-out; without it the only way back is to type a name the browser already owns.

**Independent Test**: Sign out and view the door in each language; press `enter the lobby ▸` and land in the lobby as the same player; press `not Birna? · use another name` and see the empty door.

**Acceptance Scenarios**:

1. **Given** a signed-out browser with a valid device key, **When** it shows the door, **Then** the door's name area shows the returning state (DoorReturning): label `WELCOME BACK` / `GAMAN AÐ SJÁ ÞIG AFTUR`, the player's display name (not an input) with a 12px `--you` square, a sub-line of the rating and language (`1310 · english`), primary `ENTER THE LOBBY ▸` / `INN Í LOBBÍIÐ ▸`, and secondary `not Birna? · use another name` / `ekki Birna? · annað nafn`.
2. **Given** the returning state, **When** the player presses the primary, **Then** they are signed in as that player without typing, and land where they would after a normal sign-in.
3. **Given** the returning state, **When** the player presses `use another name`, **Then** the empty state is shown with the input; if they then enter a different, unclaimed name, the same device key claims it too, and this browser can still enter as Birna.
4. **Given** a browser with no device key, **When** it shows the door, **Then** the empty state is shown, with `NO ACCOUNT NEEDED` and `THIS BROWSER KEEPS YOUR NAME` under the primary.

---

### User Story 4 - Signing out never costs me a match (Priority: P2)

Birna signs out. If she has a live match, sign-out is not offered; in no case does signing out resign, forfeit or end a match. Otherwise signing out withdraws her outgoing challenge and cancels her search, so nobody is paired with someone who has left.

**Why this priority**: A control that silently forfeits a rated match is a trust defect in its own right, and sign-out is the step that makes the returning door reachable.

**Independent Test**: Start a match and open the menu: no sign-out. Outside a match, send a challenge and sign out: the recipient's challenge is withdrawn; start a search and sign out: the queue no longer holds the player.

**Acceptance Scenarios**:

1. **Given** a player with a match in progress (or pending), **When** they open the room menu, **Then** sign-out is not available, and a sign-out request reaching the server is refused without touching the match.
2. **Given** a player with no live match and an outgoing challenge, **When** they sign out, **Then** the challenge is withdrawn and disappears from the recipient's lobby.
3. **Given** a player searching for an opponent, **When** they sign out, **Then** they leave the queue and cannot be paired.
4. **Given** any sign-out, **When** it completes, **Then** the session is cleared, the device key is kept, and the door shows the returning state.

---

### User Story 5 - One match at a time, whichever way in (Priority: P1)

However a match comes about — the queue pairs two players, a challenge is accepted, two players challenge each other at once, a rematch is accepted, two players ask each other for a rematch at once — the server creates it through one path that checks both players and refuses if either already has a pending or in-progress match. Creating it clears both players' other commitments in the same step.

**Why this priority**: A player booked into two rated matches loses at least one of them without playing it; it corrupts ratings and trust exactly as a forged identity does.

**Independent Test**: With Birna in a match against Kári, have Embla (who holds an older challenge from Birna) accept it: refused with `Birna can't play right now`, and no match is created. Fire two accepts for the same pair concurrently: exactly one match exists.

**Acceptance Scenarios**:

1. **Given** Birna has sent a challenge to Embla and has since entered a match with Kári, **When** Embla accepts, **Then** no match is created and Embla sees `Birna can't play right now` / `Birna getur ekki spilað núna`.
2. **Given** two players each hold a pending challenge to the other, **When** the second challenge is sent, **Then** exactly one match is created between them and both challenges are closed.
3. **Given** a rematch request, **When** it is accepted while either player is in another match, **Then** it is refused and no match is created.
4. **Given** both players request a rematch of the same match at once, **Then** exactly one new match is created.
5. **Given** a match is created for a player by any path, **Then** in the same step that player's search is cancelled, their outgoing challenge and outgoing rematch request are withdrawn, and every pending challenge or rematch request addressed to them is answered `superseded` (it disappears from the sender's view as no longer possible, not as declined).
6. **Given** any number of concurrent attempts to put the same player into a match (queue claims, accepts, crossed challenges and rematches racing), **Then** at most one pending or in-progress match exists for that player at any moment.
7. **Given** a challenge, **When** the recipient accepts it twice, or accepts after it expired or was withdrawn, **Then** only a pending challenge can be accepted, once.

---

### Edge Cases

- Two browsers submit the same unclaimed name at the same moment: exactly one claims it; the other gets `name taken`.
- A player with a claim clears cookies: the name is lost to them until identity recovery (Supabase Auth, next phase). The door already says `this browser keeps your name`; no recovery is built now.
- A player in a live match whose session lapses: silent renewal restores the session; the match continues.
- The signing secret is rotated: every existing session becomes invalid; browsers with a device key renew silently.
- A device key cookie is stolen: whoever holds it is that player. Accepted for this bridge (httpOnly, Secure, SameSite=Lax); Supabase Auth replaces it.
- Letter case: `Birna`, `birna` and `BIRNA` are one name for claiming and refusal.
- A queue pairing finds its candidate was just booked by an accept: the pairing is refused and the searcher stays in the queue, still searching.
- The accepter is the one who is not free (already in a match): the accept is refused and no match is created.
- Rate limits on sign-in still apply; `too many tries · wait a minute` precedes `name taken` when both would apply.
- A crossed challenge where one of the two is not free: no match; the new challenge is refused as usual.

## Requirements _(mandatory)_

### Functional Requirements

**Session**

- **FR-001**: The session the server issues MUST carry a keyed signature over its whole content; the server MUST reject any session whose signature does not verify, whose format is the old unsigned one, or whose age exceeds its lifetime (4 hours, unchanged).
- **FR-002**: The signing key MUST be server-only configuration, never reachable by client code; the server MUST refuse to issue or accept sessions when it is absent.
- **FR-003**: Every place that reads the session MUST go through the one verifying reader; no code may decode the session without verifying it.

**Claim (S1 bridge, full S1 per Clarifications)**

- **FR-004**: On a successful entry the server MUST issue this browser a device key (random, at least 128 bits, httpOnly, Secure in production, SameSite=Lax, one year) and store only a hash of it against the player (`claim hash`). A browser that already holds a device key keeps it; the same key may claim several players.
- **FR-005**: Entering a name whose player has a claim MUST succeed only when the browser presents the matching device key; otherwise it MUST fail with the `name_taken` error, rendered as `that name is taken · pick another` / `þetta nafn er frátekið · veldu annað` on the door's error line.
- **FR-006**: Entering a name whose player has no claim (new, or existing from before this release) MUST claim it for this browser atomically, so that of two simultaneous attempts exactly one succeeds.
- **FR-007**: A request with a valid device key and no valid session MUST receive a new session for that player without user action, unless this browser signed out since it last entered.
- **FR-008**: A device key that matches no player's claim MUST be cleared and ignored.

**Door**

- **FR-009**: A signed-out browser with a valid device key MUST see the returning state as described in User Story 3, scenario 1, in the current door's name area, with strings from both copy files.
- **FR-010**: `enter the lobby ▸` in the returning state MUST sign the player in from the device key alone. (`?next=` does not exist yet; it arrives with the door redesign and §7.5 invariant 12.)
- **FR-011**: `use another name` MUST show the empty state; the device key MUST never be replaced by entering another name, and MUST claim that name too if it is unclaimed. The returning state MUST show the player this browser entered as most recently.
- **FR-012**: The empty state MUST show `NO ACCOUNT NEEDED` / `SKRÁNING ÓÞÖRF` and `THIS BROWSER KEEPS YOUR NAME` / `ÞESSI VAFRI GEYMIR NAFNIÐ ÞITT` below the primary.

**Sign-out**

- **FR-013**: Signing out MUST NOT resign, forfeit or end any match; the resign-on-logout path is removed.
- **FR-014**: Signing out MUST be refused while the player has a pending or in-progress match, and the room MUST not offer it then.
- **FR-015**: Otherwise signing out MUST withdraw the player's outgoing challenge, cancel their search, clear their presence and session, and keep the device key.

**One way to make a match (S2)**

- **FR-016**: There MUST be exactly one operation that creates a match, taking the two players, the match language, the origin (`queue`, `challenge`, `crossed_challenge`, `rematch`, `crossed_rematch`, `link`) and a reference to what caused it. No other code path in the app (`app/`, `lib/`) may insert a match; seed scripts and test harnesses are exempt.
- **FR-017**: That operation MUST, in one atomic step: lock both players in a fixed order, refuse unless neither has a pending or in-progress match, create the match, mark both players as in a match, cancel both players' searches, withdraw both players' outgoing challenges and outgoing rematch requests, and answer every pending challenge and rematch request addressed to either player `superseded`.
- **FR-018**: There MUST be exactly one operation that accepts a challenge: a compare-and-set of that challenge from pending to accepted by its recipient, followed in the same atomic step by FR-017; if FR-017 refuses, the challenge MUST NOT be left accepted.
- **FR-019**: A refusal because the other player is not free MUST reach the accepter as a typed error rendered `<name> can't play right now` / `<name> getur ekki spilað núna`.
- **FR-020**: The queue claim, challenge accept, crossed challenges (a new challenge to someone whose challenge to you is pending), rematch accept and crossed rematches MUST all create their match through FR-016. Link accept (S11) is not built here; the operation MUST accept its origin so S11 needs no second path.
- **FR-021**: Challenge and rematch request statuses MUST include `superseded` (and `withdrawn` for FR-015 and FR-017), displayed to the sender as a closed challenge, never as a decline.
- **FR-022**: The rules and design documents MUST be amended in the same change where they describe sign-in, sign-out or match creation.

### Key Entities

- **Player**: gains a claim hash (hash of the device key that owns the name) and the time it was claimed. A player with no claim is unclaimed.
- **Session**: the signed, short-lived statement "this browser is player X", issued at entry or renewal.
- **Device key**: the long-lived secret this browser holds; its hash is the claim of every player this browser has claimed (one key, possibly several players).
- **Match**: gains its origin and a reference to the challenge, rematch request, queue pairing or link that caused it.
- **Challenge / rematch request**: statuses widen with `withdrawn` and `superseded`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of altered, fabricated or old-format sessions are rejected in an automated suite covering every protected page, server action and API route.
- **SC-002**: Entering a claimed name from a browser without its key fails 100% of the time; entering it with its key succeeds 100% of the time.
- **SC-003**: A player whose session lapses returns to any page signed in, with no door shown, on the first request.
- **SC-004**: Under a concurrency test firing every combination of the five creation paths at the same players (at least 100 races), no player ever holds more than one pending or in-progress match.
- **SC-005**: Zero matches are resigned, forfeited or ended by a sign-out in the automated suite.
- **SC-006**: A code search finds exactly one place that inserts a match.
- **SC-007**: Sign-in, renewal and match creation add no more than 50ms at p95 to the flows they sit in.

## Scope notes

**Bridge**: the full S1 is built (Clarifications, 2026-09-23). Supabase Auth, next phase, links an account to the existing claim hash; nothing here is built only to be thrown away except the device-key cookie itself.

**In scope**: FR-001–FR-022.

**Out of scope**: every other screen change (the A1 lockup, headline, here-now list, masthead, line slot, and the rest of the door redesign); challenge lifecycle, presence, push, queue freshness, rematch window, invite links, tables (S3–S13 except the statuses FR-021 needs); phase 2 (S14–S20); identity recovery; renames and name reservation.

## Assumptions

- The returning state and the new lines go into the room's existing door (the sign-in slip over the empty ruled frame) rather than the full A1 layout, which ships with the door redesign.
- Session lifetime stays 4 hours; the device key lasts one year and renews its expiry on each use.
- Sign-in stays name-only; no password or email is added before Supabase Auth.
- The match-over, resign and end-early paths are unchanged; they end matches and create none.
- Releasing this invalidates every existing session once, with no grace period for old unsigned cookies (they could be forged); players type their name again (and claim it) on their next visit. The release is deployed when no match is in progress.
- A "live" match for FR-014 and FR-017 is one in `pending` or `in_progress`.
- Until the S4 challenge-outcome screens ship, a `superseded` or `withdrawn` challenge simply leaves the sender's and recipient's lobby lines, as an expired one does today; no new outcome copy is added here.
