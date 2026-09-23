> Design canvas: https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo (32 artboards). Fixture note: the canvas uses word sets that sum exactly to the §5.0 totals (IS-M final: Birna MÁL·HAF·SÓL·TÁR·EGG·NET·SÁL, Kári MÝS·LEG·DAG·LIT·GRÁ; territory 28–20; best word BORÐ 23), because the BORÐA 29 / 10-words / 134 combination in §5.0 cannot be satisfied.

# Wottle / Orðusta: the new flow and every screen

**Final spec.** This combines the flow, social, visual, in-game and i18n audits, revised after three adversarial reviews (system, player and feasibility); the Review log at the end records each decision. The field, the ledger, the eight tokens and the two type families stay. What changes is everything around the match: how you arrive, meet someone, sit down, play, finish and look back.

**Tags.** A feature that needs server work carries **[must-have]** (it ships in the first build) or **[phase 2]** (it follows). §7.9 lists all the server work once, as S1–S20. Untagged items are client-only and ship with the first build. Where a phase 2 feature is missing, the screen spec says what renders instead.

**Fixtures.** Birna is the viewer (`--you`) and Kári her opponent (`--opp`). §5.0 defines three fixture sets, and every artboard names the set it uses. Scores follow the rules: letter values from the language pack, a length bonus of (n − 2) × 5, +2 for a two-word combo, and −5 for a miss (never taking a total below 0). Every total is the sum of its rows.

---

## 1. Verdict

Ranked by how much damage each does to trust and play. Claims marked *verified* are ones I re-read in the code myself.

1. **A player who has left can be put into a rated match and lose it.**
   - Only `cancel ▸` takes a player out of the queue. Back, closing the tab, the rules link and the language link all leave them queued.
   - The next search picks the *oldest* waiting player.
   - The clock starts after a 10s grace whether or not both players have loaded.
   - Evidence: `lib/room/useMatchmaking.ts:61-64` (unmount stops the poll but never cancels); `lib/matchmaking/inviteService.ts:561-568` (`order("last_seen_at", { ascending: true })`, no freshness filter, verified); `lib/match/stateLoader.ts:40-42` (`START_GRACE_MS = 10_000`, verified).
2. **Anyone can become anyone.** Signing in is an upsert on the lowercased name with no secret (`lib/matchmaking/profile.ts:83`, verified). The session cookie is unsigned base64 JSON (`profile.ts:294-300`, verified). A stranger who types `birna` gets Birna's rating, history and incoming challenges. Every social feature a lobby needs (profiles, records, block, report) assumes an identity the door does not provide.
3. **One player can be booked into two rated matches at once.**
   - Sending a challenge checks only the recipient. Accepting never re-checks the sender. Accepting a rematch checks neither player.
   - Evidence: `inviteService.ts:142-163`, `:182`, `:199-275`; `app/actions/match/respondToRematch.ts`; `LobbyRoomController.tsx:110-111,179-185` (a second challenge silently replaces the first).
4. **The main social act is the least visible thing in the product.**
   - An incoming challenge is an 11px line at the bottom of the lobby ledger. It exists only on the lobby page and makes no sound.
   - Nothing in the codebase sets `document.title` (grep, verified).
   - On a phone the line is below the fold.
   - Evidence: `Ledger.tsx:336-347`, `useLobbyInvites` mounted only at `LobbyRoomController.tsx:165`, `lobby-visual-390x844-darwin.png`.
5. **Nobody says "I'm ready", there are three different ways into a match, and the board leaks early.**
   - A 3s poll pulls the challenger into a match whose clock is already set.
   - A challenge or rematch drops you onto a bare board. Only the queue gets a "found" moment, and even there the screen still reads `searching · 0:07 · cancel ▸` under `starts in 3`.
   - The board is served while the match is still pending (`stateLoader.ts:335` `board ?? boardFor(match)`, verified).
   - `playMatchStart` (`useSoundEffects.ts:142`) is never called (verified).
   - Evidence: `LobbyRoomController.tsx:156-165,189`, `MatchRoomController.tsx:113`, `QueueRoomController.tsx:167` (hint = `searchingSubline` in every phase, verified), `found-visual-1440x900-darwin.png`.
6. **The entry is an empty ruled square, and the lobby looks like a match with the opponent missing.**
   - A signed-out visitor sees a blank 708px grid under a 420px form.
   - A signed-in player sees `Enginn andstæðingur enn` over a practice board that scores nothing, and the hint `VELDU ANNAN STAF` before anything is picked.
   - The favicon is a neon glass "W" (`app/icon.png`).
   - Evidence: `landing-slip-visual-1440x900-darwin.png`, `is-lobby-visual-1440x900-darwin.png`, `LobbyRoomView.tsx:58-81`, `LobbyRoomController.tsx:211`.
7. **On a phone, the ways out are hidden.**
   - Notices, `⋯` (and so resign), `result ▸` and `lobby` exist only inside the history sheet, which is closed by default.
   - The result slip covers both bars.
   - Evidence: `Ledger.tsx:310-333`, `over-slip-visual-390x844-darwin.png`, `final-visual-390x844-darwin.png`.
8. **Three different controls resign a rated match.**
   - Resign is the filled, focused default, so two presses of Enter forfeit a rated match.
   - `leave` is a second resign.
   - Sign out can resign too.
   - Evidence: `Slip.tsx:78` (`YES_RESIGN` is the `Primary`, verified), `lib/a11y/useFocusTrap.ts:57-63` (focus goes to the first focusable, verified), `RoomMenu.tsx:37-38`, `MatchRoomController.tsx:414`, `app/actions/auth/logout.ts:51-57` (`resignActiveMatch`, verified).
9. **There is no review, and a rematch request vanishes during one.**
   - `review the match ▸` only lifts the slip.
   - An incoming rematch rewrites a slip the player has hidden.
   - Old matches reopen and offer a rematch to someone who has gone.
   - Evidence: `MatchRoomController.tsx:389`, `roomStore.ts:190`, `useMatchOverSlip.ts:103-115`, `app/actions/match/requestRematch.ts`.
10. **Every transition replaces history, so Back leaves the site and deep links lose their target.** Evidence: `LobbyRoomController.tsx:96,161,169,189`, `QueueRoomController.tsx:121,143`, `MatchRoomController.tsx:113,395,400`, `app/[locale]/(room)/match/[matchId]/page.tsx:26-28` (redirects to `/` with no return path).
11. **The copy contradicts itself in both languages.**
    - `▸` appears on text that does nothing, and `cancel` is drawn four times on the queue screen (`queue-visual-1440x900-darwin.png`).
    - The lobby tells players `No runs yet. Start one from the lobby.` (`en.ts:145`).
    - Icelandic templates put names in the wrong case: `bíður eftir Kári` (`is.ts:98`, should be dative *Kára*).
    - The Icelandic lobby shows raw `WIN`/`LOSS` (`LobbyLedger.tsx:80`).
    - Design system §8 still teaches terms the owner has replaced (`andstæðing`, `aftur ▸`, `svona er spilað`).

---

## 2. Principles

1. **A page where there is no field; a state of the field where there is.** The door or lobby (`/`), Profile and Rules are pages. Table → Starting → Match → Result → Review are one continuous field at `/match/:id`, changing in place. Review is `?review=n` on the same page, so nothing remounts. The field first appears when you sit down, which makes "a game is starting" readable at a glance. *(Changed: "One room" becomes "One field".)*
2. **One primary per screen, and never on a wait or a destructive act.**
   - The primary is the screen's most time-sensitive decision.
   - A **wait** (searching, a sent challenge or link, a sent rematch, sitting at the table) has **no primary**. Its exit is a secondary, drawn away from the button that started the wait, and never focused.
   - A destructive action is never primary.
   - A slip the **game** raises focuses its headline. A slip **you** open focuses its safe action.
   - `▸` marks an action that moves you forward, commits you or opens something. A bare word dismisses, leaves or says something.
   - Each action appears once per screen.
   - Any control that appears, or changes meaning, under the pointer ignores activation for 500ms.
3. **A match always begins the same way, and nobody is rated for a match they did not sit down at.**
   - All six routes lead to the **table**: queue, challenge, crossed challenges, rematch, crossed rematches and invite link.
   - You are **seated** in either of two cases. Your own press created the match. Or your tab is visible and you gave input in the last 30s.
   - Anyone else presses `ready ▸`. Once both are seated, the server's single 3·2·1 runs in the ledger clock.
   - A table nobody completes is **void**: not a match and not rated.
4. **A challenge is a conversation that follows the player.**
   - One **line slot** on every signed-in page carries your standing states: incoming and outgoing challenges, your search, your link, and your running or finished match. On desktop it sits under the masthead, sticky, with its height reserved. On a phone it is pinned to the bottom.
   - Each state gets a sound, the tab title, the favicon, a visible countdown and a way out.
   - Every outcome is written where it started.
5. **One commitment at a time, enforced in one place.**
   - A player has at most one of each: one outgoing challenge (an invite link counts as one), one search, one table, one match, one rematch request.
   - Every match is created by one database function that locks both players and refuses unless both are free.
   - Crossed challenges and crossed rematch requests start a match at once.
6. **Every fact keeps its home.**
   - Letters live on the field, players in bars, the match in the ledger. On pages, your standing states live in the line slot.
   - Pages borrow the same grammar: your block is a bar, and lists are ledger tables.
   - Only the slip covers the field. On pages nothing covers content except the sticky masthead.
7. **Same language, larger scale.** Eight tokens and two families. What is added is a display tier of type and a brand made from the game's own cells, not a new style.
8. **Two languages, one game.**
   - Each player has one **lobby language**: the lobby they last entered, not the page they are reading. Presence, the queue, challenges and ratings belong to that language.
   - Wherever data is per language, the language is stated.
   - The language switch appears only on pages. The field's language is fixed.
   - Icelandic is laid out first. In Icelandic templates a name only ever appears in the nominative, and a player is never described with a gendered word.

---

## 3. Screen map

**How the points where the audits and reviews disagreed were settled:**

| Question | Decision | Why |
|---|---|---|
| Searching: a room state with placeholder letters, or a lobby state? | **A lobby state, written in the line slot.** No field and no placeholder letters. | The players table stays live, so you can still challenge while searching. Cancel appears once. The field then means "you are sitting down". |
| Door and lobby: two URLs or one? | **One URL, `/` (and `/en`).** Signed out it renders the door; signed in, the lobby. `/lobby` and `/matchmaking` redirect (308) there. | The owner said "a landing screen which is the lobby". One bookmark works for everyone. |
| hall/salur or lobby/lobbí? | **lobby / lobbí.** | It is the owner's word in both languages (`is.ts` `LOBBY: "lobbí"`). |
| Who is seated at the table? | **A player whose own press created the match, or whose tab is visible with input in the last 30s.** Everyone else presses `ready ▸` within 20s, or the table is void. | A visible tab is not a person. Input is the cheapest honest proof, and attentive players get no extra step. |
| Countdown: in a slip or in the clock block? | **Both, in sequence.** The ready slip states who, what and the stakes. When both are seated it lifts, and 3·2·1 is drawn at 56px in the clock block. `started_at` = the moment the table completes + 4.5s. | Each fact stays in its home, and the timing leaves room for the slip to lift before `3`. |
| Lockup colours: seat colours or tint and muted? | **Seat colours.** | The lockup is a piece of field with two crossing words. The visitor's language is "you", and the shared letter belongs to the player who froze it first (spec 049). §8.6 records it as a page use of seat colour. |
| Reactions? | **At the table and after the match only. None while the clock runs.** [phase 2 · S16] | A courtesy must not hide a match fact or sit 8px from the field on a phone. |
| A challenge arriving over a field? | **Impossible at the table or in a live match** (you show as `in a match`). In Result or Review it is a ledger line with a secondary `accept ▸`. | Fewer slip kinds, and nothing interrupts play. |
| A rematch arriving while the slip is lifted, or in review? | **The ledger's first line. The slip is never raised again.** | A slip that raises itself under a keyboard player's Space key accepts a rated match. |
| Rematch in Icelandic: `aftur ▸` or `annan leik? ▸`? | **`annan leik? ▸`**, the owner's choice, flagged in §10 Q2 (*leikur* is our word for a move). | Owner's native choice. It is the one question-form action. |
| Timings | Challenge **60s**. Rematch **30s**, offered within **2:00** of the end. Table **20s** (a link table waits for its sender until the link expires). | A player on another page needs time to notice. Rematch players are already looking at the result. |
| Presence states? | **Four in lists: here, searching, in a match, away.** A gone player is dropped. `stepped out` appears only in a match bar. | Each word explains a button. |
| Language model? | **One lobby language per player.** Challenges are within one lobby. Cross-language challenges are [phase 2 · S19]. | This is what the server enforces today (`inviteService.ts:145-148`). A `· in English` suffix would be a promise the server cannot keep. |
| Invite link: now or later? | **Now.** [must-have · S11] | It is the only way to fill an empty Icelandic beta lobby. The scope is one table and two routes. |
| Identity? | **This browser claims your name.** [must-have · S1] | Ratings mean nothing if anyone can type your name. |
| Is end early destructive? | **No.** It is the conclusion the viewer is waiting for, decided by the normal rules. It stays primary, with focus on the headline. | It forfeits nothing of the viewer's. The headline focus and the 500ms guard handle the irreversibility. |
| Reveals under 0:15 skip the 600ms hold? | **Dropped.** | Rules §2 and §12 make the hold normative. It is symmetric between players, so there is nothing to fix. |
| The empty lobby | `invite a friend ▸` becomes the primary; a practice field is deferred (§10 Q8). | A practice field in the lobby would bring back the field-before-you-sit confusion. |

**Screens.** For Icelandic URLs, IS is the bare path and EN adds the `/en` prefix.

| ID | Name EN / IS | URL IS · EN | Purpose | Primary action | Exits |
|---|---|---|---|---|---|
| A1 | Door / Dyr (signed-out lobby) | `/` · `/en` | Brand, promise, social proof, one field to enter; returning state after sign-out | `enter the lobby ▸` / `inn í lobbíið ▸` | lobby (B1), rules (E3), other locale, `?next=` target |
| A2 | Door · invite | `/c/:token` · `/en/c/:token` (signed out) [must-have · S11] | Arrive from a friend's link | `accept ▸` / `samþykkja ▸` | table (C1), lobby, the link's own locale |
| B1 | Lobby / Lobbí | `/` · `/en` (signed in) | You, who is here, play | `find an opponent ▸` / `finna mótspilara ▸` (in an empty lobby, `invite a friend ▸`) | searching (B7), composer (B2), profile (E1/E2), review (D3), rules, other locale, sign out → A1 |
| B2 | Lobby · challenge composer | same, row open | State the terms and stakes before sending | `send challenge ▸` / `senda áskorun ▸` | sent (B3), B1 |
| B3 | Lobby · challenge sent | same; line slot | Wait with a countdown and a withdraw | none (a wait); exit `withdraw ▸` / `draga til baka ▸` in the line slot | table (C1) on accept, outcome (B4) |
| B4 | Lobby · challenge outcome | same | Declined, no answer, started another match, left, withdrawn, cooldown, error | the page's primary returns | B1 |
| B5 | Lobby · incoming challenge | same; line slot | Answer a challenge | `accept ▸` / `samþykkja ▸` | table (C1), B1 on decline or expiry |
| B6 | Incoming challenge elsewhere | line slot on `/profile*`, `/rules`; a ledger line in Result or Review | A challenge follows you | `accept ▸` (a secondary when it is a ledger line) | table (C1) |
| B7 | Lobby · searching | `/` (no URL change); line slot | Search while the lobby stays live | none (a wait); exit `cancel ▸` / `hætta við ▸` in the line slot | table (C1) on pairing, B1 |
| B8 | Lobby · your match is running or over | `/`; line slot | Return to a match you stepped out of, or see that it ended | `back to the match ▸` / `aftur í viðureignina ▸`, or `result ▸` / `úrslit ▸` | match (C4), result (D1) |
| B9 | Lobby · invite link out | `/`; line slot [must-have · S11] | Bring a friend | none (a wait); `copy again ▸`, `cancel link ▸` | table (C1) when the link is opened |
| C1 | Table / Mótspilari fundinn | `/match/:id` · `/en/match/:id` (pending) [must-have · S3] | Who, what, stakes; both sit down | `ready ▸` / `ég er til ▸` when not seated; none when seated (a wait, exit `leave`) | starting (C2), void (C3), lobby |
| C2 | Starting / Hefst | `/match/:id` | Server 3·2·1 in the clock, letters land | none (a count) | match (C4) |
| C3 | Table · void / Engin viðureign | `/match/:id` [must-have · S3] | Someone did not sit down, or left; nothing rated | set by origin (§5 C3) | B7, B2, D1 of the previous match, B1 |
| C4 | Match / Viðureign | `/match/:id` (in progress) | The duel: today's beats plus the changes in §5 | the field (pick a letter) | C6, C7, C8, D1 |
| C5 | Reactions | at the table and on the result [phase 2 · S16] | Presets | contextual secondary only | — |
| C6 | Resign slip / Gefast upp? | same | Confirm forfeit | `keep playing ▸` / `halda áfram ▸` (focused) | C4, D1 |
| C7 | Leave slip / Fara úr viðureigninni? | same (Back, or `⋯ go to the lobby`) | Step out without resigning | `stay ▸` / `vera áfram ▸` (focused) | C4, B8 |
| C8 | Disconnect and end early | same | Opponent gone; your own connection lost | `end the match ▸` / `ljúka viðureigninni ▸` (only at 10 of 10 after the window) | D1 |
| D1 | Result / Viðureign lokið | `/match/:id` (completed) | Verdict, why it ended, ratings, next step | `rematch ▸` / `annan leik? ▸` while offered, else `new opponent ▸` / `nýr mótspilari ▸` | D2, D3, B7, B1 |
| D2 | Rematch negotiation | same, on the slip or as a ledger line [must-have · S8] | Sent, incoming, declined, expired, opponent left | incoming: `accept ▸`; sent: none (a wait) | C1 of the new match, D1 |
| D3 | Review / Yfirferð | `/match/:id?review=n` · `/en/match/:id?review=n` [must-have · S9] | Step through every move in receipt order | `rematch ▸` while offered, else `challenge again ▸` if they are here, else `new opponent ▸` | D1, B1 |
| E1 | Profile (own) / Prófíll | `/profile` · `/en/profile` | Your record, best words, history | `find an opponent ▸` | review, lobby, other-language profile, sign out |
| E2 | Profile (public) | `/profile/:handle` · `/en/profile/:handle` (handle percent-encoded, e.g. `/profile/k%C3%A1ri`) | Decide to play someone | `challenge ▸` / `skora á ▸` when they are here in this lobby | composer (in place), review |
| E3 | Rules / Leiðbeiningar | `/rules` · `/en/rules` | Teach | signed in and free: `find an opponent ▸`; opened from a match: `close this tab ▸`; signed out: `enter the lobby ▸` | B7, C4, A1 |
| F1 | Phone door | `/` · `/en` at 390 | A1 on a phone | `inn í lobbíið ▸` (inline under the name) | as A1 |
| F2 | Phone lobby | `/` at 390 | B1, B5, B7 on a phone | pinned `finna mótspilara ▸`, or `samþykkja ▸` in the pinned call line | as B1 |
| F3 | Phone match | `/match/:id` at 390 | C4 on a phone | the field | as C4 |
| F4 | Phone result | `/match/:id` at 390 | D1 and D2 on a phone | `annan leik? ▸` | as D1 |
| F5 | Phone table | `/match/:id` at 390 (pending) | C1 and C2 on a phone | `ég er til ▸` | as C1 |
| F6 | Phone composer and sent | `/` at 390 | B2 and B3 on a phone | `senda áskorun ▸` | as B2/B3 |
| F7 | Phone review | `/match/:id?review=n` at 390 | D3 on a phone | none; `◂ úrslit` leads to the result's primary | D1 |
| F8 | Phone slips | `/match/:id` at 390 | C6, C7, C8 on a phone | as each slip | as each slip |
| F9 | Phone profile | `/profile*` at 390 | E1 and E2 on a phone | pinned `finna mótspilara ▸` / `skora á ▸` | as E1/E2 |

Redirects: `/lobby` and `/matchmaking` → 308 `/`. `/match/:id/summary` → 308 `/match/:id?review=last`. `/is/*` → bare path (unchanged).

---

## 4. Flow graph

**History markers:** *push* (P), *replace* (R), *pop* (B). A move within one match never adds history, except entering review.

**Motion tokens.** Under `prefers-reduced-motion`, every token is 0ms and shows only its end state. **Time is exempt:** drain bars, the 3·2·1 count and the clock are time, not motion. Under reduced motion they step once a second with no easing, exactly like the existing move-hold exemption.

- **M1 page turn:** content cross-fades over 150ms. The masthead, line slot and folio are shared View Transition elements and do not move.
- **M2 field enters:** page content fades out over 150ms. The bars write their names (200ms, the existing name write). The empty ruled field frame appears. The slip fades in over 150ms with the field at 32%.
- **M3 slip:** a 150ms fade, with the field fading to or from 32%.
- **M4 letters land:** row by row, 60ms between rows and 12ms between cells, each using `letter-land` 120ms. About 720ms in total.
- **M5 count:** the clock block steps 3 → 2 → 1 at 1Hz from `started_at`, then shows `5:00` and the bar starts to drain.
- **M6 state text:** text swaps with no motion. Drain bars run linearly to zero.
- **M7 line slot:** the new content replaces the slot's content at once, in a slot whose height is reserved, so nothing below moves. The `challenge` cue plays, and the tab title and favicon change.
- **M8 reveal:** unchanged (exchange 150ms, band draw 400ms plus 120ms stagger, count-up 400ms, hold 600ms).
- **M9 review step:** forward uses the exchange (150ms) and draws the step's bands (400ms). Backward is instant.

| # | From | Trigger | To | Kind | Motion |
|---|---|---|---|---|---|
| T1 | A1 door | `enter the lobby ▸` with a valid, free name (or the returning name) | B1 lobby, or the validated `?next=` target | in place at `/` (R) | M1; your name writes into your block (200ms) |
| T2 | A1 | `how to play ▸` | E3 rules | nav (P) | M1 |
| T3 | A1 / B1 / E1 / E3 | the language switch | the same page in the other locale. From B1 while searching, or with a challenge or link out or incoming, the consequence line comes first (`switching cancels your search · switch ▸`). | nav (full load, P) | none |
| T4 | any guarded URL, no session | open | A1 with `?next=<path>` (validated, §7.5 inv. 12) | redirect | none |
| T5 | A2 invite | `accept ▸` with a free name | C1, seated | nav (R) | M2 |
| T6 | `/c/:token` with a session | open | B1 with the link's call in the line slot (`Hekla invites you by link · accept ▸`). The GET never creates a match. | redirect (R) | M7 |
| T7 | B1 | `find an opponent ▸` | B7; the search appears in the line slot | in place | the button leaves its slot; the slot's bottom edge becomes the `lane-search` sweep |
| T8 | B7 | `cancel ▸`; or you are gone (§7.1) | B1 (server cancels) | in place | M6 |
| T9 | B7, or any page while searching | server pairs you | C1 | nav (P) | M2; `challenge` cue, title and notification if the tab is hidden |
| T10 | B7 | 0:30 with nobody else searching | line 2 reads `no one else is searching · challenge someone below` | in place | M6 |
| T11 | B1 / B7 | `challenge ▸` on a row | B2 composer (row opens, focus to send) | in place | M6 |
| T12 | B2 | `send challenge ▸` | B3 (withdraws any earlier challenge or link; cancels your search). If they have a pending challenge to you, both go to C1 at once, both seated. | in place / nav (P) | M6 / M2 |
| T13 | B2 | `not now` or Esc | B1 | in place | none |
| T14 | B3 | `withdraw ▸` | B4 `withdrawn` for 4s, then B1 | in place | M6 |
| T15 | B3 | declined, expired, started another match, left | B4 for 4s, then cooldown or B1 | in place | M6 |
| T16 | B3, from any page (line slot) | accepted | C1 (seated by the input rule) | nav (P) | the slot and row read `accepted` for 400ms, then M2 |
| T17 | any page, not at a table or in a match | incoming challenge | the line slot carries it (B5 / B6) | in place | M7 |
| T18 | B5 / B6 | `accept ▸` (after the 500ms guard) | C1, seated. Your search, outgoing challenge, link and rematch request are withdrawn. | nav (P) | M2 |
| T19 | B5 / B6 | `decline`, or 60s pass | the slot returns to its previous content | in place | none |
| T20 | B1 | `invite a friend ▸` | B9 (link created and copied; the slot shows it) | in place | M6 |
| T21 | B1 | masthead name or a row name | E1 / E2 | nav (P) | M1 |
| T22 | B1 / E1 / E2 | `review ▸`, or the band map | D3 at the last step (`/match/:id?review=last`) | nav (P) | M1, then the field without a slip |
| T23 | B8 | `back to the match ▸` | C4; the guard entry is replaced, never stacked | nav (P) | M2 without a slip |
| T24 | B1 | `⋯ sign out` | A1 in its returning state. Disabled during a live match; with a search or challenge out, a consequence line comes first. | nav (R) | M1 |
| T25 | C1 | `ready ▸` | C1 with you seated | in place | the seat line changes to `ready` |
| T26 | C1 | both seated | C2; the slip lifts at `started_at − 3.3s` | in place | M3 out, M5; M4 during `3` |
| T27 | C2 | the count reaches 0 (server `started_at`) | C4 `move 1 · your move`; focus to the field | in place | the clock drains, 3px turn frame, `match-start` sound |
| T28 | C1 / C2 (before go) | `leave`, or Back | B1; void, `left`, recorded against you | nav (B) | M1 |
| T29 | C1 | table deadline without both seated | C3 void (the slip rewrites) | in place | M6 |
| T30 | C3 | the action set by the table's origin (§5 C3) | B7 (automatic for queue tables), B2, D1 of the previous match, B1 | nav (R) | M1 |
| T31 | C4 | beats (§5 C4) | C4 | in place | M8 |
| T32 | C4 | `⋯ resign` | C6 | in place | M3 |
| T33 | C6 | `keep playing ▸` or Esc / `yes, resign ▸` | C4 / D1 | in place | M3 |
| T34 | C4 | Back (guard entry pushed on your first pick), or `⋯ go to the lobby` | C7 | in place | M3 |
| T35 | C7 | `stay ▸` or Esc / `go to the lobby` | C4 / B8 (the match continues; you show as `stepped out`) | in place / nav (P) | M3 / M1 |
| T36 | C4 | opponent gone past the 90s window, you at 10 of 10 | C8 end-early slip, raised once | in place | M3 |
| T37 | C8 | `keep waiting ▸` / `end the match ▸` | C4 with the offer on live row line 2 / D1 | in place | M3 |
| T38 | C4 | both at 10, 0:00 settle, resign, or end early | D1; the slip lands 600ms after the final settle, focus on its headline | in place | M8, then M3 |
| T39 | D1 | `rematch ▸` | D2 sent (`0:24`, drain) | in place | M6 |
| T40 | D2 | accepted, or crossed requests | C1 of the new match. The accepter and crossing requesters are seated; the original requester by the input rule. | nav (R `/match/:new`) | old letters leave, the slip rewrites to the table (M2); letters land at `3` (M4) |
| T41 | D1 lifted / D3 | incoming rematch | the ledger's first line, with `accept ▸` as a secondary. The slip is never raised again. | in place | M7 (cue, title, favicon); polite announcement |
| T42 | D1 / D3 | `new opponent ▸` | B7. Cancels your pending rematch request and answers an incoming one `started another match`. | nav (P) | M1 |
| T43 | D1 | `review the match ▸` | D3 at the last step (push `?review=20`) | nav (P) | M3 out |
| T44 | D1 | `lobby` | B1 (cancels your pending request) | nav (P) | M1 |
| T45 | D1 | Esc / `result ▸` in the foot | D1 lifted (final ledger) / D1 | in place | M3 |
| T46 | D3 | step controls, the scrubber's keys, a row cell, a chart tap | D3 at step n | in place (R `?review=n`) | M9 |
| T47 | D3 | `◂ result`, or Back | D1 | nav (B) | M3 in |
| T48 | E2 | `challenge ▸` | composer in column B, then the sent state in the primary slot and the line slot | in place | M6 |
| T49 | E1 | `change name ▸` [phase 2 · S15] | inline input, then save | in place | none |
| T50 | E2 | `block` [phase 2 · S15] | a confirmation line, then `blocked · unblock ▸` | in place | none |
| T51 | E3 | `find an opponent ▸` | B7 | nav (P) | M1 |
| T52 | E3 opened from a match (new tab) | `close this tab ▸` | `window.close()`; if refused, navigates to C4 | nav | none |
| T53 | `/match/:id` live, non-participant | open | B1 + notice `Kári and Embla are playing · 3:12 left` | redirect (R) | none |
| T54 | `/match/:id` completed, non-participant or signed out | open | D3 read-only | redirect (R) | none |
| T55 | `/match/:id` or `/c/:token` in the other locale | open | its own locale | redirect | none |
| T56 | F3 | tap the live row / `close` or Esc | the sheet replaces the ledger block between your bar and the foot / back | in place | none |
| T57 | A1 returning | `enter the lobby ▸` / `use another name` | B1 with no typing / A1 with an empty name field | in place (R) | M1 / none |
| T58 | any page | the session expired but the device key is valid | the same page, silently renewed (no door) [must-have · S1] | none | none |
| T59 | B7 | 3:00 of searching | the slot reads `still searching? · keep searching ▸` (30s drain). No answer → `search stopped · find again ▸`. | in place | M6 |
| T60 | B7 on a phone | the tab goes hidden | search paused; on return, `search paused · resume ▸` | in place | none |
| T61 | C3 (you did not sit down) | void | you become `away` and your search is cancelled. On return, the lobby line reads `you did not sit down · your search stopped`. | in place | none |
| T62 | B8 | your match ends while you are away from it | the slot reads `your match is over · Kári wins 88–46 · result ▸` until opened or the session ends | in place | M7 |
| T63 | B9 | a friend opens your link and presses `accept ▸` | C1. You are seated by the input rule, and the table waits for you until the link expires. | nav (P) | M2; cue and title if hidden |
| T64 | `/c/:token`, opened by its own sender | open | B1 with `this is your link · copy ▸` in the slot | redirect (R) | none |
| T65 | D1 / D3 | third-party challenge | the ledger's first line with a secondary `accept ▸`, below an incoming rematch if both exist | in place | M7 |
| T66 | D3 | `accept ▸` on a rematch ledger line | C1 of the new match | nav (R) | M2 |

**History policy:**
- **Back from the table or during the count** leaves it. The match is void, and the leave is recorded against you.
- **Back in a live match** opens C7 and never resigns.
  - The guard entry is pushed on your first pick, which counts as user activation, so browsers keep it.
  - Without a guard, Back lands on B8 and the match keeps running.
  - Returning to a live match replaces its guard entry rather than stacking another.
- **Once a match completes,** the guard is disarmed and never shows again.
  - The controller records each entry's kind in `history.state` (`guard` | `result` | `review`) and skips a `guard` entry after completion.
  - One press of Back from the result reaches the lobby. One press from review reaches the result.
  - `beforeunload` is armed only while the match is live.
- **Every redirect to the door** carries a validated `?next=`.

---

## 5. Screen specs

### 5.0 Shared frames, fixtures and guards

**Desktop page frame (1440×900).**
- **Grid.** Content spans x=168–1272 (1104px). Column A is x=168–876 (708). The gutter is 876–932 (56). Column B is x=932–1272 (340). This is the room's own grid.
- **Landmarks.** The masthead and line slot are `banner`. The content is `main`. The folio is `contentinfo`. Each page has exactly one `h1`: the headline on the door, the player's name on the lobby and profiles.
- **Masthead.** A 1.5px `--ink` rule runs at y=24 across 1104px. The masthead line runs y=28–60 (32px tall; every target is at least 24×24, with 8px between targets).
  - Left: the door shows a mono 11 context line. Other pages show the **strip** logotype (22px cells, y=33–55, links to `/`, `aria-current="page"` on `/`).
  - Right, in order: `how to play ▸` · language switch · `■ Birna ▸` (12px `--you` square and name, links to your profile) · `⋯` (32×32).
- **Line slot** (signed-in pages only). Always reserved at y=64–128 (64px). Masthead and slot are sticky together (y=0–128, `--paper` ground, 1px `--rule` at y=128), so nothing below ever moves.
  - It shows **one** standing state, by precedence:
    1. incoming challenge
    2. your match is running, or is over while you were away
    3. your outgoing challenge
    4. your invite link
    5. your search
    6. empty
  - If a second incoming challenge arrives, line 2 of the first ends with `· +1`. The second takes the slot when the first is answered or expires.
  - **Call style** (addressed to you): `--tint` ground. A 3px `--ink` left rule at x=168. A 12px `--opp` square at x=188, y=76. Line 1, Zilla 600 17, at x=208, y=70–90. Line 2, mono 11 `--muted`, y=96–110. Actions are right-aligned, 44px tall (y=74–118). A 4px drain bar runs at y=124–128 (`--ink` over a `--rule` track).
  - **Status style** (your own standing state): `--paper` ground, a 12px `--you` square, the same two lines, a secondary action on the right, and a 4px drain or sweep on the bottom edge.
  - **Empty:** mono 11 `--muted` at y=92. Left: the place, `LOBBÍ · ÍSLENSKA · 5 HÉR · 1 AÐ SPILA` (the counts are omitted on the lobby itself, which lists them). Right: the terms, `ALLAR VIÐUREIGNIR GILDA TIL ELO · 10 LEIKIR HVOR · EIN 5:00 KLUKKA (?)` / `EVERY MATCH RATED · 10 MOVES EACH · ONE 5:00 CLOCK`.
  - The door (signed out) has no slot.
- **Content** starts at y=152 (y=88 on the door).
- **Folio:** a 1px `--rule` at y=856, then mono 11 `--muted` text at y=868 naming the place only: `ORÐUSTA · LOBBÍ` / `WOTTLE · LOBBY`. There is no colophon and no ©.
- **Scrolling.** Pages may scroll. Field states never scroll.
- **Sizing.** Every fixed slot is sized from its longest string in either language plus 16px, and a test fails on overflow (§8.15).

**Desktop room frame (field states), unchanged.**
- Column A: top bar y=24–84, field y=96–804 (708²), bottom bar y=816–876.
- Column B: the ledger from y=24 to y=876.
- The ledger caption keeps the **text wordmark** (`orðusta` / `wottle`). The strip is used on pages only, because in the caption it would read as a scored word.

**Phone page frame (390×844 reference; anchored to edges, not to y).**
- 16px gutters, 358px content.
- **Masthead:** a 44px line at y=8–52, where every target is 44×44, then a 1.5px `--ink` rule at y=56.
  - Left: the strip at 18px cells (126×18), or the door's context line.
  - Right: `■ BIRNA` (44px-tall target) and `⋯` (44×44). On the door, the language item.
- Content from y=72.
- **Bottom slot:** `position: fixed; bottom: 0` with `padding-bottom: env(safe-area-inset-bottom)`, following the same precedence as the desktop line slot, then the page primary.
  - Call line: 104px.
  - Status (search, sent, link, match): 64px.
  - Page primary: a 56px `--ink`-filled button with 8px margins.
  - The page carries bottom padding equal to the slot's height plus the safe area, so the last row is never hidden under it.
- **Reference positions.** The reference artboards draw the slot at y=772–828 (primary) or y=724–828 (call line) at 844. Implementation anchors to the bottom edge. Fixtures also run at 390×664 and 360×640.

**Phone room frame (compresses; nothing scrolls, nothing but the slip covers the field).**
- **Reference at 390×844:**
  - top bar y=16–72 (56px including the lane)
  - field y=80–438 (358²)
  - bottom bar y=446–502
  - the ledger block from y=514: a 1.5px `--ink` rule, then the clock block y=522–578, the live row y=586–650 and the territory y=662–676
  - the **foot pinned to the bottom edge**: 44px plus the safe area, holding `⋯` (44×44) and the state's actions
- **As the viewport height shrinks** (Safari toolbars, small phones):
  1. Territory hides.
  2. The clock block becomes a 32px strip: label left, `3:12` in mono 17 right, 4px bar beneath.
  3. Live row line 2 folds into the sheet, and the row becomes one 44px line.
  4. The field is `min(358, 100vw − 32)` square (328² at 360 wide).
- **Worked example at 390×664:** bars and field end at 502, the ledger block starts at 514, and a strip (32) plus the live row (64) fit above the foot at 620–664.
- **Sheet:** replaces the ledger block between your bar and the foot, with the clock pinned as a 32px strip at its top. It never covers the foot and never rises above your bar.
- **Phone slip:** exactly the field's square (x=16–374, y=80–438, 20px padding, 318×318 inside). It never covers the bars.

**Page primary:** 48px tall (44 inside rows and on phones), mono 12 / 0.12em uppercase, 18px side padding, `--ink` fill with `--paper` text, then ` ▸`. Interaction states as in design system §5.5.

**Row tables:** 56px rows when a row carries an action, 44px otherwise, divided by 1px `--rule`. The first column is Zilla 600. Numerals are mono with tabular figures. The order **freezes** while the pointer is over the table, while focus is inside it, or while a composer is open. New arrivals are added at the end, and the table re-sorts at the next idle moment.

**Guards** (all screens):
- Any slip button, line-slot button, or control that has just appeared or changed meaning ignores activation for **500ms**.
- Game-raised slips focus their headline (`tabindex="-1"`). This needs a change to `useFocusTrap`: honour `initialFocusRef` even when that element has `tabIndex -1`.
- Terms, the lede and every count of moves or clock come from `moveLimit` and `MATCH_CLOCK_MS` / `clockLengthOf`, never from literals.

**Fixture sets.**
- **IS-T0**: the Icelandic match *before* it is played.
  - Birna 1204 (Icelandic), Kári 1187, 34 matches, record 19–15–0.
  - Head-to-head 2–1, last `win 166–159`.
- **IS-M**: Match I, Birna vs Kári in Icelandic, played to `Birna vann 134–88` in 4:52 (both played ten).
  - Moves in receipt order, with the score after each:

    | Step | Player | Move | Result | Score |
    |---|---|---|---|---|
    | 1 | Birna | m1 | BORÐ +23 | 23–0 |
    | 2 | Kári | m1 | GILT +18 | 23–18 |
    | 3 | Kári | m2 | no word −5 | 23–13 |
    | 4 | Birna | m2 | no word −5 | 18–13 |
    | 5 | Kári | m3 | TAK +10 | 18–23 |
    | 6 | Kári | m4 | no word −5 | 18–18 |
    | 7 | Birna | m3 | LEK · ÆSKU +33 (12 + 19 + 2) | 51–18 |
    | 8 | Kári | m5 | SKÓ +11 | 51–29 |
    | 9 | Kári | m6 | no word −5 | 51–24 |

  - The match continues to 134–88: 10 words to 8, territory 27–21. Birna's best word in this match is BORÐA 29.
  - Ratings: 1204 → 1212 (+8), 1187 → 1179 (−8).
- **IS-T1**: the next day.
  - Birna 1212, 35 matches, 20–15–0. Kári 1179. Head-to-head 3–1, last `win 134–88`.
  - Last ten, oldest first: W W L W L W W L W W (7 won, 3 lost).
  - Recent: Kári 134–88 win, Embla 184–150 win, Jónas 132–171 loss, Kári 166–159 win.
  - Best words: HESTAR 32, BORÐA 29, SKÍRN 24.
- **EN-L**: the English lobby.
  - Birna 1310 (English).
  - Rows: Embla 1342, Kári 1265, Hekla 1250, Sóley 1418, Ragnar 1196 (searching), Jónas 1263 (in a match).
  - Head-to-head with Kári 2–1, last `win 128–117`.
- **EN-M**: Match E, Birna 1310 vs Kári 1265 in English. Stakes for Birna: `win +7 · draw −1 · loss −9`.
  - Birna: m1 STONE 20, m2 −5, m3 WHARF 29, m4 −5, m5 MOTH 19, m6 −5, m7 PLAN 16 = 69.
  - Kári: m1 CRAB 18, m2 −5, m3 LIME 16, m4 −5, m5 DUST 15, m6 −5, m7 −5, m8 FERN 17, m9 −5 = 41.

---

### A1 · Door (signed out), 1440×900 (artboards DoorIs, DoorEn, DoorReturning)

**Masthead (y=28–60).**
- **Left**, mono 11 `--muted`: `4 HÉR NÚNA · 2 VIÐUREIGNIR Í GANGI` / `4 HERE NOW · 2 MATCHES ON`, counted for this locale's lobby [must-have · S10]. Hidden when nobody is here. Not interactive.
- **Right:** the language switch, `ÍSLENSKA · ENGLISH ▸`.
  - The current language is `--ink` 600 with `aria-current="true"`, no underline and no `▸`.
  - The other is `--muted` with ` ▸` and its own `lang` attribute.
  - It is the first element in tab order.
  - There is no `how to play` in the masthead on the door: it appears once, in column B.
- **When the browser prefers the other language,** the switch leaves the masthead and becomes one line at y=64–84, written in that language: `Prefer English? · English ▸` / `Viltu frekar íslensku? · íslenska ▸`. It never redirects. There is still only one switch on the page.

**Column A.**
- **Lockup** at y=96, x=168. A pure image with no link (geometry in §6).
  - IS: 72px cells, 504×432, y=96–528.
  - EN: 64px cells, 384×448, y=96–544.
- **Kicker**, mono 11 `--muted`, 32px below the lockup (IS y=560, EN y=576): `ORÐ + ORUSTA · ORÐAEINVÍGI FYRIR TVO` / `WORD + BATTLE · A WORD DUEL FOR TWO`.
- **Headline** (`h1`), 12px below the kicker: Zilla 600 56/1.02, −0.01em, `--ink`, with a forced break after the second clause. IS y=584–700; EN y=600–716.
  - IS: `Tveir leikmenn, eitt borð,` / `tíu leikir hvor.`
  - EN: `Two players, one field,` / `ten moves each.`
  - The number word comes from `moveLimit`, through a small number-word table per language, with digits as the fallback.
- **Lede**, 16px below the headline: Zilla 500 17/1.5, `--ink`, max-width 520. Built from the clock and move constants.
  - EN: `Swap two letters to make words. Every word you score freezes in your colour. Most points in five minutes wins.`
  - IS: `Skiptu á tveimur stöfum og myndaðu orð. Orð sem gefa stig frjósa í þínum lit. Flest stig á fimm mínútum vinnur. (?)`

**Column B (empty state).**
- y=96, mono 11 `--muted` visible label: `NAFN` / `YOUR NAME`.
- y=116–164, the input: Zilla 600 28, a 1.5px `--ink` underline at y=164, placeholder `--muted` `nafn` / `your name`, full 340px. No autofocus.
  - `aria-describedby` points at the format rule and the error line.
  - `aria-invalid` is set on error.
  - Enter submits.
- y=172, the error line: mono 11 `--ink`, in a polite live region. It holds one of:
  - `3 til 24 stafir, tölur, - eða _` / `3 to 24 letters, digits, - or _` (this is also the format rule, shown in `--muted` until an error)
  - `þetta nafn er frátekið · veldu annað` / `that name is taken · pick another` [must-have · S1]
  - `of margar tilraunir · bíddu í mínútu` / `too many tries · wait a minute`
  - `innskráning tókst ekki · reyndu aftur` / `could not sign in · try again`
- y=192–240, primary `INN Í LOBBÍIÐ ▸` / `ENTER THE LOBBY ▸` (about 183px at its widest).
- y=252 and y=268, mono 11 `--muted`: `SKRÁNING ÓÞÖRF` / `NO ACCOUNT NEEDED`, then `ÞESSI VAFRI GEYMIR NAFNIÐ ÞITT` / `THIS BROWSER KEEPS YOUR NAME` [must-have · S1].
- **Here now.** y=296, a 1px rule. y=308, label `HÉR NÚNA · 4` / `HERE NOW · 4`. Four rows of 44px from y=328 to y=504.
  - Each row: name in Zilla 600 15 `--ink`; right-aligned, the rating in mono 12 `--muted`, then the status in mono 11 `--muted`.
  - Fixture (IS-T1): `Embla 1242 hér`, `Kári 1179 hér`, `Sóley 1318 hér`, `Ragnar 1096 leitar`. EN-L for DoorEn.
  - Rows are not links. Under them at y=512, mono 11 `--muted`: `farðu inn í lobbíið til að skora á einhvern (?)` / `enter the lobby to challenge someone`.
  - Empty state: Zilla 500 15, `Enginn hér enn.` / `No one here yet.`
  - Whether real names show to signed-out visitors is §10 Q3. The alternative is the count only.
- **How it plays.** y=560, a 1px rule. Label `LEIÐBEININGAR` / `HOW IT PLAYS`. Three numbered rows of 36px from y=592: numbers in mono 11 `--muted`, text in Zilla 600 15.
  - `Skiptu á tveimur stöfum.` / `Swap two letters.`
  - `Þrír stafir eða fleiri í beinni línu.` / `Three letters or more, in a line.`
  - `Stafir í orði frjósa í þínum lit.` / `Scored letters freeze in your colour.`
  - Then `leiðbeiningar ▸` / `how to play ▸` at y=712.

**Column B (returning state, after sign-out, when this browser's device key names a player)** (artboard DoorReturning, EN).
- y=96: `GAMAN AÐ SJÁ ÞIG AFTUR` / `WELCOME BACK`.
- y=116–164: `Birna` in Zilla 600 28 (not an input), with a 12px `--you` square.
- y=192–240: primary `INN Í LOBBÍIÐ ▸` / `ENTER THE LOBBY ▸`.
- y=252: secondary `ekki Birna? · annað nafn` / `not Birna? · use another name`, which shows the empty state.
- The rest of column B is the same as the empty state.

**Folio:** `ORÐUSTA` / `WOTTLE`.

**States.**
- **Submitting:** the primary shows its pressed `--tint` ground and ignores repeat presses.
- **A valid session or device key exists:** this screen is never shown; you get B1 (T58).
- **`?next=` present:** after entering, you land on the validated target.

**Accessibility.**
- The lockup is `role="img"`, labelled `Orðusta, wottle á ensku` / `wottle, Orðusta in Icelandic`.
- The headline is the `h1`.

**Tab title and alternates.** `orðusta · orðaeinvígi fyrir tvo` / `wottle · a word duel for two`. hreflang alternates between `/` and `/en`, with x-default `/`.

### A2 · Door · invite (artboard DoorInvite, EN) [must-have · S11]

A1 with these changes in column B:
- **Band.** At y=96–160, a call-style band: `--tint`, a 3px `--ink` left rule, and a 12px `--opp` square.
  - Line 1, Zilla 600 17: `Kári challenges you` / `Kári skorar á þig`.
  - Line 2, mono 11: `1265 · English words · link valid 9:12` / `1187 · íslensk orð · tengill gildir í 9:12`.
- The name label, input and error line move down 88px.
- **Primary** `ACCEPT ▸` / `SAMÞYKKJA ▸`, a POST. It signs you in with a free name, seats you and opens C1. The link's sender is seated by the input rule, and the table waits for them until the link expires.
- **Secondary** below: `enter the lobby instead` / `bara inn í lobbíið (?)`.
- **Expired, used or withdrawn:** the band reads `this link has expired` / `þessi tengill er útrunninn`, and the primary returns to `enter the lobby ▸`.
- **A link in the other locale** redirects to its own locale (T55). It never reads as expired.
- **The GET never creates anything,** so link unfurlers and prefetch are harmless.

### B1 · Lobby, 1440×900 (artboard Lobby, IS, fixture IS-T1)

**Masthead.**
- Left: the strip `ORÐUSTA` (22px cells, 154×22).
- Right, mono 11: `LEIÐBEININGAR ▸` · `ENGLISH · 7 HERE ▸` · `■ BIRNA ▸` · `⋯`.
  - The switch is written in the target language, with `lang="en"`, and carries that lobby's count [S10].
- The `⋯` menu holds:
  - `hljóð · á` / `sound · on`. On first open it adds `hljóð byrjar eftir fyrsta smell (?)` / `sound starts after your first click`.
  - `tilkynningar · af` / `notifications · off`.
  - `skrá út` / `sign out`. While a search or challenge is out, the consequence line `útskráning hættir leitinni` / `signing out cancels your search` comes first. During a live match it is disabled: `ljúktu fyrst viðureigninni` / `finish your match first`.

**Line slot:** empty (terms only).

**Column A, your block (y=152–212).**
- A 16px `--you` square at (168,168), beside `Birna` in Zilla 600 40 at x=196 (the `h1`).
- Sub-line, mono 11 `--muted`, y=204: `1212 · ELO · ÍSLENSKA · 35 VIÐUREIGNIR · 20–15–0` / `1310 · RATING · ENGLISH · …`.
- Right-aligned in column A (x=636–876, y=156–204): primary `FINNA MÓTSPILARA ▸` / `FIND AN OPPONENT ▸` (about 192px; the slot is 240).
- Beneath it, right-aligned mono 11 `--muted`, y=212: `2 LEITA NÚNA` / `2 SEARCHING NOW`, or `ENGINN LEITAR NÚNA` / `NOBODY SEARCHING NOW` [S10].

**Form strip (y=228–248).**
- Label `SÍÐUSTU TÍU` / `LAST TEN` in mono 11 `--muted` at x=168, then ten 20×20 cells at x=268–468, ruled 1px `--rule`, oldest on the left.
- Each cell holds one mono 11 letter:
  - win: `S` / `W` in `--ink` 600, with a 3px bottom bar in the page owner's seat colour
  - loss: `T` / `L` in `--muted`
  - draw: `J` / `D` in `--ink` with no bar
- The letter carries the meaning, so colour is never the only signal. `role="img"`, labelled `síðustu tíu: 7 sigrar, 3 töp` / `last ten: 7 won, 3 lost`. Source: `match_ratings` [S10].

**Here now table.**
- y=272, a 1.5px `--ink` rule.
- Caption row y=280–300: `HÉR NÚNA · 5 · 1 AÐ SPILA` / `HERE NOW · 5 · 1 PLAYING`, with column labels over their columns: `ELO`, `ÞINN FERILL` / `YOUR RECORD` [phase 2 · S14], `STAÐA` / `STATUS`.
- Rows of 56px from y=304. Columns:

  | Column | x | Content |
  |---|---|---|
  | name | 168–408 | Zilla 600 17, followed by `@embla` in mono 11 `--muted`. Links to the profile. Names are `--ink`. |
  | Elo | 408–472 | mono 13, right-aligned |
  | record [phase 2 · S14] | 472–556 | mono 13, right-aligned, your wins first (`3–1`) or `—`. Until S14 ships the column is absent and the name spans 168–472. |
  | status | 572–756 | mono 11 |
  | action | 756–876 | mono 12, right-aligned |

- Fixture rows, sorted by status (here → searching → in a match → away) and then by rating distance from you:

  | Name | Elo | Record | Status | Action |
  |---|---|---|---|---|
  | Embla `@embla` | 1242 | 1–0 | `hér` | `SKORA Á ▸` |
  | Kári `@kári` | 1179 | 3–1 | `hér` | `SKORA Á ▸` |
  | Hekla `@hekla` | 1150 | — | `hér` | `SKORA Á ▸` |
  | Sóley `@sóley` | 1318 | 0–2 | `hér` | `SKORA Á ▸` |
  | Ragnar `@ragnar` | 1096 | 1–0 | `leitar` | `SKORA Á ▸` |
  | Jónas `@jónas` | 1163 | 1–1 | `í viðureign · 6 af 10` | none (row in `--muted`) |

- **Row states.**
  - Hover gives a `--tint` ground. Keyboard focus draws a 2px `--ink` outline.
  - `in a match` and `away` rows are `--muted` with no action.
  - After eight rows: `+ 6 fleiri ▸` / `+ 6 more ▸`, which expands in place.
- **Handles** are the stored lowercase username, Icelandic letters kept (`@kári`). Profile links are percent-encoded.

**Below the table (y=660):** secondary `BJÓÐA VINI ▸` / `INVITE A FRIEND ▸` [must-have · S11], followed in mono 11 `--muted` by `tengill sem gildir í 10 mínútur` / `a link that works for 10 minutes`.

**Column B.**
- y=152, label `SÍÐASTA VIÐUREIGN` / `LAST MATCH`.
- y=172–512, the **band map** [S10]. A 340×340 grid of 10×10 cells in 1px `--rule` lines, with no outer ink frame and no letters. Each scored word of the last match is drawn as its band (14% of the owner's seat colour, inset per §5.2) with its chevron. Nothing else is drawn.
  - It is `role="img"`, labelled `Birna 134, Kári 88, í gær` / `Birna 134, Kári 88, yesterday`, inside one link named `skoða síðustu viðureign` / `review your last match` (→ D3).
- y=524, Zilla 600 17: `Birna vann 134–88` / `Birna wins 134–88`. `Birna` and `134` are in `--you`; `88` is in `--opp-text`.
- y=548, mono 11 `--muted`: `KÁRI · 4:52 · Í GÆR` / `KÁRI · 4:52 · YESTERDAY`, and at the right `SKOÐA ▸` / `REVIEW ▸`.
- y=584, a 1px rule, then `SÍÐUSTU VIÐUREIGNIR ÞÍNAR` / `YOUR LAST MATCHES`.
  - Four 44px rows from y=616. Each: name (Zilla 600 15) · score (yours `--you`, theirs `--opp-text`) · result word in mono 11 (`sigur` / `tap` / `jafnt`, or `win` / `loss` / `draw`) · `SKOÐA ▸`.
  - Fixture: Kári 134–88 sigur; Embla 184–150 sigur; Jónas 132–171 tap; Kári 166–159 sigur.
  - Void and abandoned matches never appear [S10].

**New player.**
- The band-map slot shows rules figure 1 (three cells showing a swap).
- Text: `Fyrsta viðureignin þín birtist hér.` / `Your first match will show here.`, then `leiðbeiningar ▸`.
- The form strip is ten empty ruled cells.
- The sub-line reads `1200 · ELO · ÍSLENSKA · ENGIN VIÐUREIGN ENN` / `1200 · RATING · ENGLISH · NO MATCHES YET`.

**Empty lobby (artboard LobbyEmpty, EN).**
- The table reads `Enginn annar er hér.` / `No one else is here.` (Zilla 500 17).
- The page primary becomes `BJÓÐA VINI ▸` / `INVITE A FRIEND ▸`.
- `finna mótspilara ▸` / `find an opponent ▸` drops to a secondary, with `þú færð mótspilara um leið og einhver kemur (?)` / `you will be paired as soon as someone arrives`.
- Also `láta mig vita þegar einhver kemur ▸` / `tell me when someone is here ▸`. This opts in to in-page notifications and the `challenge` cue on a presence poke [S6].

**Hint:** none. There is no field and no warm-up.

**Tab title:** `lobbí · orðusta` / `lobby · wottle`.

**Accessibility.**
- The table is `role="table"` with column headers.
- Row actions are labelled name first: `Embla · skora á` / `Embla · challenge`.
- Presence changes are not announced. Only answers to *your* challenge are (polite).

### B2 · Lobby · challenge composer (artboard LobbyComposer, EN, fixture EN-L, Embla's row)

- **The row** grows from 56 to 120px in place. The table's order is frozen. The row takes a `--tint` ground and a 3px `--ink` left rule (live-row grammar).
- **Line 1** is unchanged: `Embla @embla 1342 here`.
- **Line 2**, at y+64, mono 11 `--ink`, built from config and `calculateElo` with your K [must-have · S10 for the rating, client for the stakes]:
  - EN: `EVERY MATCH RATED · WIN +9 · DRAW +1 · LOSS −7 · ENGLISH WORDS · 10 MOVES EACH · ONE 5:00 CLOCK`
  - IS: `GILDIR TIL ELO · SIGUR +9 · JAFNTEFLI +1 · TAP −7 · ÍSLENSK ORÐ · 10 LEIKIR HVOR · EIN 5:00 KLUKKA (?)`
- **Line 3**, when it applies, mono 11 `--muted`:
  - `sending cancels your search` / `leitin hættir ef þú sendir (?)`
  - `sending withdraws your other challenge` / `hin áskorunin þín fellur niður (?)`
  - `sending cancels your link` / `tengillinn þinn fellur úr gildi (?)`
- **At the right of the row,** y+64 to y+108: primary `SEND CHALLENGE ▸` / `SENDA ÁSKORUN ▸` (44px, about 174px), then secondary `not now` / `ekki núna`.
- **Precedence:**
  - While the composer is open, `find an opponent ▸` is drawn as a secondary (text and ` ▸`).
  - If a call arrives, the composer stays open but its send button is drawn as a secondary. The call line outranks it, and nothing moves.
- **Focus** moves to send. Esc or `not now` closes the composer and returns focus to the row's `challenge ▸`. Only one row can be open at a time.

### B3 / B4 · Challenge sent and outcomes (artboard LobbySent, EN, fixture EN-L) [must-have · S4]

- **Line slot (status style).**
  - Line 1: `Challenge sent · Kári · 0:52` / `Áskorun send · Kári · 0:52`.
  - Line 2: `ENGLISH WORDS · 10 MOVES EACH · WIN +7 · LOSS −9`.
  - Right: secondary `withdraw ▸` / `draga til baka ▸`, never focused.
  - A 4px `--ink` drain at the slot's bottom, over 60s.
  - The same line appears on every page while the challenge is out.
- **Kári's row:** the status cell reads `sent · 0:52` / `send · 0:52` in mono 11 `--ink`. There is no action on the row: the action appears once, in the slot.
- **Page primary:** there is none while your challenge is out. `find an opponent ▸` is drawn as a secondary with `withdraws your challenge` / `áskorunin þín fellur niður (?)` beneath it.
- **Other rows** keep `challenge ▸`, and their composer states `sending withdraws your other challenge`.
- **Outcome.** For 4s, both the row's status cell and the line slot show one of these in mono 11 `--ink`:

  | Outcome | EN | IS |
  |---|---|---|
  | declined | `declined` | `hafnaði` |
  | expired | `no answer` | `svaraði ekki` |
  | superseded (they were paired or accepted another) | `started another match` | `hóf aðra viðureign` |
  | left (gone, §7.1) | `left the lobby` | `fór úr lobbíinu` |
  | withdrawn | `withdrawn` | `dregin til baka` |

- **After a decline,** the action cell reads `again in 0:52` / `aftur eftir 0:52` (a 60s per-pair cooldown), then `challenge ▸`.
- **Errors**, written on the row:
  - `that player is in a match` / `sá leikmaður er í viðureign`
  - `that player has left` / `sá leikmaður er farinn`
  - `challenge not sent · try again` / `áskorun fór ekki · reyndu aftur (?)`
  - `too many challenges · wait a minute` / `of margar áskoranir · bíddu í mínútu`
- **Accepted:** the slot and row read `accepted` / `samþykkt` for 400ms, then T16. This works from any page.
- **Fixture:** Kári is sent at 0:52; Hekla shows `declined · again in 0:41`.
- **Accessibility:** each outcome is announced politely, name first: `Kári · declined`.

### B5 · Lobby · incoming challenge (artboard LobbyIncoming, IS, fixture IS-T1)

- **Line slot (call style)** at y=64–128.
  - Line 1: `Kári skorar á þig` / `Kári challenges you`.
  - Line 2, mono 11 `--muted`: `1179 · ÞINN FERILL 3–1 · 0:47 TIL AÐ SVARA` / `1179 · YOUR RECORD 3–1 · 0:47 TO ANSWER`. The record needs [phase 2 · S14]; without it, `1179 · 0:47 TIL AÐ SVARA`.
  - While you are searching, line 2 ends with `· LEITIN HÆTTIR EF ÞÚ SAMÞYKKIR (?)` / `· ACCEPTING CANCELS YOUR SEARCH`.
  - Right: primary `SAMÞYKKJA ▸` / `ACCEPT ▸` (44px, y=74–118), then `hafna` / `decline` (a 44px-tall target), then `⋯` (44×44).
  - The `⋯` holds `þagga áskoranir frá Kári · þessa lotu (?)` / `mute challenges from Kári · this session` and `loka á` / `block` [phase 2 · S15]. Until S15 ships, `⋯` is not drawn.
  - The 4px drain runs over 60s.
- **Page primary:** accept. `finna mótspilara ▸` drops to secondary style.
- **In Kári's row:** the status reads `skorar á þig` / `challenges you`, with no action.
- **Signals:**
  - The `challenge` cue (two notes; respects sound; plays only after the page's first user gesture).
  - Tab title `(1) Kári skorar á þig · orðusta`.
  - The favicon letter turns full-strength `--opp`.
  - An OS notification only if the player opted in and the tab is hidden (in-page Notification API while the page runs; Web Push is [phase 2 · S18]).
- **Accessibility.**
  - The slot is `role="region"`, `aria-label="áskoranir"`.
  - Arrival is announced politely: `Kári skorar á þig, 47 sekúndur til að svara`. It is announced again at 10s left.
  - Focus is never stolen. While the call is up, a skip link `svara áskoruninni · Kári` / `answer the challenge from Kári` is the page's first focusable element.
  - `accept ▸` ignores activation for 500ms after the line appears.

### B6 · Incoming challenge elsewhere (artboard ProfileOwn shows it)

- **On pages (profile, rules):** the identical line slot.
- **In Result or Review:** the ledger's first line, in live-row style above the rows, with a secondary `accept ▸` and `decline`. An incoming rematch outranks it and takes the first line itself; the challenge moves below it. Accepting either answers the other `started another match`.
  - On a phone, the final state's live row appears only while a call or rematch request is pending. Its line 2 carries the call, with `accept ▸` as a secondary in the row.
- **At the table, during the count, or in a live match:** you cannot be challenged. You show as `in a match`, so nothing arrives.

### B7 · Lobby · searching (artboard LobbySearching, EN, fixture EN-L) [must-have · S7]

- **Line slot (status style).**
  - Line 1: `Searching for an opponent · 0:07` / `Leitar að mótspilara · 0:07`.
  - Line 2: `2 SEARCHING NOW · ENGLISH WORDS` / `2 LEITA NÚNA · ÍSLENSK ORÐ`. After 0:30 alone: `NO ONE ELSE IS SEARCHING · CHALLENGE SOMEONE BELOW` / `ENGINN ANNAR LEITAR · SKORAÐU Á EINHVERN HÉR FYRIR NEÐAN (?)`.
  - Right: secondary `cancel ▸` / `hætta við ▸`, never focused. It is 80px above where the find button was.
  - Bottom edge: the 4px `lane-search` sweep.
- **The block's primary slot** is empty while the search runs. The search is a standing state and lives in the slot.
- **The table** stays live, and challenging still works (the composer says it cancels the search).
- **The language switch** stays visible. Pressing it shows the consequence line `switching cancels your search · switch ▸` in the slot first.
- **At 3:00:**
  - line 1 `Still searching? · 3:00` / `Leitar enn? · 3:00`
  - primary `KEEP SEARCHING ▸` / `HALDA ÁFRAM AÐ LEITA ▸`
  - secondary `cancel ▸`
  - a 30s drain
  - no answer → `search stopped · find again ▸` / `leit stöðvuð · leita aftur ▸`
- **On other pages** the search continues in the same slot.
- **Tab title:** `searching 0:07 · wottle` / `leitar 0:07 · orðusta`.
- **Paired:** T9. Seating and ghost-proofing are in §7.3.

### B8 · Lobby · your match is running, or ended while you were away [must-have · S5]

- **Running (status style):**
  - Line 1: `Viðureignin þín · Kári` / `Your match · Kári`.
  - Line 2: `LEIKUR 4 AF 10 · 3:12 EFTIR` / `MOVE 4 OF 10 · 3:12 LEFT`.
  - Primary: `AFTUR Í VIÐUREIGNINA ▸` / `BACK TO THE MATCH ▸`.
  - The match heartbeat keeps running from this page, so Kári's bar reads `stepped out`, not `reconnecting`.
- **The block's primary slot** holds the reason line in mono 11 `--muted`: `ljúktu fyrst viðureigninni` / `finish your match first`. Every row's `challenge ▸` is removed. Sign out is disabled.
- **Ended while you were here:**
  - Line 1: `Viðureigninni er lokið · Kári vann 88–46` / `Your match is over · Kári wins 88–46`.
  - Line 2: the detail (e.g. `8 AF 10 LEIKNIR · TÍMINN RANN ÚT`).
  - Primary: `ÚRSLIT ▸` / `RESULT ▸`.
  - It stays until opened or until the session ends.
- **The lobby never redirects on its own.**

### B9 · Invite link out [must-have · S11]

- **`invite a friend ▸`** creates a single-use link (10 minutes) and copies it.
- **Line slot (status style):**
  - Line 1: `Link copied · valid 9:58` / `Tengill afritaður · gildir í 9:58`.
  - Right: secondaries `copy again ▸` / `afrita aftur ▸` and `cancel link ▸` / `ógilda tengil ▸ (?)`.
  - A 4px drain over 10 minutes.
- **The link is your one outgoing challenge.** Sending a challenge or starting a search cancels it; the composer and find say so.
- **When a friend opens it and presses accept:** T63. You go to C1, where the table waits for you until the link would have expired, with the cue, title and notification if you are hidden.
- **When you open your own link:** T64.

### C1 · Table (opponent found), 1440×900 (artboard Table, IS, fixture IS-T0) [must-have · S3]

- **Top bar.**
  - Kári's name writes in (200ms), with a 12px `--opp` square.
  - Sub-line: `1187 · MÓTSPILARI · Á LEIÐINNI` / `1187 · OPPONENT · ON THE WAY`, which becomes `· VIÐ BORÐIÐ` / `· READY`.
  - Lane: ten `--opp` segments. No total.
- **Bottom bar.**
  - `Birna`, sub-line `1204 · ÞÚ · VIÐ BORÐIÐ` / `1204 · YOU · READY`, or `· Á LEIÐINNI` / `· NOT READY`.
  - Ten `--you` segments.
- **Field:** the empty ruled frame (1.5px ink frame, 1px rules, no letters), at 32% under the slip. The server has not sent the letters: it holds the board until both are seated.
- **Ledger.**
  - Caption: the text wordmark on the left; `MÓTSPILARI FUNDINN` / `OPPONENT FOUND` on the right.
  - Clock block: `LEIKKLUKKA 5:00`, bar full and not running.
  - Face-off header and ten empty rows. No live row.
- **Slip** (440px wide, centred over the field at x=302–742, about y=200–650). Content in order:
  - Label, mono 11 `--muted`: `MÓTSPILARI FUNDINN · 0:14` / `OPPONENT FOUND · 0:14` (the time left to sit down). For a link table while its sender is away: `BORÐIÐ BÍÐUR · 9:12 (?)` / `THE TABLE WAITS · 9:12`.
  - Headline (`tabindex="-1"`, focused on arrival): `Kári` in Zilla 600 34 `--opp`, then `1187` in mono 13 `--ink`.
  - Record, mono 11 [phase 2 · S14; omitted until then]: `ÞINN FERILL 2–1 · SÍÐAST SIGUR 166–159` / `YOUR RECORD 2–1 · LAST WIN 166–159`. The score here is `--opp-text`, being below 17px.
  - Rule.
  - Facts, mono 11: `ÍSLENSK ORÐ · 10 LEIKIR HVOR · EIN 5:00 KLUKKA (?)` / `ENGLISH WORDS · 10 MOVES EACH · ONE 5:00 CLOCK`.
  - Stakes, mono 11: `SIGUR +8 · JAFNTEFLI 0 · TAP −8` / `WIN +8 · DRAW 0 · LOSS −8`.
  - Rematches only, a series line: `viðureign 2 · Birna 1–0` / `match 2 · Birna 1–0`.
  - Rule.
  - Two seat lines, each 28px with its square: `■ Kári  á leiðinni` / `on the way`, and `■ Birna · þú  við borðið` / `you  ready`.
  - Rule.
  - Actions, by state:
    - **Not seated:** row 1 has primary `ÉG ER TIL ▸` / `READY ▸` (not focused; guarded 500ms); row 2 has secondary `fara` / `leave`.
    - **Seated and waiting (a wait, no primary):** row 1 reads, in mono 11 `--ink`, `ÞÚ ERT VIÐ BORÐIÐ` / `YOU ARE SEATED`; row 2 keeps `fara` / `leave`. The exit is never where `ready` was.
  - Reactions [phase 2 · S16], once you are seated, in their own row of up to three 32px buttons (1px `--rule` frame, Zilla 500 15, no `▸`): `hæ` · `gangi þér vel` / `hi` · `good luck`.
  - A 4px drain bar on the slip's inner bottom edge, 20s.
- **Signals.**
  - Tab title `Kári · mótspilari fundinn · orðusta`.
  - If the tab is hidden: the `challenge` cue and an OS notification (opted in).
  - On phones, a Screen Wake Lock is held at the table.
- **Accessibility.**
  - The slip is a dialog.
  - The headline `Kári, 1187` is announced assertively once.
  - Each seat change is announced politely.

### C2 · Starting (artboard Starting, EN, fixture EN-M)

- **Timing.** `seat_player` sets `started_at` = the moment the table completes + 4.5s [S3].
  - At that moment both seat lines read `ready`, and the label reads `STARTS IN 3` / `HEFST EFTIR 3`.
  - The slip lifts at `started_at − 3.3s` (150ms fade).
- **Clock block** (same outer height, about 72px):
  - Label `STARTS IN` / `HEFST EFTIR` on the left.
  - On the right, the numeral `3` · `2` · `1` in mono 500 **56px** (display-1), using the bar's area, with the bar hidden. Under reduced motion it still steps: this is time.
  - At 0 it becomes `5:00` at 32px, the full bar appears and starts to drain, the 3px `--you` turn frame draws, and `match-start` sounds.
- **Field:** letters land during `3` (M4).
- **Live row:**
  - Line 1: `move 1` / `leikur 1`.
  - Line 2: `pick when the clock starts` / `veldu þegar klukkan fer af stað (?)`.
  - At go, line 1 becomes `move 1 · your move` and line 2 `pick a letter`.
- **Focus at go** moves to the field: the last focused cell, else the centre cell. Line 1 is announced.
- **A reaction received at the table** is a suffix on the sender's sub-line that never replaces its facts: `1265 · opponent · ready · says „good luck“` [phase 2 · S16]. No reactions are offered after the slip lifts.
- **Source:** the server's `started_at` only. A client that learns late (the polling fallback) joins the count where it is.
- **Tab title:** `3 · Kári · wottle`.

### C3 · Table · void [must-have · S3, S7, S12]

**Slip rewrites.**
- Label: `ENGIN VIÐUREIGN` / `NO MATCH`.
- Headline, Zilla 600 28 `--ink`, by reason:
  - The opponent did not sit down: `Kári settist ekki` / `Kári did not sit down`.
  - The opponent left: `Kári fór frá borðinu` / `Kári left the table`.
  - You did not sit down: `Þú settist ekki í tæka tíð` / `You did not sit down in time`.
- Body: `hefur ekki áhrif á Elo stig` / `nothing was rated`.

**Actions by the table's origin.**

| Origin | What happens | Actions |
|---|---|---|
| queue (you sat down) | You are back in the queue automatically, at the front. | Body adds `þú ert aftur í leitinni (?)` / `you are back in the queue`; secondary `hætta við ▸` / `cancel ▸` (a wait) |
| challenge | — | `skora aftur á ▸ (?)` / `challenge again ▸` (with the cooldown if one applies) and `lobbí` / `lobby` |
| rematch | — | `úrslit ▸` / `result ▸` (the previous match's D1) and `lobbí` |
| link | — | `lobbí` |

**The absent player** becomes `away`, and their search is cancelled. On return, the lobby's line slot reads `þú settist ekki · leitin stöðvaðist` / `you did not sit down · your search stopped`.

**Dodging.** Two `left` voids within 10 minutes give a 5-minute cooldown on searching and challenging. It shows in the find slot as `leita aftur eftir 4:12` / `find again in 4:12` [S12].

**Data.** A void is `ended_reason = 'void'` with `void_reason` (`not_seated` | `left`) and `voided_by`. It writes no rating rows and appears in no history, record, form, head-to-head or rematch offer.

### C4 · Match, 1440×900 (artboards Match IS fixture IS-M at step 9; MatchLastMinute EN fixture EN-M)

The layout is unchanged from `idle-visual-1440x900-darwin.png`. The changes:

- **Last-moved tick** (a new letter state).
  - A 2px bar in the mover's seat colour along the bottom inner edge of both cells of each player's most recent swap. At most two ticked cells per seat.
  - A frozen letter drops its tick.
  - The cell label ends `…, síðasti leikur · Kári` / `…, Kári's last move`.
- **Clock label.** While the move is yours, `match clock` becomes the pace: `≈27s a move` / `≈27 sek á leik` (time left ÷ your moves left). Otherwise `match clock` / `leikklukka`.
- **Missed beat** (in place of `scored` when a resolved move has no word):
  - Line 1: `move 4 · no word` / `leikur 4 · ekkert orð`.
  - Line 2: `−5 · move 5 opens` / `−5 · leikur 5 opnast`, or, near zero, `−3 · a total never falls below 0` / `−3 · samtala fer aldrei undir 0`.
- **Stakes line under 1:00.** While a move is yours and nothing is picked, line 2 reads the computed stakes (`timeoutPenalty(total, unplayed)`) instead of `pick a letter`: `3 moves left · −15 if unplayed` / `3 leikir eftir · −15 ef óleiknir (?)`. Near zero it reads e.g. `· −7 if unplayed`.
- **Illegal pick** names the word: `frozen · GILT · Kári · pick another` / `frosinn · GILT · Kári · veldu annan`.
- **Pick cleared** appears on live row line 2 for 2s, not as a notice: `pick cleared · Kári moved that letter` / `val fellt niður · Kári færði stafinn`. The cell flashes the opponent's tick once.
- **Your connection lost:**
  - Your sub-line reads `offline · reconnecting` / `án tengingar · tengist aftur`.
  - Your lane is outlined.
  - The turn frame goes to ink.
  - The field takes no pick.
- **Live row line 2 is one line at 1440.** Strings:
  - `picking · T (2) · pick a second letter` / `velur · T (2) · veldu annan staf`
  - `Kári · 8 of 10 · 1:12 left` / `Kári · 8 af 10 · 1:12 á klukkunni`
- **Ledger foot `⋯`:**
  - `how to play` (opens a new tab, and says so)
  - `sound · on`
  - `notifications · off`
  - `mute reactions` / `þagga viðbrögð (?)` [phase 2 · S16]
  - `confirm moves · off` / `staðfesta leiki · af (?)`
  - `go to the lobby` / `fara í lobbíið` (→ C7, never a resign)
  - `resign` / `gefast upp`

  The old `leave` is removed.
- **Ledger cells** are one composite widget with a roving tabindex: one tab stop, arrows inside. In a match, a cell pins or unpins that move's bands.
- **Drag** needs at least 0.6 cells of travel. The picked letter follows under the finger. Releasing on the starting cell or outside the field cancels.
- **No reactions while the clock runs.**
- **Opponent announcements:** a polite, rate-limited region announces `Kári SKÓ +11 · 5 of 10` / `Kári SKÓ +11 · 5 af 10`, after your own beat.
- **Tab title:** `3:12 · move 4 · wottle` / `3:12 · leikur 4 · orðusta`. While the move is yours and the tab is hidden, the favicon letter is full-strength `--you`.
- **Match (IS) fixtures, IS-M after step 9:**
  - Kári: `1187 · mótspilari · 6 af 10 · að leika`, total 24. Rows: GILT 18, −5, TAK 10, −5, SKÓ 11, −5.
  - Birna: `leikur 4 af 10`, total 51. Rows: BORÐ 23, −5, LEK·ÆSKU 33.
  - Clock 3:12, label `≈27 sek á leik` (192s ÷ 7). Kári's ticks on the two SKÓ-move cells.
- **MatchLastMinute (EN) fixtures, EN-M:**
  - Clock 0:48, in the tinted block.
  - Birna on `move 8 · your move`, total 69, label `≈16s a move`, line 2 `3 moves left · −15 if unplayed`.
  - Kári `1265 · opponent · 9 of 10 · playing`, total 41.

### C5 · Reactions [phase 2 · S16]

The sets, placement and limits are in §7.6.

- **Offered** at the table (on the slip) and after the match (on the result slip, or the ledger on a phone). Never while the clock runs.
- **Display:** a received reaction is a 3s suffix on the sender's bar sub-line, `· says good luck` / `· segir gangi þér vel`. It never replaces the count, the connection state or the verdict.
- **Announcement:** `Kári says good luck` / `Kári segir gangi þér vel` (polite).
- **Until S16 ships,** no reaction row is drawn.

### C6 · Resign slip (artboard ResignSlip, EN, fixture EN-M)

- **Opened by you** from `⋯ resign`.
- Label: `move 4 of 10 · 3:12 left` / `leikur 4 af 10 · 3:12 eftir`.
- Headline: `Resign the match?` / `Gefast upp?`.
- Body: `Kári wins · your rating moves as a loss · −9` / `Kári vinnur · Elo-stigin þín reiknast sem tap · −9`.
- Actions: **primary `KEEP PLAYING ▸` / `HALDA ÁFRAM ▸`, focused**; secondary `yes, resign ▸` / `já, gefast upp ▸` on the second line. Esc keeps playing.
- The clock keeps running behind the slip.

### C7 · Leave slip

- **Opened by** Back (the guard entry pushed on your first pick) or by `⋯ go to the lobby`. Closing the tab shows the browser's own confirmation while the match is live.
- Label: `move 4 of 10 · 3:12 left`.
- Headline: `Leave the match?` / `Fara úr viðureigninni?`.
- Body:
  - `the clock keeps running · you can come back` / `klukkan gengur áfram · þú getur komið aftur`
  - `each unplayed move costs up to 5 at 0:00` / `hver óleikinn leikur kostar allt að 5 við 0:00 (?)`
- Actions: primary `STAY ▸` / `VERA ÁFRAM ▸` (focused); secondary `go to the lobby` / `fara í lobbíið` (→ B8).
- **While you are away,** the match heartbeat continues from any app page. Kári's view reads `stepped out`, and you are never counted as disconnected [S5].

### C8 · Disconnect and end early (artboard Disconnect, EN, fixture EN-M variant: Birna 10 of 10 at 1:12)

- **Opponent's bar:**
  - During the 90s window: `1265 · reconnecting · 0:42 left` / `tengist aftur · 0:42 eftir`, with outlined lane segments.
  - After the window: `1265 · 8 of 10 · gone for 2:04` / `8 af 10 · án tengingar í 2:04`. Never a frozen `0:00 left`.
  - Stepped out (another app page, heartbeat alive): `1265 · 6 of 10 · stepped out` / `6 af 10 · brá sér frá`. This is not a disconnection, and nothing is offered.
- **End-early slip.** Raised once by the game, only when you have 10 of 10 and the window has passed. Its headline is focused.
  - Label: `10 of 10 played · 1:12 on the clock`.
  - Headline: `Kári is gone` / `Kári er ekki lengur hér`.
  - Body: `the normal rules decide it` / `venjulegar reglur ráða úrslitum`.
  - Primary `END THE MATCH ▸` / `LJÚKA VIÐUREIGNINNI ▸` (guarded 500ms). Secondary `keep waiting ▸` / `bíða áfram ▸`.
  - End early is not destructive to the viewer, so it stays primary (§8.3).
- **After `keep waiting`,** the offer lives in the live row:
  - Line 1: `10 of 10 played`.
  - Line 2: `Kári is gone · end the match ▸` / `Kári · án tengingar · ljúka viðureigninni ▸`, as a secondary (the live row carries no ink fills).
- **Coming back:** the returning player's line 2 reads `back · you were away 0:34 · the clock kept running` / `tenging komin aftur · 0:34 án tengingar` for 4s.
- **`claimWin` results** map to error codes with copy in both languages. No raw codes are shown.

### D1 · Result, 1440×900 (artboard Result, IS, fixture IS-M final)

- **Behind the slip:**
  - The final field, faded to 32%.
  - The bars show totals, and the winner's sub-line ends with `· vann` / `· wins`.
  - The ledger is in its final state with a totals row. The caption right reads `LOK · 4:52` / `FINAL · 4:52`.
  - The match heartbeat, the popstate guard and `beforeunload` are disarmed.
- **Slip** (440px, x=302–742, about y=190–710). It lands 600ms after the final settle. **Focus goes to the headline**, and every action is guarded for 500ms.
  - Label: `VIÐUREIGN LOKIÐ · 4:52` / `MATCH OVER · 4:52`.
  - Headline, Zilla 600 34 `--you`: `Birna vann` / `Birna wins`. A draw is `Jafntefli` / `Draw` in `--ink`. It is announced assertively once.
  - Score, mono 40: `134 – 88` in seat inks.
  - Detail, mono 11. It says why the match ended, once, per rules §12:

    | Ended | IS | EN |
    |---|---|---|
    | both played ten | `MEÐ 46 STIGUM · 10 ORÐ GEGN 8 · SVÆÐI 27–21` | `BY 46 POINTS · 10 WORDS TO 8 · TERRITORY 27–21` |
    | incomplete | `KÁRI LÉK 8 AF 10 · MEÐ 12 STIGUM` | `KÁRI PLAYED 8 OF 10 · BY 12 POINTS` |
    | both incomplete | `HVORUGT KLÁRAÐI · MEÐ 12 STIGUM` | `NEITHER FINISHED · BY 12 POINTS` |
    | forfeit | `KÁRI GAFST UPP · 3:12` | `KÁRI RESIGNED · 3:12` |
    | ended early | `LOKIÐ SNEMMA · KÁRI VAR FARINN (?)` | `ENDED EARLY · KÁRI WAS GONE` |

  - Mono 11: `BESTA ORÐIÐ ÞITT · BORÐA 29` / `YOUR BEST WORD · BORÐA 29`.
  - Rule.
  - Rating lines: `■ Birna · þú  1204 → 1212 · +8` and `■ Kári  1187 → 1179 · −8` (or `rating pending` / `reikna Elo-stig`).
  - Rule.
  - Action row 1: primary `ANNAN LEIK? ▸` / `REMATCH ▸` (not focused), then `nýr mótspilari ▸` / `new opponent ▸`.
  - Action row 2: `yfirfara viðureignina ▸` / `review the match ▸`, then `lobbí` / `lobby`.
  - Reactions [phase 2 · S16]: one row of three 32px buttons, always in this order: `góð viðureign (?)` · `vel spilað` · `bless` / `good game` · `well played` · `bye`.
- **When rematch is not offered** (the opponent has left, more than 2:00 has passed, the match was opened later, or a request was declined or expired):
  - The primary is `nýr mótspilari ▸`.
  - If they are here, a secondary `skora aftur á ▸ (?)` / `challenge again ▸`, which reads `again in 0:52` during a cooldown.
- **Esc or `review the match ▸` lifts the slip.** `result ▸` in the foot restores it.
- **Tab title:** `Birna vann · orðusta` / `Birna wins · wottle`.

### D2 · Rematch negotiation (artboard RematchIncoming, EN, fixture EN-M final, shown in review) [must-have · S8]

The negotiation replaces the slip's action row 1. The other actions stay visible and working.

| State | Line (on the slip) | Actions |
|---|---|---|
| sent (a wait) | `rematch sent · 0:24` / `beiðni send · 0:24`, with a 4px drain | secondary `cancel ▸` / `hætta við ▸` at the row's right end; row 2 `new opponent ▸` · `lobby`; row 3 `review the match ▸`. `new opponent ▸` cancels the request. |
| incoming | `Kári asks for a rematch · 0:24` / `Kári vill aðra viðureign · 0:24`, drain | primary `ACCEPT ▸` / `SAMÞYKKJA ▸` (not focused, guarded 500ms); secondary `decline` / `hafna`. The change is announced politely. |
| declined | `Kári declined` / `Kári hafnaði` | `rematch ▸` removed for both; a 60s per-pair cooldown; primary `new opponent ▸` |
| expired | `no answer` / `ekkert svar` | as declined |
| opponent left | opponent's sub-line `has left` / `er farinn` → use `hætti` (?) | rematch disabled with the reason `Kári has left` / `Kári hætti (?)` |
| accepted, or crossed requests | `Kári accepted` / `Kári samþykkti` | T40 |

- **Incoming while the slip is lifted, or during review:**
  - The slip is **not** raised again (T41).
  - The request is the ledger's first line, in call style: `Kári asks for a rematch · 0:24`, drain, secondary `accept ▸` and `decline`.
  - Announced politely, with the `challenge` cue, the title `(1) Kári asks for a rematch · wottle` and the favicon letter in `--opp`.
- **Artboard fixture:** the review field at step 7 of Match E. The ledger's first line carries the incoming request at 0:24. No slip.

### D3 · Review, 1440×900 (artboard Review, IS, fixture IS-M at step 7) [must-have · S9]

**URL:** `/match/:id?review=7`, on the same page as the match, so nothing remounts. Entering review pushes one entry; each step replaces it.

**Field.**
- `board_after` at step k, with bands for every word scored up to k.
- Step k's own words are at 30%, earlier words at 14%.
- Step k's swap carries the tick.
- A refused step leaves the letters in place, with the line `refused · frozen` / `hafnað · frosinn`.

**Bars:** names, the score at step k (counting as you step) and the lanes at step k.

**Ledger.**
- Caption: `yfirferð · 4:52` / `review · 4:52`.
- **Scrubber block,** in the clock-block frame (y=68–168). It is one `role="slider"` that takes focus; its value text is `step 7 of 20, Birna, LEK ÆSKU plus 33`.
  - Label: `SKREF 7 AF 20 (?)` / `STEP 7 OF 20`.
  - The time `3:31`: the clock as it read when the move was received.
  - A 10px bar at that fraction.
- **Control row,** 44px: five labelled cells of 64px, `first · back · play ▸ · next · last` / `fyrst · aftur · spila ▸ · næst · síðast (?)`. `play ▸` becomes `pause` / `hlé` while it runs (one step per second, stoppable at any time).
- **Rows:** a column header, then ten rows sharing y=200–640, one composite widget with a roving tabindex.
  - Cells up to step k are `--ink`.
  - Step k's cell takes the live-row style on the mover's side.
  - Cells after step k are `--muted` (5.7:1), named e.g. `move 8, Kári, not yet reached`.
  - In review, a cell jumps to its step.
- **Cursor line** (y=648–712, live-row style):
  - Line 1: `leikur 3 · Birna · LEK · ÆSKU +33` / `move 3 · Birna · LEK · ÆSKU +33`.
  - Line 2: `6 frosnir · Birna leiðir 51–18 (?)` / `froze 6 · Birna leads 51–18`.
  - [phase 2 · S17] Line 2 adds `best here 34 · show ▸`. `show ▸` draws the best swap as a 1.5px dashed band outline, in review only. Until S17 ships this clause is absent.
- **Lead chart** (y=720–800, 340 wide), §5.8 grammar: a 1.5px polyline of the lead, the zero line in `--rule`, and a cursor rule at k. Tap to jump.
- **Filter:** `sýna ekkert orð ▸ (?)` / `jump to misses ▸`.
- **Foot:** `◂ úrslit` / `◂ result` on the left. On the right, the one primary (`REMATCH ▸` while offered, else `CHALLENGE AGAIN ▸` if they are here, else `NEW OPPONENT ▸`), then `⋯` holding `lobby`, `copy link ▸` and `report name` [phase 2 · S15].

**Steps.**
- The step total is counted from the rows.
- Refused moves are steps, labelled `refused`.
- When the clock ended the match, a final synthetic step `time · −N not played` reconciles the last `score_*_after` with the result.
- This fixture has 20 steps: both played ten, no refusals.
- Steps 1–9 are the IS-M table. Steps 5 and 6 are two consecutive Kári moves: receipt order at work.

**Keys** apply only while the scrubber has focus: ←/→ step, Home/End jump to the ends, Space toggles play and pause. The field's arrow navigation and the buttons' Space are untouched.

**Other viewers.** Non-participants and signed-out visitors get a read-only view with the line `viðureigninni er lokið · Birna – Kári` / `this match is over · Birna – Kári`. There is no rematch or challenge; the foot primary is `enter the lobby ▸` when signed out.

### E1 · Profile (own), 1440×900 (artboard ProfileOwn, IS, fixture IS-T1, with Embla's call)

**Line slot:** `Embla skorar á þig` · `1242 · ÞINN FERILL 1–0 · 0:38 TIL AÐ SVARA` (the record is [phase 2 · S14]) · `SAMÞYKKJA ▸`. While the call shows, accept is the page primary.

**Column A** (from y=152).
- **Name row:** a 16px `--you` square, `Birna` in Zilla 600 56 (the `h1`), and right-aligned `1212` in mono 500 56 `--you`.
- **Sub-line:** `@birna · spilar síðan í mars 2026 · 35 viðureignir` / `@birna · playing since March 2026 · 35 matches`. Right: `ELO · ÍSLENSKA · HÆST 1216 · +16 Í VIKUNNI` / `RATING · ENGLISH · PEAK 1216 · +16 THIS WEEK`.
- **Chart,** 708×200, per §5.8. Empty state: a flat 1.5px line at the current rating, labelled flush-left `1212 · engar viðureignir síðustu 30 daga`.
- **Form strip.**
- **Record row:** four ruled cells with mono 40 numerals, `20 · 15 · 0 · 57%`, over mono 11 labels `SIGRAR · TÖP · JAFNTEFLI · SIGURHLUTFALL`.
- **`BESTU ORÐIN` / `BEST WORDS`:** three word strips (40px cells with numerals, a 14% `--you` band and a chevron), each with its score beside it in mono 22: HESTAR 32, BORÐA 29, SKÍRN 24.

**Column B.**
- Primary `FINNA MÓTSPILARA ▸` (a secondary while a call is up).
- `NÝLEGAR VIÐUREIGNIR` / `RECENT MATCHES`: eight 44px rows. Each: the opponent in their own cell, the score, `sigur`/`tap`/`jafnt`, `SKOÐA ▸`. No `gegn`.
- Rule. `ENSKA · 1310 ▸` / `ICELANDIC · 1212 ▸`, linking to the other-language profile, or `engar viðureignir á ensku enn` / `no Icelandic matches yet`.
- `breyta nafni ▸` / `change name ▸` [phase 2 · S15]. An inline input (the one amended second input, §8.13); rating and history are kept; one change per 30 days; the old name is reserved for 30 days; the blocklist applies.
- `⋯` holds `endurheimtarkóði (?)` / `recovery code` [phase 2 · S15], a one-time code that moves your name to another browser.
- `skrá út` / `sign out`, with the same consequence line and disabling as B1.

**Folio:** `ORÐUSTA · PRÓFÍLL · BIRNA`.

### E2 · Profile (public), 1440×900 (artboard ProfilePublic, EN, fixture EN-L)

**Column A:** the same layout as E1, in Kári's seat colour. On his public profile he is set against you, which §8.6 allows.
- `Kári` 56, `1265` in `--opp` 56.
- `@kári · playing since April 2026 · 41 matches`; `RATING · ENGLISH · PEAK 1281 · −4 THIS WEEK`.
- Presence line, mono 11 `--ink`: `HERE NOW` / `HÉR NÚNA`. No last-seen time is ever shown.
- The chart line is `--opp`. The form strip's win bars are `--opp`.
- Best-word strips use `--opp` letters (above 17px) and `--opp-text` numerals.

**Column B.**
- **Primary `CHALLENGE ▸` / `SKORA Á ▸`.** It opens the composer in column B (stakes, then `send challenge ▸`).
- **When your challenge to Kári is out,** the primary slot shows `sent · 0:41` and the line slot carries `withdraw ▸`.
- **Other presence states**, each with no action:
  - `in a match · 6 of 10` in `--muted`
  - `away` / `fjarverandi`
  - `in the Icelandic lobby` / `í enska lobbíinu`. Cross-language challenges are [phase 2 · S19].
  - `not here` / `ekki hér`
- **Head-to-head** [phase 2 · S14; omitted until then]: `YOU AND KÁRI` / `ÞÚ OG KÁRI`, then `2–1` in mono 40, then `last · win 128–117 · review ▸`.
- **`YOUR MATCHES`** rows, each with `review ▸`.
- **Foot** [phase 2 · S15]: `block` / `loka á` (a confirmation line in place: `blocked players never see or challenge each other · block ▸`) · `report name` / `tilkynna nafn`.
- **Blocked** [phase 2]: the page shows `@kári` and nothing else.

### E3 · Rules

- The existing content, in the page frame, with the 40px strip in the header.
- Fix the clock line: `Under 1:00 it darkens; in the last 15 seconds it flashes.`
- Fix the `10moves` typo.
- The primary is set by state (screen map). Opened from a match, it is `close this tab ▸` / `loka flipanum ▸` (T52).

### F1 · Phone door (artboards PhoneDoorIs, PhoneDoorEn)

- **Masthead** (y=8–52): left `4 HÉR NÚNA`; right `ENGLISH ▸` (a 44px target). Rule at y=56.
- **Lockup:** IS at 51px cells, 357×306, y=72–378. EN at 47px cells, 282×329, y=72–401.
- **Kicker:** mono 10, 16px below the lockup (IS y=394).
- **Headline:** Zilla 600 30/1.05, three lines broken at each comma. IS: `Tveir leikmenn,` / `eitt borð,` / `tíu leikir hvor.` EN: `Two players,` / `one field,` / `ten moves each.` IS y=412–508. No lede on phones.
- **Name:** label y=528; input y=544–588 (Zilla 600 22, 1.5px underline); error line y=596.
- **Primary, inline under the input** (a form's submit stays next to its field), full width, y=612–660: `INN Í LOBBÍIÐ ▸`. Then `SKRÁNING ÓÞÖRF · ÞESSI VAFRI GEYMIR NAFNIÐ ÞITT` at y=672, on two lines.
- **Below:** a rule at y=712; `HÉR NÚNA · 4`; two 44px rows; `leiðbeiningar ▸`. The page scrolls. At 390×664 the primary still ends above the fold.
- **Keyboard open:** the input scrolls into the upper third, and the lockup scrolls away.
- **Returning state:** the name field is replaced by `Birna` (Zilla 600 22) and `ekki Birna? · annað nafn`.

### F2 · Phone lobby (artboard PhoneLobby, IS, fixture IS-T1, with Kári's call)

- **Masthead:** the strip at 18px cells; `■ BIRNA` (44px) and `⋯` (44×44).
- **Your block** from y=72: `Birna` Zilla 600 28 (y=72–104); the sub-line on two lines (y=112–140); the form strip at y=152–172.
- **Here now:** a rule at y=192, the caption at y=200, then rows of 64px from y=220. Line 1: name + Elo right-aligned. Line 2: status left, action right (44px target).
- **Then:** the band map at 358², `síðustu viðureignir þínar`, and the folio.
- **Bottom slot, call line** (104px; y=724–828 at the reference size):
  - A 4px drain on its top edge.
  - Line 1: `Kári skorar á þig` (Zilla 600 17).
  - Line 2: `1179 · 3–1 · 0:47 til að svara`.
  - A 44px row: `SAMÞYKKJA ▸` (primary, 196px), `hafna` (44px), `⋯` (44×44; holds mute and block [phase 2 · S15]).
  - The pinned find primary is hidden while the call is up, so the screen has one primary.
- **Searching:** the bottom slot is the 64px status.
  - Top edge: the 4px sweep.
  - Left, `LEITAR · 0:07` in mono 12, with `haltu skjánum opnum` / `keep this screen open` in mono 10 beneath.
  - Right: `hætta við ▸` (44px).
  - A Wake Lock is held.
  - Hidden → paused (T60). On return: `leit í bið · halda áfram ▸` / `search paused · resume ▸`, the one primary.
- **Challenge out:** the bottom slot shows `áskorun send · Kári · 0:52` with `draga til baka ▸` and `haltu skjánum opnum`.

### F3 · Phone match (artboards PhoneMatch at 390×844 and PhoneMatchShort at 390×664, EN, fixture EN-M)

- **Bars and field** as in the phone room frame.
- **Ledger block at 844:**
  - Rule at y=514. No caption during a match.
  - Clock block y=522–578: label `≈27S A MOVE` on the left, `3:12` in mono 26 on the right, a 10px bar.
  - Live row y=586–650:
    - Line 1: `move 4 · your move`.
    - Line 2: the instruction, or the current notice for as long as it holds (pick cleared, a refusal, your own `offline · reconnecting`, a submit error, the stakes under 1:00).
    - Right cell: `history ▸`.
  - Territory y=662–676.
  - **Foot, pinned** (44px plus the safe area): `⋯` on the left (44×44).
- **At 664 (PhoneMatchShort):** territory hidden; the clock is a 32px strip; the live row stays at two lines.
- **Sheet** (tap the live row):
  - It replaces the block between your bar and the foot.
  - A 32px strip pins the clock at its top.
  - A 28px header row carries `close` / `loka`.
  - The rows scroll inside the sheet.
  - It never rises above your bar and never covers the foot. Esc returns focus to the live row.
- **No reactions.**

### F4 · Phone result (artboard PhoneResult, IS, fixture IS-M final)

**Slip = the field's square** (x=16–374, y=80–438, padding 20, 318×318 inside). It never covers the bars, so both totals stay visible. Headline focus and a 500ms guard, as on desktop.

| Element | y | Content |
|---|---|---|
| Label | 100–114 | `VIÐUREIGN LOKIÐ · 4:52` |
| Headline | 120–152 | Zilla 600 28, `Birna vann` |
| Score | 158–194 | mono 32, `134 – 88` |
| Detail | 200–214 | first two clauses only: `MEÐ 46 STIGUM · 10 ORÐ GEGN 8` |
| Rule | 222 | |
| Rating lines | 230–266 | two lines, mono 11 |
| Rule | 274 | |
| Action row 1 | 282–326 | `ANNAN LEIK? ▸` (primary, about 148px) and `nýr mótspilari ▸` |
| Action row 2 | 334–378 | `yfirfara viðureignina ▸` and `lobbí` |
| Negotiation | 386–418 | reserved: when D2 is active its line (e.g. `beiðni send · 0:24 · hætta við ▸` with a drain) replaces action row 2, and this band holds the drain |

**Ledger below.**
- Caption `LOK · 4:52`.
- Verdict line `Birna vann 134–88`.
- Reactions row [phase 2 · S16]: three 44px buttons, `góð viðureign` · `vel spilað` · `bless`.
- The live row appears only while a call or rematch request is pending.
- Foot: `⋯` and `úrslit ▸` (when the slip is lifted).

### F5 · Phone table (artboard PhoneTable, IS, fixture IS-T0)

**Slip = the field's square.**

| Element | y | Content |
|---|---|---|
| Label | 100 | `MÓTSPILARI FUNDINN · 0:14` |
| Headline | 118–150 | `Kári` Zilla 600 28 `--opp` + `1187` mono 13 |
| Series line | 160 | rematch only |
| Stakes | 160 or 178 | mono 11, `SIGUR +8 · JAFNTEFLI 0 · TAP −8` |
| Rule | 196 | |
| Seat lines | 204–260 | two lines of 28px |
| Rule | 268 | |
| Actions | 276–320 | `ÉG ER TIL ▸` primary + `fara`; once seated, `ÞÚ ERT VIÐ BORÐIÐ` + `fara` |
| Drain | 414–418 | 4px |

**The ledger block below** carries what the slip drops:
- the facts line in the live-row position: `ÍSLENSK ORÐ · 10 LEIKIR HVOR · EIN 5:00 KLUKKA`
- the record line [phase 2]
- the reactions row [phase 2]

**C2 on a phone:** the clock block shows the 56px count (32px in the compressed strip), and the letters land in the field.

### F6 · Phone composer and sent (artboard PhoneComposer, IS, fixture IS-T1, Embla's row)

- **Composer:** the row grows to 176px.
  - Line 1: name, Elo, status.
  - Line 2, wrapped to two mono 11 lines: `GILDIR TIL ELO · ÍSLENSK ORÐ · 10 LEIKIR HVOR` / `SIGUR +9 · JAFNTEFLI +1 · TAP −7`.
  - Line 3: the consequence, when one applies.
  - A 44px row: `SENDA ÁSKORUN ▸` (primary) + `ekki núna`.
  - The pinned find primary is hidden while the composer is open.
- **Sent:** the row reads `send · 0:52`. The bottom slot carries `áskorun send · Embla · 0:52` with `draga til baka ▸` and `haltu skjánum opnum`.

### F7 · Phone review (artboard PhoneReview, IS, fixture IS-M step 7)

- **Field and bars** as in the phone room frame.
- **Ledger block:**
  - The scrubber replaces the clock block: `SKREF 7 AF 20 · 3:31` over a 4px bar, as a 32px `role="slider"`.
  - The cursor line replaces the live row, on two lines.
  - The rows and the lead chart live in the sheet (`saga ▸`).
- **Foot (pinned):** `◂ úrslit` (44px tall), then five 44×44 step controls drawn as glyphs `◂◂ ◂ ▸ ▸ ▸▸`, each with an `aria-label` (`fyrst`, `aftur`, `spila`, `næst`, `síðast`). The next-step primary lives on the result slip.

### F8 · Phone slips (resign, leave, end early)

Each fills the field's square with the same content as on desktop:

| Element | y |
|---|---|
| Label | 100 |
| Headline, Zilla 600 28 | 118–150 |
| Body, two mono 11 lines | 162–194 |
| Rule | 206 |
| Action row (primary + secondary) | 214–258 |

The secondary sits on a second line (266–310) when the two do not fit in 318px. Focus follows §8.3.

### F9 · Phone profile

- **Name** in Zilla 600 32, with the rating in mono 500 32 on its own line, right-aligned.
- **Sub-lines** on two lines.
- **Chart** 358×140.
- **Form strip.**
- **Record row:** four cells, mono 28.
- **Best-word strips** at 32px cells (numerals shown at the 32px threshold).
- **Recent matches.**
- **Pinned primary:** `finna mótspilara ▸` (own) or `skora á ▸` (public). The call line takes its place while a call is up.

---

## 6. Logo and landing

**Concept: two words crossing.** Both names are word + battle: *orð + orusta*, and *wo(rd) + (ba)ttle*. The mark is the game itself.
- Two players' words cross on ruled cells, and the player who froze first owns the crossing (spec 049).
- **The visitor's language reads across, first, in `--you`. The other language crosses it in `--opp`.**
- The shared letter keeps the primary word's colour and value.
- Values come from the language packs (`LETTER_SCORING_VALUES_IS`, `_EN`).

**Icelandic lockup (`/`).** Primary: ORÐUSTA.
- **Grid** of 7 columns × 6 rows. Only the 12 lettered cells are drawn: flat `--paper` with 1px `--rule` borders and **no outer frame**, because the frame belongs to a full field.
- **ORÐUSTA** runs across row 3, columns 1–7, in `--you` letters. Numerals (Icelandic values) in `--you`: O5 R1 Ð2 U2 S1 T2 A1.
- **WOTTLE** runs down column 6, rows 1–6, in `--opp` letters. Numerals (English values) in `--opp-text`: W4 O1 [T] T1 L1 E1.
- **The crossing is T:** ORÐUSTA's 6th letter and WOTTLE's 3rd. The cell shows a `--you` T with the numeral **2**.
- **Bands:** 14% of each seat colour, inset 20% across and 5% along. Both bands shade the crossing.
- **Chevrons:** 1.5px, opened about 150°, arm depth 9%. Teal sits at the left edge of O, pointing right. Coral sits at the top edge of W, pointing down.
- **Letters and numerals:**
  - Letters are Zilla 600 at 55% of the cell. In cells under 31px (where letters fall below 17px), coral letters switch to `--opp-text`.
  - Numerals are mono at max(9px, 18%), in the top-right gutter, hidden below 32px cells.

**English lockup (`/en`).** Primary: WOTTLE.
- **Grid** of 6 columns × 7 rows.
- **WOTTLE** runs across row 1, columns 1–6, in `--you`: W4 O1 T1 T1 L1 E1.
- **ORÐUSTA** hangs down column 2, rows 1–7, from the shared **O**, which is `--you` with numeral **1**. Its remaining letters are R1 Ð2 U2 S1 T2 A1 in `--opp` / `--opp-text`.
- **The coral down-chevron** sits on the top edge of the teal O: the §5.2 case of a chevron "over the other seat's letter".
- **Rejected alternatives:**
  - The same geometry recoloured: the loudest line on the English door would be a name English visitors cannot read.
  - Crossing at O on `/`: it reads as a bracket.

**The lockup is a pure image.** It is `role="img"` with no link inside it. The language switch lives once, in the masthead (or in the preference line, A1).

**Sizes.**

| Use | IS | EN |
|---|---|---|
| Desktop door | 72px cells, 504×432 | 64px cells, 384×448 |
| Phone door | 51px cells, 357×306 | 47px cells, 282×329 |

- Rules header: 40px cells.
- Open Graph image (1200×630): 64px cells on `--paper`, with the kicker beneath.
- Minimum size: 24px cells, with numerals off.
- Never print a total, since neither name is a dictionary word.

**Companion marks.**
- **Strip:** the locale's name as one word on ruled cells, with `--ink` letters, a `--tint` band and an `--ink` chevron (the house is not a seat).
  - Used on **pages only**: 22px cells in the desktop masthead, 18px in the phone masthead, 40px in the rules header.
  - Numerals only at 32px cells and up.
  - Field states keep the text wordmark in the ledger caption.
- **Cell** (favicon and app icon, per locale through `generateMetadata`):
  - One cell with a 1.5px `--ink` frame, a 14% `--you` band, and a `--you` **Ð** on `/` or **W** on `/en`. At 48px and up it adds the numeral (2 / 4) and the chevron.
  - **Signals change the letter, not the band.** The letter is full-strength `--opp` while a call or rematch request is pending, and full-strength `--you` while a move is yours in a hidden tab. The `(1)` in the tab title stays the primary signal.
  - It replaces `app/icon.png`.

**Landing composition.** See A1 and F1 for exact positions.
- Column A carries the lockup, the kicker, the 56px headline and the lede.
- Column B carries the name, `enter the lobby ▸`, `here now` and `how it plays`.
- The masthead and folio frame the page as a printed sheet.
- Everything is flush left, with one ink fill.

**Arrival motion.** It plays once per session, tracked by a `sessionStorage` flag wrapped in try/catch. Under reduced motion only the end state shows.
- **0ms:** the masthead, kicker, headline, lede and column B are already painted. The largest paint is text.
- **120ms:** the primary name's letters land in reading order, 60ms apart (`letter-land` 120ms), each with its numeral.
- **About 520ms:** the primary band draws from its chevron (`band-draw` 400ms).
- **About 640ms:** the guest letters land in their reading order, 60ms apart, skipping the shared cell.
- **About 1040ms:** the guest band draws. Everything is done by about 1.45s.
- No loops and no idle motion.

---

## 7. Communication

### 7.1 Presence [must-have · S5]

**Heartbeat.**
- Every signed-in page sends a **per-tab** heartbeat carrying `tabId`, `visibilityState`, `lastInputAt` and `lobbyLanguage`. A player's state is the best state across their tabs.
- The Realtime socket's own heartbeat runs in a worker, so background throttling does not stop it [S6].
- On `pagehide`, a beacon (a POST route; server actions cannot be beaconed) marks the tab `leaving`. If no heartbeat from the same session arrives within **8s**, the player is gone from that tab.
- A reload, the language switch, or closing a second tab therefore changes nothing.

**Constants** (one module shared by client and server, `lib/presence/constants.ts`):

| Constant | Value |
|---|---|
| heartbeat, visible tab | 10s |
| heartbeat, hidden tab | 30s |
| **gone** | no heartbeat for 3 missed beats of the last reported cadence (35s visible, 95s hidden), or a beacon with no new load within 8s |
| **away** | hidden for 2:00 or more |
| queue freshness | a queue heartbeat within 10s (the search poll every 3s, or the socket once S6 is live) |
| recent input (auto-seat) | 30s |
| challenge TTL | 60s |
| table | 20s (45s for queue pairings until S6 is live) |
| table → go | 4.5s |
| rematch TTL | 30s, offered within 2:00 |
| decline cooldown | 60s per pair |
| search check | 3:00, then 30s to answer |
| link TTL | 10 minutes |
| leave cooldown | two `left` voids in 10 minutes → 5 minutes |
| activation guard | 500ms |

**States in lists:**

| State | EN / IS | Shown when | Challengeable |
|---|---|---|---|
| here | `here` / `hér` | any tab visible or hidden under 2:00; not at a table or in a match | yes |
| searching | `searching` / `leitar` | `queue_language` is set | yes (accepting cancels their search) |
| in a match | `in a match · 6 of 10` / `í viðureign · 6 af 10` | a pending or in-progress match, derived from `matches`, never from `players.status` | no |
| away | `away` / `fjarverandi` | all tabs hidden for 2:00 or more | no |
| gone | — | dropped from lists | no |

- Presence is always a mono word, never a coloured dot.
- **In a match bar only:** `stepped out` / `brá sér frá` (the match heartbeat is alive from another app page), `reconnecting · 0:42 left`, and `gone for 2:04`.

### 7.2 Lobby language [must-have · S5]

- **Each player has one lobby language:** the last lobby they entered (`/` or `/en` while signed in), kept in the session and the client store. It is never the locale of the page being read. Reading `/en/rules` does not move an Icelandic player into the English lobby.
- **Lists** show players whose lobby language is this one. The masthead switch on the lobby carries the other lobby's count (`ENGLISH · 7 HERE ▸`).
- **Challenges** are made within one lobby. A player in the other lobby shows on their profile as `in the Icelandic lobby`, with no action. Cross-language challenges are [phase 2 · S19].
- **The Elo shown** is always the rating for the language of the page or lobby, and the language is named beside it.
- **Switching lobby** cancels your search, withdraws your outgoing challenge or link, and answers your incoming challenges `left the lobby`. The consequence line comes first (T3).

### 7.3 Seating and the table [must-have · S3]

**A player is seated when the match is created** if either condition holds:
1. **Their own press created it:** `accept ▸` on a challenge, a rematch or a link, or a send or rematch press that crossed the other player's.
2. **Their tab is visible and `lastInputAt` is within 30s.**

**Anyone else** sees `ready ▸` and has **20s** (queue, challenge and rematch tables). A link table waits for its sender until the link would have expired.

**When the table completes**, `seat_player`:
- writes the board
- sets `started_at` = now + 4.5s and `deadline_at`
- pokes both players

The loader never returns a board before both are seated.

**Void:** the deadline is reached without both players seated, or someone leaves before go.
- Nothing is rated or recorded as history.
- The player who did not sit down becomes `away`, with their search cancelled.
- A seated queue player is requeued at the front (`queued_at` kept).
- Two `left` voids in 10 minutes give a 5-minute cooldown [S12].
- `resignMatch` refuses a pending match. Leaving the table is `leaveTable`.

**Phones** (coarse pointer):
- A Screen Wake Lock is held while searching, while a challenge or link is out, and at the table.
- Going hidden pauses a search (the queue skips the player). On return it reads `search paused · resume ▸`.
- OS notifications are promised on iOS only when the app is installed to the Home Screen [phase 2 · S18].

**Desktop:** a hidden tab keeps searching while its queue heartbeat stays fresh. It is paired only by rule 2's input test at the table, and otherwise gets `ready ▸` with the cue, title and in-page notification.

### 7.4 Challenge lifecycle [must-have · S4]

```
idle ─challenge▸─> composing ─send▸─> sent(60s) ─┬─ accepted ──> table (C1)
                      │                            ├─ declined ──> outcome 4s ─> cooldown 60s (pair) ─> idle
                    not now / Esc                  ├─ expired ───> outcome 4s ─> idle   (`no answer`)
                      ▼                            ├─ withdrawn ─> outcome 4s ─> idle   (withdraw ▸, new challenge, link, search, accept, lobby switch, sign out)
                     idle                          ├─ superseded ─> outcome 4s ─> idle  (`started another match`)
                                                   └─ left ──────> outcome 4s ─> idle   (sender or recipient gone, §7.1)
recipient: incoming(60s) ─accept▸─> table │ ─decline─> gone │ ─expire─> gone
crossed (A→B while B→A pending) ─> table at once, both seated (their own presses)
```

- The recipient may be `here` or `searching`.
- The sender's player status is not changed by sending: the challenge lives only in `match_invitations`.

### 7.5 Server invariants

0. **One way to make a match** [must-have · S2]. Every match is created through `create_match_between`:
   - queue pairing
   - challenge accept
   - crossed challenges
   - rematch accept
   - crossed rematches
   - invite link accept

   It locks both `players` rows in id order and refuses unless neither player has a pending or in-progress match. In the same transaction it clears both players' searches and outgoing challenges, links and rematch requests, and answers their incoming ones `superseded`.
1. **One outgoing challenge per player,** and an invite link counts as one. A new one withdraws the old.
2. **Accepting is a compare-and-set** (`accept_invite`, pending → accepted), then invariant 0. If the sender is no longer free: `Kári can't play right now` / `Kári getur ekki spilað núna`.
3. **Starting a search** withdraws your outgoing challenge or link. **Accepting** withdraws them and cancels your search. **`new opponent ▸`** cancels your outgoing rematch request.
4. **A pairing, an accept or a rematch** answers the player's other pending incoming challenges `superseded`.
5. **Accepting is refused** when the sender is gone (§7.1): `Kári has left · challenge withdrawn` / `Kári er farinn · áskorun fellur niður (?)` → name-safe form `Kári hætti · áskorunin fellur niður (?)`.
6. **A player at a table or in a match** can neither send nor receive.
7. **Blocked pairs** can do neither, silently [phase 2 · S15].
8. **Queue candidates** must have a queue heartbeat within 10s. They are paired in `queued_at` order, oldest first, which is fair and never picks a ghost. [S7]
9. **A table not completed in time is void** (§7.3).
10. **Events are pushed** as payload-free pokes on a per-player Realtime channel: challenge, outcome, table, seat, rematch, link opened. Clients re-read the facts from authenticated routes. No client ever navigates on an id carried in a broadcast; the existing rematch `newMatchId` broadcast becomes a poke. Polls stay as the fallback: 3s until S6 is live, then 10–15s. Invite expiry moves to the 30s cron. [S6]
11. **Rematch requests** are refused after 2:00, when the opponent's match heartbeat is stale, and for void or abandoned matches. A decline or expiry starts the per-pair cooldown. [S8]
12. **`?next=`** accepts only same-origin relative paths that start with `/` (not `//`) and resolve to a known locale-prefixed page. Anything else is dropped.
13. **Signing out** never resigns. It is disabled during a live match. Otherwise it withdraws your challenges and link and cancels your search. [S1]

### 7.6 Reactions [phase 2 · S16]

Presets only, sent as a code and shown in the reader's language.

| When | EN | IS |
|---|---|---|
| At the table (on the slip, once you are seated) | `hi` · `good luck` | `hæ` · `gangi þér vel` |
| After the match (result slip, or the ledger on a phone) | `good game` · `well played` · `bye` | `góð viðureign (?)` · `vel spilað` · `bless` |

- **Never while the clock runs.**
- **Display:** a 3s suffix on the sender's sub-line (`· says good luck` / `· segir gangi þér vel`). It never replaces facts. Announced politely.
- **Controls:** buttons of 32px on desktop and 44px on phones, at most three per row, in a fixed order, with no `▸` (they say something; they do not move you).
- **Limits,** enforced by a server action counting in `match_logs`: one every 5s and three per phase. Extra taps do nothing.
- **`mute reactions`** in `⋯` hides them for the session.
- **No** emoji, no free text, and no reaction phrased as a rematch request.

### 7.7 Notification rules

- **Tab title** follows the beat:
  - `(1) Kári challenges you · wottle` / `(1) Kári skorar á þig · orðusta`
  - `searching 0:07`
  - `challenge sent · 0:41`
  - `Kári · opponent found`
  - `3 · Kári`
  - `3:12 · move 4`
  - `Birna wins`
  - `(1) Kári asks for a rematch`
  - `review · Birna – Kári`
- **Favicon:** the letter changes colour (§6).
- **Sound** (respects the toggle; browsers allow it only after the page's first user gesture):
  - A new `challenge` cue (two notes) for an incoming challenge, an incoming rematch, a link opened, and a table waiting in a hidden tab.
  - `match-start` plays at go.
  - There is no sound for outcomes or errors.
- **OS notifications:**
  - Opt-in only, from `⋯ notifications · on`, from `tell me when someone is here ▸`, or from the first search (`tell me when found ▸`). Never on page load.
  - Delivered by the in-page Notification API while the page runs and the tab is hidden, for: incoming challenge, table waiting for you, link opened, rematch request.
  - Delivery when the page is not running (Web Push, including installed iOS web apps) is [phase 2 · S18].
- **Nothing interrupts a live match.**

### 7.8 Safety and rematch etiquette

**Identity** [must-have · S1].
- This browser claims your name with a year-long device key (httpOnly), bound to `players.claim_hash`.
- The session cookie is HMAC-signed.
- A claimed name typed in another browser reads `that name is taken · pick another`.
- An expired session renews silently from the device key.
- Existing players are claimed by the first browser that enters after the migration.
- A recovery code, and a 30-day reservation of an old name after a rename, are [phase 2 · S15]. Until then the door says `this browser keeps your name`.

**Block, mute, report and names** [phase 2 · S15].
- **Block** (public profile foot): mutual invisibility in lists; neither can challenge the other; the queue never pairs them; any pending rematch is disabled.
- **Mute** (the call line's `⋯`): auto-declines that player's challenges for the session.
- **Report name** (profile foot, review `⋯`) goes to a moderation log.
  - Reports count only from names with 5 or more rated matches, older than 24 hours.
  - A name is hidden only after manual review.
- **Block and the decline limit** attach to the device-key identity, so a new name does not escape them.
- **Name blocklist,** Icelandic and English, at sign-in and on rename.

**Rate limits,** counted from rows so they hold across serverless instances [must-have · S4]:
- `lobby:invite` 6 per minute.
- A 60s per-pair cooldown after a decline.
- After three declines from the same challenger within 10 minutes, that challenger's further challenges to you are not delivered for the session (they read `declined`).

**For minors:** no last-seen times, no direct messages, and no following.

**Rematch etiquette** [must-have · S8]:
- Offered only while both players are on this match's result or review, and within 2:00 of the end.
- One request per match. After a decline or expiry, `rematch ▸` is gone for both, and `challenge again ▸` shows the cooldown.
- Requests last 30s, with a visible drain bar and `cancel ▸`.
- An incoming request never raises a lifted slip: it becomes the ledger's first line.
- Crossed requests start the match at once.
- After an accept, both bars carry the series: `match 2 · Birna 1–0` / `viðureign 2 · Birna 1–0` (from `walkRematchChain` / `deriveSeriesContext`).
- A match opened later offers `challenge again ▸` instead of a rematch.

### 7.9 Server work by phase

**Must-have (first build).**

| # | Work |
|---|---|
| S1 | **Identity.** HMAC-signed session cookie; device-key cookie and `players.claim_hash`; `name_taken`; silent renewal; the returning door; sign-out no longer resigns (`logout.ts` `resignActiveMatch` retired). |
| S2 | **`create_match_between(a, b, language, origin, ref)` and `accept_invite(invite, actor)`.** The queue claim, challenge accept, crossed challenges, rematch accept, crossed rematches and link accept all call it. |
| S3 | **The table.** `matches.player_a_seated_at`, `player_b_seated_at`, `table_deadline_at`, `origin`, `void_reason`, `voided_by`. `seat_player` (CAS; writes the board; `started_at` = now + 4.5s). `start_match_if_ready` stops starting on heartbeat or grace, and the loader stops calling it. The loader returns no board before both are seated. `find_due_tables()` in the 30s cron plus a lazy loader check. `ended_reason` widened with `'void'`. `resignMatch` refuses pending. `leaveTable`. `MatchState.table {seats, deadlineAt, origin}`. |
| S4 | **Challenges.** Statuses `withdrawn`, `superseded`, `left`. No sender status write. Recipients `available` or searching. `withdrawInvite` plus a beacon POST route. A reverse pending challenge → create. `PLAYTEST_INVITE_EXPIRY_SECONDS=60`. Cooldown and limits counted from rows. `getOutgoingInvite` returns `match_id` when accepted. |
| S5 | **Presence.** Per-tab heartbeat (`tabId`, `visibilityState`, `lastInputAt`, `lobbyLanguage`). `lobby_presence.hidden_since`, `leaving_at`. The constants module. Derived states. Presence, inbox and search providers moved to `app/[locale]/layout.tsx`. The match heartbeat from any app page. `/api/match/active` extended with the opponent, move count, deadline and completed-while-away. |
| S6 | **Push.** A `player:{id}` Realtime channel with payload-free pokes; the socket heartbeat in a worker; the rematch broadcast becomes a poke; polls slow to 10–15s once live; invite expiry in cron. |
| S7 | **Queue.** `players.queued_at`; the 10s freshness filter; queued_at order; phone pause on hidden; the 3:00 check; requeue at the front after a void. |
| S8 | **Rematch.** `MatchState.rematch {status, requesterId, createdAt, newMatchId}` for completed matches; the 2:00 window; the heartbeat check; accept via S2; cooldown after decline or expiry; void and abandoned matches refused. |
| S9 | **Review.** `GET /api/match/:id/moves` (one select by `global_seq`, joined to the word entries; public for completed matches); read-only render without a session; the synthetic time step; `?review=` on the match page; `/summary` → `?review`. |
| S10 | **Lobby overview.** `GET /api/lobby/overview?language=` (here, searching and playing counts for this and the other lobby; the viewer's last match for the band map; the last ten for the form strip); a language filter on the stats route; `getRecentGames` excludes void and abandoned. |
| S11 | **Invite links.** `match_links(token_hash, sender_id, language, expires_at, used_at, match_id)`, single use by CAS; the GET renders only; the POST accepts via S2; counts as the sender's outgoing challenge. |
| S12 | **Table-leave cooldown**, counted from `left` voids. |
| S13 | **Rules document amendments** in the same PR (§8b). |

**Phase 2.**

| # | Work |
|---|---|
| S14 | Head-to-head aggregate RPC per pair and language (record column, C1 record line, E2 head-to-head). |
| S15 | `player_blocks`, `name_reports` (eligibility, manual review), name blocklist, session mute, rename (`renamed_at`, 30-day reservation), recovery code. |
| S16 | Reactions: a `sendReaction(matchId, code)` action that checks the phase window and count in `match_logs`, then pokes. |
| S17 | Best-here hints: a background job after completion fills `match_move_hints(move_id, best_swap, best_points)` under a per-step time budget, pruned to swaps that touch cells able to finish a word. |
| S18 | Web Push: service worker, subscription table, VAPID keys. |
| S19 | Cross-language challenges: the match takes the invite's language, and the spec 060 redirect sends the player to its locale. |
| S20 | Newcomer features (practice field, provisional ratings, newcomer pairing), pending §10 Q8. |

**Deferred (no phase yet):** watching live matches, following players.

---

## 8. Design-system amendments (WOTTLE_DESIGN_SYSTEM.md)

1. **§1.7 and §10: "One room" becomes "One field".**
   - From the moment you sit down until you leave the review, the field never remounts, and every change is a state in place. Review is `?review=n` on the match page.
   - A page is added only where there is no field. There are three pages (`/` door or lobby, profile, rules), each on the room's grid with a masthead, a line slot and a folio.
   - §10's "no number outside the bars and the ledger" is scoped to field states.
   - *Rationale:* orientation, the social surface, and the owner's flow sketch.
2. **§1.1 and §5.9: slip kinds.**
   - Sign in is retired; the door replaces it. **Ready** (C1), **void** (C3) and **leave** (C7) are added.
   - The ranking becomes match over > end early > resign > leave > ready or void.
   - The slip stays the only thing ever placed over the field.
   - A match-over slip is never raised again by the game once lifted.
   - *Rationale:* the ready handshake; a Back that does not leave the site; the Space-key accept (Review log S-1).
3. **§5.5 and §9: primary and focus.**
   - One primary per screen: its most time-sensitive decision.
   - **A wait has no primary.** Its exit is a secondary, placed away from the control that started the wait, and never focused.
   - **A slip the game raises** (ready, void, end early, match over) **focuses its headline** (`tabindex="-1"`; `useFocusTrap` honours `initialFocusRef` for it).
   - **A slip the player opens** (resign, leave) focuses its safe action.
   - **Destructive** means it forfeits the viewer's own match: resign is; leave is not (the match continues); end early is not (the normal rules decide it, and it costs the viewer nothing).
   - **Precedence** when states combine: slip > line-slot call > composer send > page primary. Whatever loses is drawn as a secondary. An incoming rematch outranks a third-party challenge.
   - `▸` means the action moves you forward, commits you or opens something. A bare word dismisses, leaves or says something. Each action appears once per screen.
   - **Activation guard:** a control that appears or changes meaning ignores activation for 500ms.
   - **Target floor:** every control on a phone has a 44×44 hit area; on desktop at least 24×24 with 8px between targets.
   - Page primaries are 48px tall.
   - *Rationale:* Verdict #8 and #11; reviews S-1, S-3, S-4, S-10.
4. **§4 and §5.9, phone slip:** exactly the field's square; it never crosses the bars. Each slip's content has a phone budget (F4, F5, F8), and what does not fit moves to the ledger below. *Rationale:* Verdict #7.
5. **§3 type: a display tier.**
   - The ladder: 11 label · 13 table numeral · 15 body and names · 17 live row and bar names · 22 title · 28 headline · 40 display-2 · 56 display-1 (32 on phones; the phone door uses 30).
   - Zilla 600, −0.01em, at 40px and above. Sentences are Zilla 500 at 15/17 in sentence case. Mono capitals are for labels and actions only. All-caps Icelandic needs a line-height of at least 1.15.
   - The name is set in field capitals when it is a word on cells (lockup, strip, cell), and lowercase otherwise.
   - *Rationale:* the non-match screens have no hierarchy today.
6. **§2 colour: no new values; seat colour on pages.**
   - `--you` marks only the viewer's own data.
   - `--opp` marks another player only where they are set against the viewer: the call line, the table, a shared match's score, head-to-head, and their public profile.
   - Every other name on a page is `--ink`.
   - Every seat-coloured string below 17px uses the text variant (`--opp-text`).
   - The door lockup uses both seat colours, with the visitor's language as "you"; the shared letter follows spec 049.
   - The player square is 12px, or 16px only beside a name of 40px or more.
   - Listed uses: masthead square, lobby block square, call line and table squares, form-strip win bars, verdict and score lines, public profile.
   - The `#B9B4A6` exception is unchanged.
7. **§5 new components,** all in existing tokens:
   - page frame (masthead, sticky line slot, folio)
   - line slot (call style and status style, with a 4px drain or sweep)
   - lobby block (a bar at 40px)
   - **form strip** (ten ruled 20px cells with result letters; not a lane)
   - **band map** (10×10 rules plus bands, no frame, no letters)
   - word strip (best words)
   - composer row
   - lockup, strip and cell marks
   - review scrubber (the clock-block frame, a slider) and lead chart (§5.8 grammar)
8. **§5.1 letter states.**
   - Add **last moved:** a 2px seat-colour tick on the bottom edge of the mover's two most recent cells, cleared when the letter freezes.
   - Add, for review only, **best here** [phase 2]: a 1.5px dashed band outline (the dash is the existing empty-seat outline).
   - *Rationale:* the opponent's misses and swaps are currently invisible.
9. **§5.4, §7 and §8 live row.**
   - A `missed` beat.
   - A computed stakes line under 1:00.
   - The pace replaces `match clock` while a move is yours.
   - `pick cleared`, refusals and your own connection state are drawn on line 2, not as notices.
   - A `starting` clock phase with the 56px numeral.
   - Illegal picks name the word.
   - Line 2 never wraps at 1440.
   - The reveal hold is unchanged at every clock value.
10. **§4 phone.**
    - The foot (`⋯` plus the state's actions) is pinned to the bottom edge with the safe area and is always visible.
    - The ledger block compresses in order: territory, then the clock to a 32px strip, then line 2 into the sheet.
    - The sheet sits between your bar and the foot, with the clock pinned as a 32px strip.
    - Field states never scroll; pages may.
    - Visual fixtures at 390×844, 390×664 and 360×640.
11. **§5.3 bars.** Add these sub-line states:
    - at the table: `on the way` / `ready` (`á leiðinni` / `við borðið`)
    - your own `offline · reconnecting`, with an outlined lane
    - `stepped out`
    - an opponent's `gone for 2:04`, which replaces the frozen `0:00 left`
    - a reaction suffix (never replacing a fact) [phase 2]
    - the series line

    Lane `aria-valuetext` becomes "7 of 10 moves left" (§9 aligned to the code).
12. **§6 motion.**
    - **Time is not motion:** drain bars, the 3·2·1 count and the clock step once a second under reduced motion.
    - Page turn: a 150ms cross-fade; masthead, line slot and folio fixed.
    - The lockup arrives once per session.
    - Table letters land row by row.
    - Sounds: `challenge` is added and `match-start` is wired at go.
    - The previous proposal to skip reveals under 0:15 is withdrawn.
13. **§8 copy.**
    - **An Icelandic glossary** using the owner's words: mótspilari, lobbí, leiðbeiningar, samþykkja / hafna, vann (final state), `annan leik? ▸` (the one question-form action, §10 Q2), skráning óþörf, nafn, viðureign = match, leikur = move, yfirferð = review, `ég er til ▸`, `við borðið`, `brá sér frá`, `án tengingar`.
    - **The name-safe rule:**
      - In Icelandic a name appears only in the nominative, never after eftir, gegn, til, frá, á, við or handa.
      - A player never takes a gendered adjective, participle or pronoun. No `klár`, `farinn`, `tengd`, `laus`.
      - Genitives are written `síðasti leikur · Kári`.
    - **A grep test for banned variants,** including `klár`, `komin(n)`, `aftur tengd`, `ekki laus`, `leikur Kára` and every `til|eftir|gegn|við|frá <Name>` template.
    - Retire every string listed in §5 as replaced.
    - Language is stated wherever data is per language.
    - **§5.7 "one input exists"** becomes "one input per page": the door's name, and the profile rename [phase 2].
    - The 30s challenge notices and `challenge sent · waiting for <name>` are replaced by the line slot's states.
    - Terms and counts are built from config, never from literals.
14. **§9 accessibility.**
    - Landmarks (banner, main, contentinfo) and one `h1` per page.
    - The line slot is a region with polite arrival and 10s-left announcements. It never steals focus, and a skip link leads to it while a call is up.
    - The composer moves focus to send.
    - At go, focus moves to the field and line 1 is announced.
    - The review scrubber is a slider that owns the step keys.
    - The ledger is one composite widget with a roving tabindex; its cells pin bands in a match and jump in review.
    - Review controls carry words (desktop) or `aria-label`s (phone). Autoplay can always be paused.
    - A polite region for the opponent's moves.
    - Name input errors set `aria-invalid` and live in a polite region.
    - The unused hover hint is deleted.
15. **Fixtures and tests.**
    - Add phases: `door`, `is-door`, `door-returning`, `door-invite`, `lobby-signed-in`, `lobby-empty`, `composer`, `challenge-sent`, `challenge-in`, `searching`, `table`, `starting`, `void`, `missed`, `leave`, `rematch-in`, `review`, `profile-public`.
    - Phone versions of each, plus `phone-match-664` and `phone-match-360`.
    - Deal English boards from the English pack. Totals are derived from rows.
    - A slot-overflow test renders every fixed slot with its longest IS and EN string.
    - Delete the orphan `landing-visual-*` baselines.
    - The folio carries the place only (no colophon, no ©).
    - The ledger caption keeps the text wordmark; the strip is for pages.

**8b. Rules document (`docs/prd_and_requirements/wottle_game_rules.md`), same PR** [must-have · S13]:
- **§2a:** "Every outcome is rated" becomes "Every match that starts is rated. A table where both players do not sit down within 20s, or that a player leaves before go, is void: not a match, no rating, no history, no rematch."
- **§12**, rows amended:
  - *Match over:* two action rows, headline focus, the detail by reason, reactions [phase 2].
  - *Clock:* the `starting` phase with the 56px count.
  - *Frozen tile:* the live row names the word.
  - *Scoring:* the `missed` beat.
  - *Reconnection window:* `gone for m:ss`, `stepped out`, and end early with headline focus.
  - *Resigning:* `keep playing ▸` is primary and focused.
  - *Every match is rated:* void excluded.
- **§12**, rows added: *The table* (seating, 20s, void) and *Review* (steps in receipt order, refused steps, the time step, best here [phase 2]).
- **§12 letter states:** add *last moved*.

---

## 9. Artboard list

All artboards use the eight tokens and Zilla Slab + Red Hat Mono, with the fixture sets from §5.0. Phase 2 elements are drawn with a small `phase 2` margin note.

| # | File | Title | Size | Locale · fixture | Shows | Flow row |
|---|---|---|---|---|---|---|
| 1 | `FlowMap.dc.html` | New flow | 1440×900 | en | Pages row (Door/Lobby, Profile, Rules) above the field row (Table → Starting → Match → Result → Review), with T-numbered arrows, nav vs in place, the void, leave and requeue branches, and the line slot as the thread between pages | Overview |
| 2 | `DoorIs.dc.html` | Door · Orðusta | 1440×900 | is · IS-T1 | A1: ORÐUSTA × WOTTLE lockup (72px), headline, name, `inn í lobbíið ▸`, `þessi vafri geymir nafnið þitt`, here now | A · Entry |
| 3 | `DoorEn.dc.html` | Door · wottle | 1440×900 | en · EN-L | A1: WOTTLE × ORÐUSTA crossing at O (64px) | A · Entry |
| 4 | `DoorReturning.dc.html` | Door · returning | 1440×900 | en | A1 returning: `WELCOME BACK · Birna`, `enter the lobby ▸`, `not Birna? · use another name` | A · Entry |
| 5 | `DoorInvite.dc.html` | Door · invite | 1440×900 | en · EN-L | A2: `Kári challenges you` band, `accept ▸` | A · Entry |
| 6 | `Lobby.dc.html` | Lobby | 1440×900 | is · IS-T1 | B1: Birna block, form strip, here-now table (6 rows), band map, recent matches, terms in the empty line slot | B · Lobby |
| 7 | `LobbyEmpty.dc.html` | Empty lobby | 1440×900 | en · EN-L | B1 empty: `invite a friend ▸` primary, `find an opponent ▸` secondary, `tell me when someone is here ▸` | B · Lobby |
| 8 | `LobbyComposer.dc.html` | Challenge composer | 1440×900 | en · EN-L | B2: Embla's row open, `win +9 · draw +1 · loss −7`, `send challenge ▸`, find demoted | B · Lobby |
| 9 | `LobbySent.dc.html` | Challenge sent | 1440×900 | en · EN-L | B3/B4: line slot `Challenge sent · Kári · 0:52 · withdraw ▸` with drain; Kári's row `sent · 0:52`; Hekla `declined · again in 0:41`; no filled primary | B · Lobby |
| 10 | `LobbyIncoming.dc.html` | Incoming challenge | 1440×900 | is · IS-T1 | B5: line slot `Kári skorar á þig · 0:47`, accept as primary, find demoted, skip link shown in focus | B · Lobby |
| 11 | `LobbySearching.dc.html` | Searching | 1440×900 | en · EN-L | B7: line slot `Searching for an opponent · 0:07 · cancel ▸` with sweep, empty primary slot, live table | B · Lobby |
| 12 | `Table.dc.html` | Opponent found | 1440×900 | is · IS-T0 | C1: ready slip over the empty field, `Kári · á leiðinni · 0:14`, stakes, `ég er til ▸`, headline focused | C · Table & match |
| 13 | `Starting.dc.html` | Starts in 2 | 1440×900 | en · EN-M | C2: 56px `2` in the clock block, letters landing, Kári `ready · says „good luck“` (phase 2) | C · Table & match |
| 14 | `Match.dc.html` | Match · your move | 1440×900 | is · IS-M step 9 | C4: `leikur 4 · þú átt leik`, last-moved ticks, `≈27 sek á leik`, totals 51–24 | C · Table & match |
| 15 | `MatchLastMinute.dc.html` | Last minute | 1440×900 | en · EN-M | C4: 0:48 tinted clock, `≈16s a move`, stakes line `3 moves left · −15 if unplayed`, no reactions | C · Table & match |
| 16 | `ResignSlip.dc.html` | Resign | 1440×900 | en · EN-M | C6: `keep playing ▸` primary and focused, `yes, resign ▸` secondary, `−9` | C · Table & match |
| 17 | `Disconnect.dc.html` | Opponent gone | 1440×900 | en · EN-M | C8: Kári `gone for 2:04`, outlined lane, live row `Kári is gone · end the match ▸` (secondary) | C · Table & match |
| 18 | `Void.dc.html` | No match | 1440×900 | en · EN-L | C3: `Kári did not sit down · nothing was rated · you are back in the queue · cancel ▸` | C · Table & match |
| 19 | `Result.dc.html` | Match over | 1440×900 | is · IS-M final | D1: `Birna vann 134–88`, detail, ratings ±8, two action rows, headline focused, reactions (phase 2) | D · End |
| 20 | `RematchIncoming.dc.html` | Rematch asked | 1440×900 | en · EN-M final | D2: review field with the ledger's first line `Kári asks for a rematch · 0:24 · accept ▸`, no slip | D · End |
| 21 | `Review.dc.html` | Review · step 7 | 1440×900 | is · IS-M step 7 | D3: board at step 7, scrubber `skref 7 af 20 · 3:31`, labelled controls, cursor line `LEK · ÆSKU +33`, future cells in `--muted`, lead chart | D · End |
| 22 | `ProfileOwn.dc.html` | Profile · Birna | 1440×900 | is · IS-T1 | E1 with Embla's call in the line slot: 56px name and 1212, chart, record 20–15–0, best-word strips | E · Pages |
| 23 | `ProfilePublic.dc.html` | Profile · Kári | 1440×900 | en · EN-L | E2: `here now`, `challenge ▸`, head-to-head 2–1 (phase 2), block and report (phase 2) | E · Pages |
| 24 | `PhoneDoorIs.dc.html` | Phone door | 390×844 | is · IS-T1 | F1: 51px lockup, 3-line headline, name, inline primary | F · Phone |
| 25 | `PhoneDoorEn.dc.html` | Phone door · en | 390×844 | en · EN-L | F1: 47px lockup | F · Phone |
| 26 | `PhoneLobby.dc.html` | Phone lobby | 390×844 | is · IS-T1 | F2: pinned call line from Kári, block, two-line rows, pinned primary hidden | F · Phone |
| 27 | `PhoneComposer.dc.html` | Phone composer | 390×844 | is · IS-T1 | F6: Embla's row open at 176px; inset: sent state in the bottom slot | F · Phone |
| 28 | `PhoneTable.dc.html` | Phone table | 390×844 | is · IS-T0 | F5: slip in the field square, facts in the ledger below | F · Phone |
| 29 | `PhoneMatch.dc.html` | Phone match | 390×844 | en · EN-M | F3: live row with a notice on line 2, clock block, pinned foot with `⋯` | F · Phone |
| 30 | `PhoneMatchShort.dc.html` | Phone match · short | 390×664 | en · EN-M | F3 compressed: territory hidden, 32px clock strip, pinned foot | F · Phone |
| 31 | `PhoneResult.dc.html` | Phone result | 390×844 | is · IS-M final | F4: slip exactly the field square, bars visible, negotiation band, reactions below (phase 2) | F · Phone |
| 32 | `PhoneReview.dc.html` | Phone review | 390×844 | is · IS-M step 7 | F7: scrubber strip, cursor line, pinned step controls, `◂ úrslit` | F · Phone |

---

## 10. Open questions for the product owner

1. **Native review.** Answered 23 September 2026 by the product owner:
   - The gloss is `orð + orusta`, the spelling inside Orðusta.
   - `ég er til ▸` (ready) and `við borðið` (seated): approved.
   - `yfirferð` = review: approved. The action is `yfirfara viðureignina ▸` (was `fara yfir viðureignina ▸`).
   - `án tengingar í 2:04` and `brá sér frá`: approved. `hvorugt lauk` becomes `hvorugt kláraði`.
   - `ekkert var reiknað til Elo` becomes `hefur ekki áhrif á Elo stig`.
   - Still open: the door headline and lede, `góð viðureign` for good game, and every other string marked (?).
2. **`annan leik? ▸`.** In this product *leikur* means a move, so `annan leik?` can read as "another move?". Keep it as the one question-form action (it is your wording), or use `önnur viðureign? ▸` or `aftur ▸`?
3. **Door privacy.** Should signed-out visitors see the real names of players online (social proof), or only the count?
4. **`confirm moves`.** It ships off by default, respecting the 22 September removal of the move preview. Should it default to on for touch screens, where a slide across a 35px cell border can play a move?
5. **Identity recovery** [phase 2 · S15]. Until it ships, clearing cookies loses your name. Is a one-time recovery code enough, or do you want an optional email link?
6. **Watching live matches.** Deferred. It needs a read-only view from one player's seat and an `allow watchers` switch. In scope for the public beta?
7. **Following players.** Deferred. Wanted, given it must stay silent and have no direct messages for minors?
8. **Newcomers** [phase 2 · S20]: provisional ratings for the first five matches (`1200?`), newcomers paired with each other in the queue, and a practice field. The practice field would be its own unrated field state, not part of the lobby. Yes or no for each?
9. **Best here in review** [phase 2 · S17]. A background job with a time budget per step. Acceptable cost, and should review wait for it?
10. **Timings.** Please confirm: challenge 60s; table 20s; rematch 30s within a 2:00 window; 60s decline cooldown; 3:00 search check; a 5-minute cooldown after two table leaves.
11. **Cross-language challenges** [phase 2 · S19]. Should an Icelandic player be able to challenge someone in the English lobby, with the match played in the challenger's language?
12. **Background search on desktop.** Should a hidden desktop tab keep searching (the current spec, with `ready ▸` at the table unless there was recent input), or pause like phones do?
13. **Brand casing in prose.** Write "Orðusta" and "Wottle" capitalised at the start of a sentence, or keep lowercase `wottle` everywhere and say so in design system §3?

---

## Appendix: Review log

Critical and major issues from the three reviews. **R** = resolved as proposed. **M** = resolved with a modification (reason given). **X** = rejected (reason given).

| # | Critic · severity | Issue | Outcome | Where |
|---|---|---|---|---|
| 1 | system · critical | Unrequested slips focus a committing button; a re-raised rematch slip accepts on Space | R. Game-raised slips focus the headline; 500ms guard; the rematch is a ledger line and never re-raises; `useFocusTrap` change specified | §2 P2, §5.0 guards, D1, D2, T41, §8.2–8.3 |
| 2 | player · critical | No identity; anyone can type your name | R [must-have · S1]. Device key and claim hash, signed cookie, `name taken`, returning door; recovery [phase 2] | A1, §7.8, §7.9 S1, Verdict #2 |
| 3 | player · critical | A visible tab is treated as a present person | R. Auto-seat needs a visible tab and input within 30s; a search check at 3:00 | §3, §7.3, B7, T59 |
| 4 | player · critical | Rematch and link paths bypass the invariants | R [must-have · S2]. Invariant 0: one `create_match_between`; commitments cancel each other | §7.5 inv. 0–4 |
| 5 | feasibility · critical | Server has no seating; the clock starts on heartbeat or grace | R [must-have · S3]. Seat columns, `seat_player`, void cron, `leaveTable`, pending resign refused | §7.3, §7.9 S3 |
| 6 | feasibility · critical | No path checks that both players are free | R [must-have · S2] | §7.5 |
| 7 | feasibility · critical | Safety features rest on an untrusted identity | R. S1 must-have first; block, report and rename moved to [phase 2 · S15] with anti-abuse rules | §7.8 |
| 8 | system · major | C8 contradicts the destructive-slip rule | M. End early is defined as not destructive (it costs the viewer nothing); it stays primary with headline focus. The live row draws it as a secondary. | C8, §8.3 |
| 9 | system · major | Wait exits drawn as a filled primary in the same slot | R. Waits have no primary; exits are secondaries, moved and unfocused; 500ms guard | §2 P2, B3, B7, C1, D2 |
| 10 | system · major | Combined states give two primaries | M. Precedence table. The composer stays open with send demoted, rather than closing, so nothing shifts under the pointer. B8 removes find. | §8.3, B2, B5, B8 |
| 11 | system · major | Future review cells in `--rule` ink | R. `--muted`, named "not yet reached" | D3 |
| 12 | system · major | Reduced motion empties the drains and skips the count | R. Time is exempt | §4, §8.12 |
| 13 | system · major | Phone frames assume 844px of layout | R. A compressing layout, pinned foot, safe areas, 664 and 640 fixtures | §5.0, F3, §8.10 |
| 14 | system · major | Phone slips overflow; phone specs missing | R. F4 budget, plus F5–F9 added | §5 F4–F9, §9 |
| 15 | system · major | Fixed widths cannot hold their strings | R. Outcomes moved to the status cell and the line slot; B7 moved to the slot; slots sized from the longest string; review foot trimmed into `⋯`; overflow test | B1, B3, B7, D3, §8.15 |
| 16 | system · major | Targets under 44px on phones and 24px on desktop | R. Target floor; 44px phone masthead; reaction rows; phone `⋯`; 44px review controls | §8.3, §5.0, F2, F7 |
| 17 | system · major | The call line is not fixed; M7 shifts content | R. Sticky reserved slot on desktop, pinned bottom slot on phones, skip link, guard | §5.0, M7, B5, F2 |
| 18 | system · major | Reactions during the clock hide facts and sit by the field | R. Removed from the clock phase; received reactions are a suffix | C4, C5, §7.6 |
| 19 | system · major | A lobby mini-field contradicts principle 1 | R. Band map, labelled `role=img` inside a named link | B1, §8.7 |
| 20 | system · major | Form lane reuses the moves lane; losses fail contrast | R. Form strip of result letters with seat-colour win bars | B1, §8.7 |
| 21 | system · major | "The lockup is the only page use of seat colour" is false | R. Rule restated and uses listed | §8.6 |
| 22 | system · major | A link inside `role=img`; three language switches; the current language looks like a link | R. Pure image; one switch (the preference line replaces it, never adds a second); `aria-current` without underline | A1, §6 |
| 23 | system · major | Global review keys collide; 20 tab stops; unlabelled glyphs; autoplay without pause | R. Keys scoped to the slider; roving tabindex; worded controls; pause | D3, §8.14 |
| 24 | system · major | Auto-seat by visibility; focus undefined at go | R. The input rule; focus to the field at go | §7.3, C2 |
| 25 | system · major | Icelandic copy breaks the name-safe rule | R. Rewritten (`síðasti leikur · Kári`, `tenging komin aftur`, `ég er til`, `við borðið`, `Kári getur ekki spilað núna`); grep list extended | C4, C8, C1, §7.5, §8.13 |
| 26 | player · major | Ghost loop after a void | R. The absent player goes away; the seated player is requeued at the front | C3, §7.3 |
| 27 | player · major | Dodging at the table | R [must-have · S12]. Who left is recorded and shown; cooldown after two leaves | C3 |
| 28 | player · major | A misclick accepts into a rated match | R. Guard; `leave` and Back void until go | §5.0, T28 |
| 29 | player · major | A re-raised slip steals focus | R (see #1) | D2 |
| 30 | player · major | Stepping out counts as a disconnection | R [must-have · S5]. App-wide match heartbeat; `stepped out` | C7, C8, B8 |
| 31 | player · major | Heartbeat thresholds contradict each other | R. One constants table; gone after 3 missed beats | §7.1 |
| 32 | player · major | pagehide fires on reload, language switch, second tab | M. Per-tab presence and an 8s grace. The switch is not hidden; it shows a consequence line (following the system review). | §7.1, T3 |
| 33 | player · major | Presence and challenges per language unclear | R. The lobby-language model; cross-language [phase 2 · S19]. The `also here in` line is dropped because the masthead switch already carries the count (one action). | §7.2 |
| 34 | player · major | Outgoing challenge does not follow you | R. The line slot carries it on every page | B3, §5.0 |
| 35 | player · major | Empty lobby is a dead end | M. Invite link shipped in v1 and promoted to primary when empty; notification opt-in. X for a practice field in the lobby: it brings back the field-before-sitting confusion and needs server scoring. It is §10 Q8. | B1 empty, B9 |
| 36 | player · major | Invite link fails when the sender's tab is hidden | R. A link table waits until expiry; own-link and locale cases handled | A2, B9, T63–T64 |
| 37 | player · major | Phones break hidden-tab signals | R. Wake Lock, `keep this screen open`, pause on hidden, no iOS promise | §7.3, F2 |
| 38 | player · major | Sign out can silently resign | R. Disabled in a match; consequence line otherwise; `resignActiveMatch` retired | B1, §7.5 inv. 13 |
| 39 | player · major | Phone states missing | R (see #14) | F5–F7 |
| 40 | player · major | T40 seats both unconditionally | R. The same seating rule | T40 |
| 41 | player · major | Reports can be faked with throwaway names | R [phase 2 · S15]. Eligibility, manual review, device-key identity | §7.8 |
| 42 | feasibility · major | All signals are throttled polling | R [must-have · S6]. Per-player pokes, worker heartbeat, 45s table fallback until live; Web Push [phase 2] | §7.5 inv. 10, §7.1 |
| 43 | feasibility · major | The status model cannot express the lifecycle | R [must-have · S4] | §7.4, §7.9 |
| 44 | feasibility · major | The board is served during the table | R. Withheld until both are seated; written by `seat_player` | C1, §7.3 |
| 45 | feasibility · major | A review sibling route remounts and cancels the rematch | R. `?review=` on the same page | D3, §2 P1, §3 |
| 46 | feasibility · major | Rematch state only on broadcast; window unenforced | R [must-have · S8] | D2, §7.5 inv. 11 |
| 47 | feasibility · major | Review data read path, signed-out access, penalties, step count | R [must-have · S9] | D3 |
| 48 | feasibility · major | Best-here cost underestimated | R. [phase 2 · S17] background job; review ships without it | D3, §10 Q9 |
| 49 | feasibility · major | Heartbeat language moves players between lobbies | R. Lobby language, not page locale; B5 suffix dropped | §7.2 |
| 50 | feasibility · major | The server lacks presence data | R [must-have · S5] | §7.1, §7.9 |
| 51 | feasibility · major | 20s `left` threshold equals the interval | R. At least 3× the interval; queue keeps 10s | §7.1 |
| 52 | feasibility · major | Void contradicts "every outcome is rated" | R. Rules §2a and §12 amended in the same PR; void filtered out of history | §8b, C3, S10 |
| 53 | feasibility · major | Skipping reveals under 0:15 contradicts rules §2 | R. Dropped | §3, §8.12 |
| 54 | feasibility · major | Public channels allow spoofing | R. Payload-free pokes; reactions through a server action [phase 2 · S16]; no navigation on a broadcast id | §7.5 inv. 10, §7.6 |

**Minor issues, all resolved:**
- **Amendments and folio:** amendments list completed; folio cut to the place name; caption wordmark kept.
- **Copy:** `pick a second letter`, `gone for 2:04`, `in your colour`, one enter string, the `▸` rule, fixed reaction order.
- **Colour:** coral text floor.
- **Favicon:** the letter changes colour, not the band.
- **Row order:** frozen under the pointer and focus.
- **Rules tab and guard:** `close this tab ▸`; the guard pushed on the first pick.
- **Door form:** accessibility and landmarks.
- **D1 detail line:** says why the match ended.
- **B8:** covers a match ended while away.
- **B6 vs F4 precedence:** rematch first, then third-party challenge.
- **C4 `⋯`:** `go to the lobby` kept, opening C7.
- **Guard after completion:** disarmed.
- **Rematch decline:** starts the pair cooldown.
- **C3 actions:** follow the table's origin.
- **Stakes line:** computed with `timeoutPenalty`.
- **Sound:** unlocks after the first gesture.
- **Fixtures:** made consistent (IS-T0 → IS-M → IS-T1; English matches use English words; word scores recomputed from the packs: BORÐ 23, GILT 18, SKÓ 11, LEK·ÆSKU 33, BORÐA 29).
- **`?next=`:** validation.
- **Read models:** S10, with head-to-head [phase 2 · S14].
- **T16 trigger:** `getOutgoingInvite` returns `match_id`.
- **Invite expiry:** moved to cron.
- **Queue order:** by `queued_at`.
- **Handles:** `@kári`.
- **Terms:** built from config.
- **C2:** `started_at` = the moment the table completes + 4.5s.
- **Coral in the lockup at small cells:** `--opp-text`.
---

## Amendment · the ledger clock (canvas review, 22 September 2026)

The last-15-seconds inverted face (an `--ink` block that flashes once a second) is retired. It pulled the eye off the field at the moment a player most needs it, could not be paused (WCAG 2.2.2 for blinking longer than 5s) and held as a solid black slab under reduced motion. Urgency is weight only, within the eight tokens:

| Phase | Ground | Numeral | Bar | Frame | Label |
|---|---|---|---|---|---|
| running (> 1:00) | `--paper` | 32px mono 500 | 6px, `--muted` over `--rule` | 1.5px `--ink` | `match clock` / pace, 400 |
| under 1:00 | `--tint` | 700 | 8px, `--ink` | 1.5px | pace, 400 |
| last 15s | `--tint` | 700 | 8px, `--ink` | 3px (1.5px border + 1.5px inset, geometry fixed) | `last 12s`, `--ink` 600 |
| 0:00 | `--paper` | 700 | empty | 3px | `time`, 600 |

Nothing blinks: the numeral stepping once a second is the only motion; with sound on, a soft tick marks the last five seconds. The review scrubber uses the calm 6px `--muted` bar. Artboard: `ClockStates.dc.html`.

---

## Amendment · the match rail (22 September 2026, supersedes the ledger clock above)

The clock leaves the ledger and is drawn once, as the **match rail** on the field's top edge (between the opponent's bar and the field). Artboard: `MatchRail.dc.html`.

- **Grid.** Ten 30s blocks on the move lanes' own 10-column grid (same width, same 3px gaps), so block k sits exactly under move k. Each block is six 5s ticks with 1px gaps. It empties from the right, like the lanes: one tick every 5s (remaining ticks = ⌈seconds ÷ 5⌉).
- **Row.** A 16px line (label left, mono 11; numeral right, mono 15 tabular, every second for precision) over an 8px rail; 38px in all. The field shrinks from 708 to 674px so the stack still fits 900px. Phone: 358px wide, 6px tall, label 10 / numeral 13, between the top bar and the field.
- **Pace carets.** A 1.5px chevron at the end of each player's moves left: the opponent's on the rail's top edge (pointing down, his bar is above), yours on the bottom edge (pointing up). Slate short of your caret is time you owe. When it is short by a full block or more, your bar's sub-line adds `· behind pace` / `· á eftir áætlun (?)` in `--you` (colour is never the only carrier). Carets hide for a player with ten moves played.
- **Phases (weight only, never a new hue, never flashing).** Running: ticks `--muted`, numeral 500, label = the pace (`≈27s a move`) while a move is yours. Under 1:00: ticks `--ink`, numeral 700. Last 15s: label `last 12s` in ink 600; the numeral stepping is the only motion; a soft tick sounds in the last five seconds if sound is on. 0:00: empty rail, label `time`.
- **Around the match.** Table: the rail is full and waits (`starts when both sit down`). Starting: it loads left to right during 3·2·1 (end state under reduced motion); the count moves to the live row. Result: it holds the time that was left (`match over · 4:52 of 5:00`). Review: it shows the clock as it read at step k, so the ledger's scrubber keeps only the step control.
- **Accessibility.** `role="timer"`, not live; the live row announces 1:00 and 0:15. Rail and carets are `aria-hidden`; the numeral and the sub-line text carry the meaning.
- **Design-system change.** "One clock, two counts" becomes "one clock, on the field's edge": the rail is the one match fact outside the ledger, because time is the one fact a player must read while looking at the letters.

---

## Amendment · the clock boxed at the top, and one grid for both columns (22–23 September 2026)

**The clock** is a boxed element at the very top of the board column (above the opponent's bar), 58px tall: a 1.5px `--ink` frame on `--paper` (`--tint` under 1:00), the label and a 24px numeral on one line, then the ten-block rail and the two pace carets inside the box. Phone: the same box across the top at 358px.

**One grid.** The ledger's bands take the exact heights of the bands beside them, so every horizontal edge on the right is level with one on the left (desktop 1440×900, stack 851px from y=24):

| Left column | y | Right column |
|---|---|---|
| clock box | 0–58 | band A: wordmark + context (+ one line: verdict, or the review controls); its 1px rule level with the box's bottom border |
| gap + opponent bar + gap | 58–138 | band B: a match-level line when there is one (step, end-early offer, rematch request), then the face-off header, whose ink rule is level with the field's top frame |
| field, 643px (cells exactly 64px) | 138–781 | band C: ten 64px move rows, each rule level with a row of cells; the live row (and review's step row) is one of them |
| gap + your bar | 791–851 | band D: the territory bar level with your moves lane, then the foot (or, in the final state, the totals row) |

The field is 643px (was 708 with the ledger clock, 674 with the rail). Review drops the lead chart: the step row carries the lead in words, and the bars' totals at step k carry it in numbers.

---

## Amendment · the scoreboard (23 September 2026, supersedes the boxed clock and the player bars)

One box above the board holds the match's clock and both players; there are no player bars around the field.

- **Rows** (40px each on desktop, 34px on phones): 1 the match clock (label and pace, the ten-block track, the numeral); 2 the opponent (square, name, sub-line; their ten moves on the track; their total); 3 you (the same, your seat colour). Your row sits nearest the board you play on.
- **One track column** for all three rows: the clock's ten 30s blocks (six 5s ticks each, emptying one tick every 5s from the right) stand directly above each player's ten moves (emptying from the right as moves resolve; 30% while in flight; outlined when disconnected). Time left and moves left compare straight down a column, so the pace carets are retired. When you are short by a full block your sub-line still says `behind pace` (colour is never the only carrier).
- **Columns**: name 216px · track · value 64px (numeral / totals), 16px gaps, 14px padding; phone: 112 · track · 36, 10px gaps, 8px padding, and blocks fill in 5s steps without tick marks (60 ticks do not read at 170px).
- **Urgency** stays weight-only: under 1:00 the clock row takes `--tint`, ticks turn `--ink`, numeral 700; nothing blinks.
- **Grid**: desktop field 713px (cells exactly 71px). The ledger's first three rows mirror the scoreboard's (wordmark + context + ⋯ · territory or the state's line · the face-off header, whose 1.5px ink rule is level with the box's bottom border); after the same 12px gap, ten move rows of 71px sit level with the board's rows.

---

## Amendment · the opponent's colour and the penalty red (23 September 2026, supersedes every coral value above)

Red reads as an error, so the colour that marks points lost must never be mistaken for a player. The opponent is burnished terracotta, and crimson marks points lost and nothing else.

| Token | Was | Now | On `--paper` | Use |
|---|---|---|---|---|
| `--opp` | `#C4634C` coral | `#B56A4F` burnished terracotta (OKLCH 0.60 0.10 40) | 4.0:1 | the opponent's letters (17px and up), bands, lane, squares, totals |
| `--opp-text` | `#AB4F3B` | `#A1583D` (same hue, darker) | 5.2:1 (4.7:1 on `--tint`) | the opponent's text under 17px: ledger words, numerals, lobby scores |
| `--err` | | `#AD1F3D` crimson (OKLCH 0.49 0.18 16) | 6.8:1 | points lost only |

- **Terracotta against coral.** It is quieter than coral: lower chroma (0.10 against 0.13) and a browner hue (40° against 35°). It sits beside teal as an earth pair instead of reading as an alarm. Bands stay 14% (settled) and 30% (live), `rgba(181,106,79,…)`.
- **Why the error colour is crimson, not brick red.** A brick red (`#B63230`) sits too close to terracotta text (OKLab distance 0.08), and a `−5` in the opponent's column would read as their colour. Crimson is cooler and deeper (distance 0.11 to `--opp-text`, 0.15 to `--opp`), so a loss reads as a loss.
- **Colour-blind note.** Teal against terracotta keeps coral's weakest pair under protanopia (OKLab distance 0.06). Seats are therefore never told apart by colour alone: the square and name on each scoreboard row, the ledger's column (yours left of the spine, theirs right) carry the same fact, and every scored cell names who froze it to a screen reader.
- **Where crimson appears:** the `−5` of a move with no word, `−5` for each move not played at 0:00, and the `−15` in the live row's `3 moves left · −15 if unplayed`. Only the number is crimson; its label (`no word`, `not played`, `if unplayed`) stays `--muted`, so colour is never the only carrier.
- **Where crimson never appears:** seats, rating losses (`1187 → 1179 · −8` stays ink), urgency (the clock stays weight-only), frames, focus or any control.
- The palette grows to nine tokens with `--err`. Every "coral" above now reads "terracotta"; the `--opp` and `--opp-text` roles are unchanged.
