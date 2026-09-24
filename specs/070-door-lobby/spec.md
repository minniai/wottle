# Feature Specification: The door, the lobby, challenges and presence

**Feature Branch**: `070-door-lobby`
**Created**: 2026-09-23
**Status**: Draft
**Input**: Stage 4 of the game flow redesign: the door, the lobby, challenges and presence. Source of truth: `docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md`: §2 principles, §3 screen map, §4 flow graph, §5.0 shared frames, A1 (door), B1–B8 (lobby, composer, sent and outcomes, incoming, incoming elsewhere, searching, your match running), C7 (leave slip), F1, F2, F6 and F8's leave slip, §6 logo and landing, §7.1 presence, §7.2 lobby language, §7.4 challenge lifecycle, §7.7 notification rules, §7.8 (must-have parts), §7.9 rows S4, S5, S6 and S10, and §8 items 1, 3, 4, 7, 10 and 13. Owner decisions in §10 are settled and are not re-asked: signed-out visitors see the names of players here now; challenges stay within one language's lobby; a challenge lasts 60s and a decline starts a 60s cooldown for the pair. Design canvas https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo, artboards FlowMap, DoorIs, DoorEn, Lobby, LobbyEmpty, LobbyComposer, LobbySent, LobbyIncoming, LobbySearching, PhoneDoorIs, PhoneDoorEn, PhoneLobby and PhoneComposer. Out of scope: invite links and profiles (stage 6), phase 2 items, watching and following.

## Context

Three verdict problems remain after stages 1–3.

- **The main social act is the least visible thing in the product** (verdict 4). An incoming challenge is an 11px line at the bottom of the lobby ledger. It exists only on the lobby page, makes no sound and never changes the tab title. On a phone it is below the fold. There is no way to withdraw a challenge, it lasts 30s, and nothing limits how often one player can challenge another.
- **The entry is an empty ruled square, and the lobby looks like a match with the opponent missing** (verdict 6). A signed-out visitor sees a blank grid under a sign-in slip. A signed-in player sees a practice field that scores nothing. The favicon is a neon glass "W".
- **Back in a live match has no guard, and `leave` resigns** (verdict 8). The match menu's `leave` opens the resign slip.

Presence is one row per player, refreshed every 60s and trusted for 5 minutes, so the lobby lists people who closed their tab minutes ago, and a challenge can be sent to them.

This stage makes the door and the lobby **pages**: places with no field, on the room's grid, under a masthead and a **line slot**. The field now appears only when you sit down at a table. The line slot follows the player to every signed-in page and carries their one standing state: an incoming challenge, their running match, their outgoing challenge, or their search. The state comes with a countdown, a sound, the tab title and the favicon. Challenges get a composer that states the stakes before sending, a full lifecycle (sent, withdrawn, declined, no answer, started another match, left), a 60s life and a 60s cooldown after a decline. Presence becomes per tab, so a closed tab drops out within seconds. Events reach the player through payload-free pokes on their own channel, and polls become the fallback. In a live match, Back and `⋯ go to the lobby` open a leave slip that never resigns.

## Clarifications

### Session 2026-09-23

- Q: Is the "your record" column (source-tagged phase 2, S14) built in this stage? → A: Yes. S14's head-to-head record per pair and language is pulled into this stage. It feeds the here-now table's record column and the incoming call's line 2 (`1179 · ÞINN FERILL 3–1 · 0:47 TIL AÐ SVARA`).
- Q: What happens when a signed-in player reaches the other locale's lobby without the switch (a typed URL, a link or a bookmark)? → A: It becomes their lobby language at once, unless a search, an outgoing challenge or an incoming challenge is out. In that case the line slot first shows the consequence line (`you are in the Icelandic lobby · switching cancels your search · switch ▸`), and the lobby is shown with finding and challenging off until they confirm.
- Q: How many here-now rows does the door show? → A: At most 8, then a plain count `+ 22 fleiri` / `+ 22 more` (not a link), on desktop and phone.
- Q: Which arrivals does `tell me when someone is here ▸` notify, and for how long? → A: Once. The first player to arrive notifies (`Embla is here` / `Embla er hér`: the cue, and an OS notification if the tab is hidden and permission is granted), then the opt-in ends. Pressing it again in a later empty lobby turns it back on.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The door (Priority: P1)

A visitor arrives at `/` (Orðusta) or `/en` (Wottle) signed out. They see the game's own mark, two crossing words on ruled cells. They also see what the game is in one headline and one lede, and who is here now. They type a name and press the one primary.

**Why this priority**: This is every new player's first screen. Today it is an empty grid under a form.

**Independent Test**: Open `/` and `/en` in a fresh browser. Each shows its lockup, headline, lede, name field, `lobbíið ▸` / `enter the lobby ▸` and the here-now list. Entering a free name lands in the lobby at the same URL.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor at `/`, **When** the page renders, **Then** it is the door (A1), not a field:
   - **Masthead:** on the left, the count `4 HÉR NÚNA · 2 VIÐUREIGNIR Í GANGI` / `4 HERE NOW · 2 MATCHES ON` for this locale's lobby, hidden when nobody is here. The second number counts matches in progress. On the right, the language switch `ÍSLENSKA · ENGLISH ▸`: the current language is ink with `aria-current`, the other is muted with `▸` and its own `lang`. The switch is the first element in tab order.
   - **Column A:** the lockup (§6), the kicker `ORÐ + ORUSTA · ORÐAEINVÍGI FYRIR TVO` / `WORD + BATTLE · A WORD DUEL FOR TWO`, then the headline as the page's one `h1`: `Tveir leikmenn, eitt borð,` / `tíu leikir hvor.` or `Two players, one field,` / `ten moves each.`. Below it, the lede.
   - **Column B:** the `NAFN` / `YOUR NAME` label, the name input (no autofocus), the error line, the primary, `SKRÁNING ÓÞÖRF` / `NO ACCOUNT NEEDED`, `ÞESSI VAFRI GEYMIR NAFNIÐ ÞITT` / `THIS BROWSER KEEPS YOUR NAME`, `HÉR NÚNA · 4`, the here-now rows, `HOW IT PLAYS` with three numbered lines, and `how to play ▸`.
   - **Folio:** `ORÐUSTA` / `WOTTLE`.
2. **Given** the door, **When** the headline, lede and terms are built, **Then** the move count and clock length come from the game configuration, never from literals. The number word comes from a per-language number-word table, with digits as the fallback.
3. **Given** the here-now list, **When** it renders, **Then** each row is a name (not a link), a rating and a presence word (`hér` / `here`, `leitar` / `searching`). Under the rows it reads `farðu inn í lobbíið til að skora á einhvern` / `enter the lobby to challenge someone`. With nobody here it reads `Enginn hér enn.` / `No one here yet.`. At most 8 rows show: here before searching, then by rating distance from 1200, the rating a new player starts at. Beyond them a plain count reads `+ 22 fleiri` / `+ 22 more`, which is not a link. The phone shows the same 8 rows, and the page scrolls.
4. **Given** the name input, **When** the visitor submits, **Then** Enter submits, the primary shows its pressed state and ignores repeat presses, and one of these errors appears in a polite live region with `aria-invalid`:
   - the format rule `3 til 24 stafir, tölur, - eða _` / `3 to 24 letters, digits, - or _`, muted until it is an error;
   - `þetta nafn er frátekið · veldu annað` / `that name is taken · pick another`;
   - `of margar tilraunir · bíddu í mínútu` / `too many tries · wait a minute`;
   - `innskráning tókst ekki · reyndu aftur` / `could not sign in · try again`.
5. **Given** a successful entry, **When** the lobby loads, **Then** the URL is still `/` (or `/en`), the entry replaces the door's history entry, and the player's name writes into their block. With a validated `?next=` the player lands on that target instead.
6. **Given** a browser whose device key names a player after a sign-out, **When** the door renders, **Then** column B shows the returning state: `GAMAN AÐ SJÁ ÞIG AFTUR` / `WELCOME BACK`, the name with a `--you` square (not an input), the primary, and `ekki Birna? · annað nafn` / `not Birna? · use another name`, which shows the empty state.
7. **Given** the browser prefers the other language, **When** the door renders, **Then** the switch leaves the masthead and becomes one line under it, written in that language: `Prefer English? · English ▸` / `Viltu frekar íslensku? · íslenska ▸`. The page never redirects on its own.
8. **Given** a phone (390 wide), **When** the door renders (F1), **Then** the masthead is 44px with the count on the left and the other language on the right. The lockup is at the phone size. The headline breaks at each comma onto three lines, with no lede. The primary sits inline, full width, directly under the input. The here-now rows follow, and the page scrolls. At 390×664 the primary still ends above the fold.
9. **Given** the door's first visit in a session, **When** it paints, **Then** the lockup arrives once (§6): the primary word's letters land, its band draws, then the guest word's letters land and its band draws, all within about 1.45s. Under reduced motion only the end state shows.
10. **Given** a valid session or device key, **When** `/` is opened, **Then** the door is never shown; the player gets the lobby.
11. **Given** the door, **When** its tab title and head are read, **Then** the title is `Orðusta · orðaeinvígi fyrir tvo` / `Wottle · a word duel for two`, with hreflang alternates between `/` and `/en` and x-default `/`.

---

### User Story 2 - The lobby, and who is here (Priority: P1)

Birna is signed in. The lobby is a page. It shows her block (name, rating in this language, record) with `find an opponent ▸`, the form strip of her last ten, a table of who is here in this lobby, and her last match drawn as a band map beside her recent matches.

**Why this priority**: The lobby is where every match is chosen. Today it is a practice field with nobody on it.

**Independent Test**: Sign in two players in the same language. Each sees the other in `here now` within one heartbeat, with rating, status and `challenge ▸`. Close one tab: the other lobby drops that row within 8s (a normal close), or within 45s when the tab dies without a beacon.

**Acceptance Scenarios**:

1. **Given** a signed-in player at `/`, **When** the lobby renders (B1), **Then**:
   - **Masthead:** the strip logotype on the left, linking to `/` with `aria-current` there. On the right: `LEIÐBEININGAR ▸` / `HOW TO PLAY ▸`; the switch written in the other language with that lobby's count (`ENGLISH · 7 HERE ▸`); `■ BIRNA ▸` (links to the profile); and `⋯`.
   - **Line slot:** sticky under the masthead, with its height reserved. It holds one standing state (US4), or when empty the place `LOBBÍ · ÍSLENSKA` and the terms `ALLAR VIÐUREIGNIR GILDA TIL ELO · 10 LEIKIR HVOR · EIN 5:00 KLUKKA` / `EVERY MATCH RATED · 10 MOVES EACH · ONE 5:00 CLOCK`.
   - **Your block:** a 16px `--you` square, the name as the page's `h1` at 40px, and the sub-line `1212 · ELO · ÍSLENSKA · 35 VIÐUREIGNIR · 20–15–0` / `1310 · RATING · ENGLISH · 22 MATCHES · 13–9–0`. At the right is the primary `FINNA MÓTSPILARA ▸` / `FIND AN OPPONENT ▸`, with `2 LEITA NÚNA` / `2 SEARCHING NOW` (or `ENGINN LEITAR NÚNA` / `NOBODY SEARCHING NOW`) beneath it.
   - **Form strip:** `SÍÐUSTU TÍU` / `LAST TEN`, then ten ruled cells, oldest first. A win is `S` / `W` in ink 600 with a 3px `--you` bar. A loss is `T` / `L` in muted. A draw is `J` / `D` in ink with no bar. The strip is `role="img"`, labelled `síðustu tíu: 7 sigrar, 3 töp` / `last ten: 7 won, 3 lost`.
   - **Here now:** a table (US2.2).
   - **Column B:** `SÍÐASTA VIÐUREIGN` / `LAST MATCH` and the band map (US2.4); the verdict line `Birna vann 134–88` / `Birna wins 134–88`; the detail `KÁRI · 4:52 · Í GÆR` with `SKOÐA ▸` / `REVIEW ▸`; then `SÍÐUSTU VIÐUREIGNIR ÞÍNAR` / `YOUR LAST MATCHES`, four rows of name · score · `sigur`/`tap`/`jafnt` (`win`/`loss`/`draw`) · `SKOÐA ▸`.
   - **Folio:** `ORÐUSTA · LOBBÍ` / `WOTTLE · LOBBY`.
   - There is no field, no warm-up and no hint.
2. **Given** the here-now table, **When** it renders, **Then**:
   - It is a `role="table"` with column headers.
   - The caption reads `HÉR NÚNA · 5 · 1 AÐ SPILA` / `HERE NOW · 5 · 1 PLAYING`. The second number counts players at a table or in a match.
   - Rows are 56px. Each has the name (Zilla 600 17, ink, a link to the profile) followed by `@handle` in muted mono, the rating, the status word, and the action `SKORA Á ▸` / `CHALLENGE ▸`, labelled name first (`Embla · skora á`).
   - The record column `ÞINN FERILL` / `YOUR RECORD` shows the viewer's record against that player in this language, wins first (`3–1`). Draws are appended only when there are any (`3–1–1`). With no completed rated match between them it shows `—`.
3. **Given** the table's rows, **When** they are ordered, **Then**:
   - They sort by status (here → searching → in a match → away), then by rating distance from the viewer.
   - `in a match · 6 of 10` / `í viðureign · 6 af 10` and `away` / `fjarverandi` rows are muted and carry no action.
   - After eight rows, `+ 6 fleiri ▸` / `+ 6 more ▸` expands the rest in place.
   - The order freezes while the pointer is over the table, while focus is inside it, or while a composer is open. New arrivals are added at the end, and the table re-sorts at the next idle moment.
   - Presence changes are not announced.
4. **Given** the viewer has a completed, rated match in this language, **When** column B renders, **Then**:
   - The band map is a 340×340 grid of 10×10 cells in rule lines, with no frame and no letters.
   - Each scored word of that match is drawn as its band in its owner's seat colour, with its chevron, and nothing else.
   - It is `role="img"` (`Birna 134, Kári 88, í gær`) inside one link `skoða síðustu viðureign` / `review your last match` to that match.
   - Void and abandoned matches never appear in the band map, the recent list or the form strip.
5. **Given** a new player with no matches, **When** the lobby renders, **Then**:
   - the band-map slot shows rules figure 1 (a swap) with `Fyrsta viðureignin þín birtist hér.` / `Your first match will show here.` and `leiðbeiningar ▸`;
   - the form strip is ten empty ruled cells;
   - the sub-line reads `1200 · ELO · ÍSLENSKA · ENGIN VIÐUREIGN ENN` / `1200 · RATING · ENGLISH · NO MATCHES YET`.
6. **Given** nobody else is in this lobby, **When** the lobby renders (LobbyEmpty), **Then**:
   - the table reads `Enginn annar er hér.` / `No one else is here.`;
   - `find an opponent ▸` stays the primary, with `þú færð mótspilara um leið og einhver kemur` / `you will be paired as soon as someone arrives` beneath it;
   - a secondary `láta mig vita þegar einhver kemur ▸` / `tell me when someone is here ▸` opts in, once, to hearing of the next arrival. The first player to arrive in this lobby plays the `challenge` cue, sets the tab title to `Embla is here · Wottle` / `Embla er hér · Orðusta` and, if the tab is hidden and permission is granted, shows an OS notification. Then the opt-in ends. Pressing it again in a later empty lobby turns it back on. While it is on, the control reads `we will tell you · cancel` / `við látum þig vita · hætta við`.
7. **Given** the `⋯` menu, **When** it opens, **Then** it holds:
   - `hljóð · á` / `sound · on`. On first open it adds `sound starts after your first click`.
   - `tilkynningar · af` / `notifications · off`.
   - `skrá út` / `sign out`. While a search or challenge is out, the consequence line `útskráning hættir leitinni` / `signing out cancels your search` comes first. During a live match sign-out is disabled with `ljúktu fyrst viðureigninni` / `finish your match first`.
8. **Given** the lobby, **When** its tab title is read with nothing standing, **Then** it is `lobbí · Orðusta` / `lobby · Wottle`.
9. **Given** a phone (F2), **When** the lobby renders, **Then**:
   - The masthead has the strip at 18px cells, `■ BIRNA` and `⋯` as 44px targets.
   - The block comes next, with the sub-line on two lines, then the form strip.
   - Here-now rows are 64px on two lines: name and rating, then status and a 44px action.
   - Then come the band map at 358², the recent matches and the folio.
   - The standing state and the page primary live in a bottom slot pinned to the bottom edge with the safe area. The page carries matching bottom padding so its last row is never hidden.
10. **Given** `/lobby` or `/matchmaking`, **When** either is opened, **Then** it redirects permanently (308) to `/` in its locale.

---

### User Story 3 - Challenge someone, and see what happened (Priority: P1)

Birna presses `challenge ▸` on Embla's row. The row opens in place and states the terms and her stakes before she sends. Once sent, the challenge lives in her line slot with a 60s countdown and `withdraw ▸`, on every page. Whatever happens (accepted, declined, no answer, withdrawn, started another match, left) is written in the slot and on Embla's row for 4s.

**Why this priority**: A challenge is the only way to pick who you play. Today it can be sent to a ghost, cannot be withdrawn, and disappears silently.

**Independent Test**: Birna challenges Embla. Birna's slot shows `Challenge sent · Embla · 0:59` with a draining bar. Embla declines: both Birna's slot and Embla's row read `declined` for 4s. Embla's row then reads `again in 0:5x`, and a second challenge to Embla is refused until 60s pass.

**Acceptance Scenarios**:

1. **Given** a row with `challenge ▸`, **When** Birna presses it, **Then** the composer opens (B2):
   - The row grows in place to 120px (176 on a phone), takes the `--tint` ground and a 3px ink left rule, and the table's order freezes.
   - Line 1 is unchanged.
   - Line 2 states the terms and Birna's stakes, computed from both ratings: `EVERY MATCH RATED · WIN +9 · DRAW +1 · LOSS −7 · ENGLISH WORDS · 10 MOVES EACH · ONE 5:00 CLOCK` / `GILDIR TIL ELO · SIGUR +9 · JAFNTEFLI +1 · TAP −7 · ÍSLENSK ORÐ · 10 LEIKIR HVOR · EIN 5:00 KLUKKA`. On a phone this is two lines.
   - Line 3 appears when it applies: `sending cancels your search` / `leitin hættir ef þú sendir`, or `sending withdraws your other challenge` / `hin áskorunin þín fellur niður`.
   - At the right are the primary `SEND CHALLENGE ▸` / `SENDA ÁSKORUN ▸` and the secondary `not now` / `ekki núna`.
   - Focus moves to send. While the composer is open, `find an opponent ▸` is drawn as a secondary (on a phone the pinned primary is hidden).
   - Only one row is open at a time. Esc or `not now` closes it and returns focus to the row's `challenge ▸`.
2. **Given** the composer is open, **When** an incoming challenge arrives, **Then** the composer stays open but its send is drawn as a secondary (the call outranks it), and nothing moves.
3. **Given** Birna sends, **When** the challenge is recorded (B3), **Then**:
   - Any earlier outgoing challenge of hers is withdrawn, and her search is cancelled.
   - Her status as a player is not changed by sending.
   - The line slot (status style) reads `Challenge sent · Embla · 0:59` / `Áskorun send · Embla · 0:59`, with line 2 `ENGLISH WORDS · 10 MOVES EACH · WIN +9 · LOSS −7`. The secondary `withdraw ▸` / `draga til baka ▸` is never focused. A 4px ink drain empties over 60s.
   - Embla's row status reads `sent · 0:59` / `send · 0:59`, with no action on the row.
   - The page has no primary: `find an opponent ▸` is a secondary with `withdraws your challenge` / `áskorunin þín fellur niður` beneath it.
   - Other rows keep `challenge ▸`.
   - The tab title reads `challenge sent · 0:41 · Wottle`.
   - On a phone the bottom slot shows `áskorun send · Embla · 0:52` with `draga til baka ▸` and `haltu skjánum opnum` / `keep this screen open`, and the screen is kept awake.
4. **Given** a challenge is out, **When** it ends, **Then** for 4s both the row's status cell and the line slot show the outcome in mono ink, and it is announced politely, name first (`Embla · declined`). The outcomes are:

   | Outcome                                                                                | EN                      | IS                   |
   | -------------------------------------------------------------------------------------- | ----------------------- | -------------------- |
   | declined                                                                               | `declined`              | `hafnaði`            |
   | 60s without an answer                                                                  | `no answer`             | `svaraði ekki`       |
   | the recipient was paired or accepted another                                           | `started another match` | `hóf aðra viðureign` |
   | the sender or recipient is gone (§7.1)                                                 | `left the lobby`        | `fór úr lobbíinu`    |
   | withdrawn (withdraw ▸, a new challenge, a search, an accept, a lobby switch, sign-out) | `withdrawn`             | `dregin til baka`    |

5. **Given** a decline, **When** the outcome has shown, **Then** the row's action cell reads `again in 0:52` / `aftur eftir 0:52` until 60s from the decline, then `challenge ▸`. The server refuses a challenge to that player within the cooldown.
6. **Given** the recipient accepts, **When** the sender learns of it on any page, **Then** the slot and row read `accepted` / `samþykkt` for 400ms and the sender is taken to the table as a new history entry. The sender is seated by the table's input rule (spec 069).
7. **Given** a send fails, **When** the server refuses, **Then** the reason is written on the row:
   - `that player is in a match` / `sá leikmaður er í viðureign`
   - `that player has left` / `sá leikmaður er farinn`
   - `challenge not sent · try again` / `áskorun fór ekki · reyndu aftur`
   - `too many challenges · wait a minute` / `of margar áskoranir · bíddu í mínútu`
   - the table-leave cooldown's existing reason
8. **Given** Birna and Embla each have a pending challenge to the other, **When** the second is sent, **Then** both go to the table at once, both seated (spec 067 and 069).
9. **Given** Birna closes her tab with a challenge out, **When** the tab is gone, **Then** the challenge is withdrawn (by beacon, or when she is gone by §7.1), and Embla's call disappears.

---

### User Story 4 - The line slot follows you (Priority: P1)

Kári challenges Birna while she is on her profile. The line slot under the masthead turns into a call: `Kári skorar á þig`, `1179 · 0:47 til að svara`, `samþykkja ▸` and `hafna`, with a draining bar. The tab title reads `(1) Kári skorar á þig · Orðusta`, the favicon's letter turns terracotta, and a two-note cue sounds. The same slot carries her search, her outgoing challenge and her running match, on every signed-in page.

**Why this priority**: A challenge that only the lobby can show is a challenge most players never see.

**Independent Test**: With Birna on `/rules` in a hidden tab, Kári challenges her. Her tab title changes and the cue plays (after her first gesture). She returns and accepts: both go to the table.

**Acceptance Scenarios**:

1. **Given** any signed-in page (lobby, profile, rules), **When** it renders, **Then** it has the page frame:
   - the masthead;
   - the line slot, reserved and sticky with the masthead, so nothing below ever moves when its content changes;
   - `main`, and a folio naming the place;
   - landmarks `banner` / `main` / `contentinfo`, and exactly one `h1`.
2. **Given** several standing states at once, **When** the slot renders, **Then** it shows one, by precedence:
   1. an incoming challenge;
   2. your match is running, or is over while you were away;
   3. a lobby switch waiting for confirmation (US7.4);
   4. your outgoing challenge;
   5. your search;
   6. empty.

   A second incoming challenge adds `· +1` to line 2 of the first, and takes the slot when the first is answered or expires.

3. **Given** an incoming challenge (B5), **When** the slot renders it (call style), **Then**:
   - It has the `--tint` ground, a 3px ink left rule and a 12px `--opp` square.
   - Line 1 reads `Kári skorar á þig` / `Kári challenges you`.
   - Line 2 reads `1179 · ÞINN FERILL 3–1 · 0:47 TIL AÐ SVARA` / `1179 · YOUR RECORD 3–1 · 0:47 TO ANSWER`. With no matches between them, the record part is omitted. On a phone it reads `1179 · 3–1 · 0:47 til að svara`. While the viewer is searching it ends `· ACCEPTING CANCELS YOUR SEARCH` / `· LEITIN HÆTTIR EF ÞÚ SAMÞYKKIR`.
   - The actions are the primary `SAMÞYKKJA ▸` / `ACCEPT ▸`, which ignores activation for 500ms after the line appears, and `hafna` / `decline`.
   - A 4px drain empties over 60s.
   - Accept is the page's one primary: `find an opponent ▸` drops to a secondary, and on a phone the pinned primary is hidden.
   - The sender's row in the table reads `skorar á þig` / `challenges you`, with no action.
4. **Given** an incoming challenge arrives, **When** the page learns of it, **Then**:
   - the `challenge` cue plays (two notes; respects the sound toggle; only after the page's first gesture);
   - the tab title becomes `(1) Kári skorar á þig · Orðusta` / `(1) Kári challenges you · Wottle`;
   - the favicon's letter turns full-strength `--opp`;
   - if the player opted in and the tab is hidden, an in-page OS notification is shown;
   - arrival is announced politely (`Kári skorar á þig, 47 sekúndur til að svara`) and again at 10s left;
   - focus is never stolen. While the call is up, a skip link `svara áskoruninni · Kári` / `answer the challenge from Kári` is the page's first focusable element.
5. **Given** the call, **When** the viewer accepts (after the guard), **Then**:
   - their search and outgoing challenge are withdrawn;
   - their other incoming challenges are answered `started another match`;
   - they go to the table seated, as a new history entry.

   If the sender is no longer free, the slot reads `Kári getur ekki spilað núna` / `Kári can't play right now`. If the sender is gone, it reads `Kári hætti · áskorunin fellur niður` / `Kári has left · challenge withdrawn`.

6. **Given** the call, **When** the viewer declines or 60s pass, **Then** the slot returns to its previous content with no sound.
7. **Given** a player at a table, in the count or in a live match, **When** anyone looks for them, **Then** they show as `in a match`, and no challenge can be sent to them or arrive for them.
8. **Given** the viewer is in Result (the lifted final state) and a third party challenges them, **When** it arrives (B6), **Then** it is the ledger's first line in live-row style, with a secondary `accept ▸` and `decline`, and never a slip. The first ledger line is reserved for an incoming rematch (stage 5); until then the challenge takes it.
9. **Given** the viewer's own match is running and they are on a page (B8), **When** the slot renders, **Then**:
   - It reads `Viðureignin þín · Kári` / `Your match · Kári`, with line 2 `LEIKUR 4 AF 10 · 3:12 EFTIR` / `MOVE 4 OF 10 · 3:12 LEFT`, and the primary `AFTUR Í VIÐUREIGNINA ▸` / `BACK TO THE MATCH ▸`.
   - The block's primary slot holds `ljúktu fyrst viðureigninni` / `finish your match first`. Every row's `challenge ▸` is removed, and sign-out is disabled.
   - The match heartbeat keeps running from the page, so the opponent sees `stepped out` / `brá sér frá`, not `reconnecting`.
10. **Given** the viewer's match ends while they are on a page, **When** the slot learns of it, **Then** it reads `Viðureigninni er lokið · Kári vann 88–46` / `Your match is over · Kári wins 88–46`, with the detail on line 2 and `ÚRSLIT ▸` / `RESULT ▸`, until opened or until the session ends. The lobby never redirects on its own.
11. **Given** a phone, **When** a standing state exists, **Then** the bottom slot carries it: a 104px call line (drain on its top edge, line 1, line 2, then a 44px row with the primary and `hafna`) or a 64px status line. The page primary is shown only when no call is up.

---

### User Story 5 - Search from the lobby (Priority: P2)

Birna presses `find an opponent ▸`. There is no new screen and no placeholder letters. Her search appears in the line slot with a sweep along its bottom edge, and the table stays live, so she can still challenge someone while she waits.

**Why this priority**: The queue screen drew `cancel` four times and hid the lobby. The search engine itself shipped in stage 3; this stage moves where it is shown.

**Independent Test**: Press `find an opponent ▸`. The slot reads `Searching for an opponent · 0:07` with `cancel ▸`. Open a row's composer: it says `sending cancels your search`. A second searcher pairs with Birna: both go to the table.

**Acceptance Scenarios**:

1. **Given** the lobby, **When** Birna presses `find an opponent ▸` (B7), **Then** the search starts in place:
   - The URL does not change, and her outgoing challenge is withdrawn.
   - The slot (status style) reads `Searching for an opponent · 0:07` / `Leitar að mótspilara · 0:07`, with line 2 `2 SEARCHING NOW · ENGLISH WORDS` / `2 LEITA NÚNA · ÍSLENSK ORÐ`.
   - `cancel ▸` / `hætta við ▸` is a secondary on the right, never focused. The slot's bottom edge carries the 4px `lane-search` sweep.
   - The block's primary slot is empty.
2. **Given** 0:30 has passed with nobody else searching, **When** line 2 updates, **Then** it reads `NO ONE ELSE IS SEARCHING · CHALLENGE SOMEONE BELOW` / `ENGINN ANNAR LEITAR · SKORAÐU Á EINHVERN HÉR FYRIR NEÐAN`.
3. **Given** a search, **When** stage 3's checks fire, **Then** they are written in the slot:
   - 3:00 in: `Still searching? · 3:00` / `Leitar enn? · 3:00`, with the primary `KEEP SEARCHING ▸` / `HALDA ÁFRAM AÐ LEITA ▸` and a 30s drain; no answer gives `search stopped · find again ▸` / `leit stöðvuð · leita aftur ▸`.
   - A hidden tab pauses the search; on return it reads `search paused · resume ▸` / `leit í bið · halda áfram ▸`.
   - The table-leave cooldown reads as before (spec 069).
4. **Given** a search, **When** Birna goes to her profile or the rules, **Then** the search continues in the same slot there.
5. **Given** the search, **When** the tab title is read, **Then** it is `searching 0:07 · Wottle` / `leitar 0:07 · Orðusta`.
6. **Given** a pairing, **When** it happens on any page, **Then** the player goes to the table as a new history entry, with the cue, the title and a notification if the tab is hidden.
7. **Given** a phone, **When** searching, **Then** the bottom slot reads `LEITAR · 0:07` with `haltu skjánum opnum` beneath it and `hætta við ▸` on the right, and the screen is kept awake.

---

### User Story 6 - Presence that tells the truth (Priority: P1)

Kári opens the lobby in two tabs, reads the rules in a third, then closes all three. The lobby shows him as `here` the whole time he has any tab open. It shows `away` once every tab has been hidden for 2:00. It drops him within seconds of his last tab closing. Reloading or switching language changes nothing.

**Why this priority**: Every challenge, every row and every count depends on presence. Today a closed tab stays listed for up to 5 minutes.

**Independent Test**: Sign Kári in. Hide his tab for 2:00: Birna's lobby shows him `away`, with no action. Close the tab: he is gone from Birna's list within 8s. Reload his tab instead: he never leaves the list.

**Acceptance Scenarios**:

1. **Given** a signed-in page in a tab, **When** it runs, **Then** it reports a heartbeat for that tab: every 10s while visible and every 30s while hidden. The heartbeat carries the tab's identity, its visibility, the time of its last input and the player's lobby language. The player's state is the best state across their tabs.
2. **Given** the states, **When** a player is listed, **Then** their state is:

   | State      | EN / IS                                          | Shown when                                                                                                                    | Challengeable                        |
   | ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
   | here       | `here` / `hér`                                   | any tab visible, or hidden under 2:00; not at a table or in a match                                                           | yes                                  |
   | searching  | `searching` / `leitar`                           | searching in this lobby                                                                                                       | yes (accepting cancels their search) |
   | in a match | `in a match · 6 of 10` / `í viðureign · 6 af 10` | a pending or in-progress match                                                                                                | no                                   |
   | away       | `away` / `fjarverandi`                           | all tabs hidden for 2:00 or more                                                                                              | no                                   |
   | gone       | (dropped)                                        | no heartbeat for 3 missed beats of the last cadence (35s visible, 95s hidden), or a leaving beacon with no new load within 8s | no                                   |

   Presence is always a mono word, never a coloured dot.

3. **Given** a tab closes, **When** the page hides for the last time, **Then** a beacon marks that tab `leaving`. If no heartbeat from the same session arrives within 8s, the tab is gone. A reload, the language switch or closing a second tab therefore changes nothing.
4. **Given** a player becomes gone, **When** the server learns of it, **Then** their outgoing challenge is answered `left the lobby` and their incoming challenges `left the lobby`, and their search is cancelled.
5. **Given** a player is in a live match and on a page, **When** their opponent's scoreboard renders, **Then** it reads `stepped out` / `brá sér frá` for as long as the match heartbeat runs from any app page. The player is not counted as disconnected.
6. **Given** a player's tab heartbeat, **When** the table's seating rule (spec 069) asks whether the player is attentive, **Then** it reads the same visibility and last-input facts, so a tab on any signed-in page counts.

---

### User Story 7 - One lobby language (Priority: P2)

Birna plays in Icelandic. Reading `/en/rules` does not move her into the English lobby. Only entering the English lobby does, and the switch tells her first what switching will cancel.

**Why this priority**: Presence, the queue, challenges and ratings are all per language. A player must be in exactly one lobby.

**Independent Test**: Birna, in the Icelandic lobby, opens `/en/rules`: she is still listed in the Icelandic lobby and not in the English one. She presses `ENGLISH · 7 HERE ▸` with a search running: the slot reads `switching cancels your search · switch ▸` first.

**Acceptance Scenarios**:

1. **Given** a signed-in player, **When** they enter a lobby (`/` or `/en`), **Then** that lobby's language becomes their lobby language. It is kept for the session and never changes because they read a page in the other locale.
2. **Given** lists and counts, **When** they render, **Then** they show only players whose lobby language is this one. The masthead switch on the lobby carries the other lobby's count.
3. **Given** a search, an outgoing challenge or an incoming challenge, **When** the player presses the language switch, **Then** the consequence line comes first in the slot (`switching cancels your search · switch ▸`). Confirming cancels the search, withdraws the outgoing challenge and answers incoming ones `left the lobby`.
4. **Given** a signed-in player whose lobby language is Icelandic, **When** they open `/en` by a typed URL, a link or a bookmark, **Then**:
   - with nothing out, English becomes their lobby language at once;
   - with a search or a challenge out, the English lobby renders with `find an opponent ▸` and every `challenge ▸` off, and the line slot reads `you are in the Icelandic lobby · switching cancels your search · switch ▸` / `þú ert í íslenska lobbíinu · …`. Confirming switches as in US7.3. Leaving without confirming changes nothing.
5. **Given** a rating anywhere on a page, **When** it is shown, **Then** it is the rating for that page's or lobby's language, and the language is named beside it.
6. **Given** a challenge, **When** it is sent, **Then** it is refused unless both players' lobby language is the same.

---

### User Story 8 - Leave a live match without resigning (Priority: P2)

Mid-match, Birna presses Back. A slip asks `Leave the match?`, tells her the clock keeps running and she can come back, and focuses `stay ▸`. If she goes, the match continues, her lobby slot reads `Your match · Kári` with `back to the match ▸`, and Kári's scoreboard reads `stepped out`.

**Why this priority**: Two of the three controls that resign a rated match today are not labelled resign.

**Independent Test**: In a live match, pick a letter, then press Back: the leave slip opens with `stay ▸` focused. Choose `go to the lobby`: the match is still in progress, the lobby slot shows it, and the opponent's row reads `stepped out`.

**Acceptance Scenarios**:

1. **Given** a live match, **When** the viewer makes their first pick, **Then** a guard history entry is pushed, so a later Back opens the leave slip (C7) instead of leaving the site. Returning to a live match replaces its guard entry rather than stacking another.
2. **Given** the `⋯` menu in a live match, **When** it opens, **Then** `leave` is replaced by `go to the lobby` / `fara í lobbíið`, which opens the leave slip. `resign` is unchanged.
3. **Given** the leave slip, **When** it renders, **Then**:
   - the label reads `move 4 of 10 · 3:12 left`;
   - the headline reads `Leave the match?` / `Fara úr viðureigninni?`;
   - the body reads `the clock keeps running · you can come back` / `klukkan gengur áfram · þú getur komið aftur` and `each unplayed move costs up to 5 at 0:00` / `hver óleikinn leikur kostar allt að 5 við 0:00`;
   - the primary `STAY ▸` / `VERA ÁFRAM ▸` is focused (a slip the player opens focuses its safe action);
   - the secondary is `go to the lobby` / `fara í lobbíið`.

   It ranks below resign and above ready or void. On a phone it fills the field's square (F8).

4. **Given** the leave slip, **When** the viewer presses `stay ▸` or Esc, **Then** the slip lifts and the match is unchanged. **When** they press `go to the lobby`, **Then** they reach the lobby as a new history entry, the match keeps running, and the slot shows it (US4.9).
5. **Given** a live match, **When** the tab is closed, **Then** the browser's own leave confirmation is shown. `beforeunload` is armed only while the match is live.
6. **Given** a match completes, **When** the viewer presses Back, **Then** the guard is disarmed and never shows again. One Back from the result reaches the lobby.

---

### User Story 9 - Pokes, not polls (Priority: P2)

Every event that concerns a player (a challenge for them, an outcome, a table, a seat, a rematch) reaches their open tabs within about a second, as a payload-free poke on their own channel. The tab then re-reads the facts from an authenticated route. Polls remain as a slower fallback.

**Why this priority**: The line slot's promise (a challenge follows you) needs events that arrive on every page promptly without a 3s poll per concern per tab.

**Independent Test**: With Realtime on, Kári challenges Birna: her slot shows the call within 1s. With Realtime disabled, it shows within one fallback poll.

**Acceptance Scenarios**:

1. **Given** a signed-in tab, **When** it runs, **Then** it listens on a per-player channel. Pokes carry no payload beyond their kind (challenge, outcome, table, seat, rematch). The tab re-reads the facts through authenticated routes, and no client ever navigates on an id carried in a broadcast.
2. **Given** the existing rematch broadcast that carries the new match's id, **When** this stage ships, **Then** it becomes a poke, and the client reads the new match id from an authenticated route.
3. **Given** the channel is live, **When** the fallback polls run, **Then** they slow from 3s to 10–15s. **Given** the channel fails, **When** the tab notices, **Then** the polls return to 3s.
4. **Given** challenges past their 60s, **When** the 30s sweep runs, **Then** they are marked expired and both players are poked.
5. **Given** a background tab, **When** the browser throttles its timers, **Then** the channel's own keep-alive still runs.

---

### User Story 10 - The lobby overview (Priority: P2)

The lobby's counts, the door's count, the masthead switch's count, Birna's last match and her last ten come from one lobby overview read per language.

**Why this priority**: The door, the masthead and the lobby's column B have no data source today. The form strip exists only on the profile, and the recent list includes abandoned matches.

**Independent Test**: Read the overview for `is` and `en`. Each returns here, searching and playing counts for both lobbies, the viewer's last completed rated match with its scored words, and their last ten results, oldest first.

**Acceptance Scenarios**:

1. **Given** a language, **When** the overview is read, **Then** it returns:
   - the here, searching and playing counts for that lobby and the other;
   - for a signed-in viewer, their last completed, rated match in that language (the opponent, both scores, the duration, when it ended, and each scored word's cells and owner, for the band map);
   - their last ten results, oldest first.
2. **Given** a signed-out visitor, **When** the overview is read, **Then** it returns the counts and the names, ratings and presence words of players here now, and nothing about any one player's matches.
3. **Given** recent games or the form strip, **When** they are read, **Then** void and abandoned matches are excluded.

---

### Edge Cases

- **A challenge to a player who goes `away` or gone while it is out:** the outcome is `left the lobby`. The recipient's call disappears if they come back after it ended.
- **A challenge arrives while the viewer's composer is open on another row:** the call outranks the send (US3.2). Sending from the composer afterwards withdraws nothing of the call. Accepting the call closes the composer.
- **Two incoming challenges:** one call with `· +1` (US4.2). Accepting one answers the other `started another match`.
- **Three declines from the same challenger within 10 minutes:** that challenger's further challenges to this player are not delivered for the session, and read `declined` to the challenger.
- **More than 6 challenges in a minute from one player:** refused with `too many challenges · wait a minute`. Both this limit and the decline cooldown are counted from stored rows, so they hold across server instances.
- **A searching recipient accepts:** their search is cancelled. A searching sender who sends: their search is cancelled (the composer said so).
- **The table-leave cooldown (spec 069) is active:** `find an opponent ▸` and `challenge ▸` show the cooldown. Accepting an incoming challenge stays open.
- **The sender signs out with a challenge out:** it is withdrawn (spec 067 already does so).
- **A player with a match `pending` at a table who opens the lobby in another tab:** the slot shows the table as their match (`your match · Kári`), and `back to the match ▸` returns them to the table.
- **Sound before any gesture:** the cue is skipped silently. The title and favicon still change.
- **Notification permission denied or unsupported:** `notifications · on` is not offered, and nothing else changes.
- **Realtime disabled** (`NEXT_PUBLIC_DISABLE_REALTIME`): pokes never arrive, and the 3s polls carry every standing state.
- **`?next=` pointing off-site, at `//host`, or at an unknown path:** it is dropped, and the player lands in the lobby.
- **A reload on the lobby while a call is up:** the call is re-read and shown with its remaining time. The 500ms guard applies again.
- **Slot overflow:** every fixed slot is sized from its longest string in either language plus 16px, and a test fails on overflow.
- **Icelandic names in templates:** a name appears only in the nominative and never after eftir, gegn, til, frá, á, við or handa. No gendered word describes a player. A grep test enforces this, including the banned variants in §8 item 13.

## Requirements _(mandatory)_

### Functional Requirements

**Pages and the page frame**

- **FR-001**: The door and the lobby MUST be one URL per locale (`/`, `/en`): signed out it renders the door, signed in the lobby. `/lobby` and `/matchmaking` MUST redirect with 308 to `/` in their locale.
- **FR-002**: Every page (door, lobby, profile, rules) MUST use the page frame on the room's grid: a masthead (the strip logotype, or the door's context line), and, on signed-in pages, a sticky line slot with its height reserved. The frame also has `main` and a folio naming the place, the landmarks `banner` / `main` / `contentinfo`, and exactly one `h1`. Pages MAY scroll; field states never do.
- **FR-003**: No page other than a match MUST show a field. The lobby's warm-up field and its hint MUST be removed.
- **FR-004**: The door MUST render as specified in A1 and F1 (US1), including the returning state, the preference line, the here-now names (not links, at most 8, then a count) and the validated `?next=`.
- **FR-005**: The lockup, the strip and the cell mark MUST follow §6: the visitor's language across in `--you`, the other crossing in `--opp`, and the shared letter in the primary word's colour and value. Values MUST come from the language packs. The strip is for pages only, and field states keep the text wordmark. The lockup's arrival MUST play once per session and show only its end state under reduced motion.
- **FR-006**: The favicon MUST be the cell mark per locale (`Ð` on `/`, `W` on `/en`) and replace the current icon. Its letter MUST turn full-strength `--opp` while a call is pending.
- **FR-007**: The lobby MUST render your block, the form strip, the here-now table, the band map with the last-match lines, and your last matches, as specified in B1 and F2 (US2), including the new-player and empty-lobby states.
- **FR-008**: Terms, the lede, headline number words and every count of moves or clock MUST come from the game configuration, never from literals.

**The line slot and notification rules**

- **FR-009**: The line slot MUST show exactly one standing state, by precedence: incoming challenge > your match (running, or over while away) > a lobby switch waiting for confirmation (US7.4) > your outgoing challenge > your search > empty (US4.2). Its content MUST change in place with no layout shift.
- **FR-010**: Each standing state MUST carry a visible countdown or elapsed time, a drain bar or sweep, and its way out. A wait (sent, searching) has no primary, and its exit is a secondary that is never focused.
- **FR-011**: The tab title MUST follow the beat: `(1) Kári challenges you · Wottle`, `searching 0:07 · Wottle`, `challenge sent · 0:41 · Wottle`, `lobby · Wottle`, and the door's title. Match titles are unchanged from spec 069.
- **FR-012**: The `challenge` cue MUST play for an incoming challenge, and for a table waiting in a hidden tab (already so). It respects the sound toggle and plays only after the page's first user gesture. There is no sound for outcomes or errors.
- **FR-013**: OS notifications MUST be opt-in only, from `⋯ notifications · on` or `tell me when someone is here ▸`, and never requested on page load. They are delivered through the in-page Notification API while the page runs and the tab is hidden, for an incoming challenge, a table waiting, and the one arrival asked for by `tell me when someone is here ▸`.
- **FR-014**: Nothing in this stage MUST interrupt a live match. A player at a table or in a match cannot send or receive challenges.
- **FR-015**: Any control that appears or changes meaning under the pointer (line-slot buttons, the composer's send, slip buttons) MUST ignore activation for 500ms.
- **FR-016**: The line slot MUST be a `region` labelled for challenges, with polite announcements on arrival and at 10s left. It never steals focus, and it has a skip link as the page's first focusable element while a call is up.
- **FR-017**: On a phone, the standing state and the page primary MUST live in a bottom slot pinned with the safe area (104px call, 64px status, 56px primary), with matching page padding. The pinned primary is hidden while a call or composer is up.

**Challenges (S4)**

- **FR-018**: A challenge MUST last 60s from its creation. The recipient MUST be `here` or `searching` in the same lobby, not at a table or in a match, and not gone. Sending MUST NOT change the sender's player status.
- **FR-019**: A player MUST have at most one outgoing challenge. Sending a new one withdraws the old one. Starting a search withdraws it. Accepting any challenge withdraws it and cancels the search.
- **FR-020**: The system MUST record challenge outcomes `accepted`, `declined`, `expired`, `withdrawn`, `superseded` and `left`, and show each to the sender, on the row and in the slot, for 4s (US3.4).
- **FR-021**: A sender MUST be able to withdraw a challenge (`withdraw ▸`), and a closing tab MUST withdraw it by beacon.
- **FR-022**: A decline MUST start a 60s cooldown for that pair, in which the sender cannot challenge that recipient again. The row MUST show `again in 0:52`.
- **FR-023**: One player MUST be limited to 6 challenges per minute. After three declines from the same challenger within 10 minutes, that challenger's further challenges to the recipient MUST NOT be delivered for the session, and read `declined` to the challenger. All limits MUST be counted from stored rows.
- **FR-024**: Accepting MUST go through the one match-creation path (spec 067). It is refused with `Kári can't play right now` when the sender is not free, and with `Kári has left · challenge withdrawn` when the sender is gone. A pairing, an accept or a crossed challenge MUST answer the player's other pending incoming challenges `superseded` (shown as `started another match`).
- **FR-025**: The sender's view of an accepted challenge MUST include the new match, so the sender reaches the table from any page.
- **FR-026**: The composer MUST state, before sending, the terms and the viewer's rating change for win, draw and loss against that opponent in this language, and the consequence line when sending cancels a search or withdraws a challenge.

**Presence (S5) and lobby language**

- **FR-027**: Presence MUST be reported per tab (tab identity, visibility, last input, lobby language), at 10s while visible and 30s while hidden. The player's state is the best across their tabs.
- **FR-028**: A player MUST be `away` when all their tabs have been hidden for 2:00 or more, and gone (dropped from lists) after 3 missed beats at their last cadence, or 8s after a leaving beacon with no new heartbeat from the same session.
- **FR-029**: `in a match` MUST be derived from the player having a pending or in-progress match, never from a stored status alone. It carries the move count (`6 of 10`).
- **FR-030**: When a player becomes gone, their outgoing and incoming challenges MUST end as `left` and their search MUST be cancelled.
- **FR-031**: The match heartbeat MUST run from any app page while the player's match is live, and the opponent's scoreboard MUST read `stepped out` / `brá sér frá` rather than `reconnecting` for as long as it runs.
- **FR-032**: The presence constants (cadences, away, gone, queue freshness, recent input, challenge TTL, decline cooldown, activation guard) MUST live in one module shared by client and server.
- **FR-033**: Each player MUST have one lobby language: the last lobby they entered while signed in. Reading a page in the other locale MUST NOT change it. Lists, counts, the queue and challenges MUST use it. Switching lobby, by the switch or by opening the other locale's lobby directly, MUST show the consequence line first when something would be cancelled, and keep finding and challenging off until it is confirmed. Confirming cancels the search, withdraws the outgoing challenge and answers incoming ones `left`. With nothing out, the switch takes effect at once.

**Push (S6)**

- **FR-034**: Each signed-in tab MUST listen on a per-player channel for payload-free pokes (challenge, outcome, table, seat, rematch). It re-reads the facts from authenticated routes and never navigates on an id carried in a broadcast. The rematch broadcast that carries a match id MUST become a poke.
- **FR-035**: Polls MUST remain as the fallback: 3s while the channel is down or disabled, 10–15s while it is live.
- **FR-036**: Challenge expiry MUST also run in the 30s sweep, which pokes both players.
- **FR-037**: The channel's keep-alive MUST survive background-tab throttling.

**Lobby overview (S10)**

- **FR-038**: One lobby overview read per language MUST return the counts for this lobby and the other, and for a signed-in viewer their last completed rated match in that language (with the scored words for the band map) and their last ten results.
- **FR-038a**: The system MUST provide the viewer's head-to-head record against each listed player in this language (wins, losses and draws over completed rated matches) for the here-now table and the incoming call. It MUST be read in one query per lobby view, not one per row.
- **FR-039**: Recent games, the form strip and the band map MUST exclude void and abandoned matches.
- **FR-040**: A signed-out overview MUST expose only counts, and the names, ratings and presence words of players here now.

**The leave slip**

- **FR-041**: In a live match, Back (via a guard entry pushed on the first pick) and `⋯ go to the lobby` MUST open the leave slip (C7), which focuses `stay ▸` and never resigns. `go to the lobby` leaves the match running.
- **FR-042**: The match menu's `leave` item MUST no longer resign. Resigning MUST remain only behind `⋯ resign` and its own slip.
- **FR-043**: Once a match completes, the guard MUST be disarmed. `beforeunload` MUST be armed only while the match is live.

**Design system, copy and fixtures**

- **FR-044**: The design system (`WOTTLE_DESIGN_SYSTEM.md`) and CLAUDE.md's Design section MUST be amended in the same change per §8 items 1, 3, 4, 7, 10 and 13:
  - "One room" becomes "One field", with the three pages;
  - the leave slip's rank;
  - primary and focus rules;
  - the phone slip;
  - the new components (page frame, line slot, lobby block, form strip, band map, composer row, lockup, strip and cell marks);
  - the phone bottom slot;
  - the Icelandic glossary and the name-safe rule.
- **FR-045**: Every retired string listed in §5 as replaced MUST be removed. Retired components (the lobby's warm-up field, the lobby ledger, the sign-in slip, the queue room) MUST be deleted, not left unused.
- **FR-046**: New states MUST have `/dev/room` (or page) fixtures with visual baselines at 1440×900, 390×844, 390×664 and 360×640: `door`, `is-door`, `door-returning`, `lobby-signed-in`, `lobby-empty`, `lobby-new`, `composer`, `challenge-sent`, `challenge-in`, `searching`, `match-running`, `leave`. A slot-overflow test MUST render every fixed slot with its longest Icelandic and English strings.
- **FR-047**: Icelandic strings marked (?) in the source MUST ship as drafted and be marked for the native read.

### Key Entities

- **Tab presence**: one open tab of a signed-in player. It has the tab's identity, the player, the lobby language, visibility, the time hidden since, the time of last input, the time of the last heartbeat, and a leaving mark. The player's presence state (here, searching, in a match, away, gone) is derived from all their tabs plus their match and search.
- **Lobby language**: the player's current lobby (is or en), set on entering a lobby.
- **Challenge**: sender, recipient, language, created at, expires at (created + 60s), and a status: pending, accepted (with the match), declined, expired, withdrawn, superseded or left. Declines feed the pair cooldown and the three-declines rule.
- **Standing state**: derived per viewer, never stored. It is one of: incoming challenge, match running or over while away, outgoing challenge, search, or empty.
- **Poke**: a payload-free event of a given kind on a player's channel.
- **Head-to-head record**: for a viewer, an opponent and a language, the counts of wins, losses and draws over completed rated matches between them. It is derived, not stored.
- **Lobby overview**: counts per lobby, the viewer's last match (with its scored words), and the last ten results.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A player on any signed-in page sees an incoming challenge within 1s of its sending while the push channel is live, and within 3s when it is not.
- **SC-002**: A closed tab disappears from other players' lobbies within 8s when it closes normally, and within 45s in every other case: 35s without a heartbeat, plus one refresh.
- **SC-003**: No challenge is ever delivered to a player who is at a table, in a match, away or gone. A test sends to each state and every send is refused.
- **SC-004**: No control in this stage resigns a match other than `⋯ resign` followed by its confirmation. Back and `go to the lobby` in a live match leave it in progress in 100% of tests.
- **SC-005**: A first-time visitor can read what the game is and enter the lobby with one field and one press, on desktop and at 390×664, without scrolling to the primary.
- **SC-006**: Every signed-in page shows the viewer's standing state in the same place. Changing it never moves content below the slot (0px layout shift, measured).
- **SC-007**: Every fixed slot fits its longest string in both languages, verified by the overflow test.
- **SC-008**: The lobby renders its first meaningful paint without waiting for presence. Counts and rows appear within one heartbeat.
- **SC-009**: The visual suite passes for every new fixture at the four viewports. Unit, integration, lint, typecheck and `docs:check` pass.

## Assumptions

- **The empty lobby's primary.** The source makes `invite a friend ▸` the primary of an empty lobby, but invite links are stage 6. Until then the empty lobby keeps `find an opponent ▸` as its primary, and draws no invite control anywhere (below the table, in the composer's consequence lines, or in the slot).
- **Profile and rules pages.** They get the page frame and the line slot in this stage; their content is redesigned in stage 6.
- **The door headline.** The source text `Tveir leikmenn, eitt borð,` is used. One desktop artboard reads `Tveir keppendur`; the spec and the phone artboards agree on `leikmenn`, and the headline is still listed for the native read (§10 Q1).
- **Rematch** (stage 5) is untouched, except that its id-carrying broadcast becomes a poke (S6).
- **Watching a live match** (T53's notice for a non-participant) is out of scope. The existing redirect for non-participants stays.
- **Web Push** (S18), block, mute and report (S15) and provisional ratings (S20) are phase 2. The head-to-head record (S14) is pulled into this stage (Clarifications); its other uses (the table's record line, the public profile's head-to-head) wait for their own stages. The call line's `⋯` (mute and block) is not drawn.
- **The queue engine** (freshness, `queued_at` order, pause on hidden, the 3:00 check, requeue after a void, the table-leave cooldown) shipped in spec 069. This stage changes only where its states are shown (the slot, not a queue page).
- **Stakes** in the composer use the same rating calculation as the table's stakes (spec 069), computed for this pair in this language.
- **Sign-out's consequence line and its refusal during a live match** already exist (spec 067). This stage moves them into the lobby's `⋯`.

## Dependencies

- Spec 067: signed sessions, device key, the one match-creation path, sign-out that never resigns.
- Spec 068: the scoreboard, whose opponent row gains `stepped out`.
- Spec 069: the table, seating by attention, the table check (replaced by pokes plus the fallback poll), the queue engine and the table-leave cooldown.
