# Feature Specification: Invite links and profiles

**Feature Branch**: `072-invite-links-profiles`
**Created**: 2026-09-24
**Status**: Draft
**Input**: Stage 6 of the game flow redesign: invite links and profiles. Source of truth: `docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md`: A2 (door for a friend's invite), B9 (invite link out), E1 (own profile), E2 (public profile), E3 (rules), F9 (phone profile) and §7.9 row S11, with the screen map (§3) and flow graph (§4) rows that touch them (T5, T6, T20, T21, T22, T48, T51, T52, T55, T63, T64). Owner decisions in §10 are settled and are not re-asked. Design canvas https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo, artboards DoorInvite, ProfileOwn and ProfilePublic. Out of scope: head-to-head, block, report and rename (phase 2, S14 and S15); identity recovery (Supabase Auth, next phase).

## Context

After stages 1–5 a player can only play someone who is already in the lobby. In the Icelandic beta the lobby is usually empty, so a new player arrives, finds no one and leaves. The source calls the invite link "the only way to fill an empty Icelandic beta lobby" (§3, Q "Invite link: now or later?" → **now**).

Profiles exist but predate the page frame's content: they show a rating chart and a history list in the old room grid, with no form, no record in the page's language, no best words, and no way to challenge the player whose page you are reading. Stage 4 gave profile and rules the page frame and the line slot and left their content to this stage.

This stage adds:

- **Invite links.** `invite a friend ▸` makes a single-use link that lasts 10 minutes and copies it. The link is the sender's one outgoing challenge. Opening it only renders a door that names the sender, so a chat app's preview cannot use it. Pressing `accept ▸` signs the friend in (if needed) and sits both at a table, through the one match-creation path.
- **Your profile.** Your rating in this language, a 30-day chart, the last ten as a form strip, your record, and your three best words.
- **Another player's profile.** The same page in their seat colour, with their presence now (never a last-seen time) and `challenge ▸` as the one primary, with your stakes beneath it.
- **The rules page** in the page frame, reachable by `how to play ▸` from every page, with its primary set by how you arrived.

## Clarifications

### Session 2026-09-24

- Q: When the friend who accepted leaves a link table the sender has not sat at, what happens? → A: The table voids as `not_seated` with the sender as the absent player; nothing counts toward the friend's table-leave cooldown.
- Q: Is E2's "your matches" list (the viewer's matches against this player) built in this stage? → A: Yes; the head-to-head summary is not (phase 2).
- Q: Is review's `copy link ▸` (deferred by spec 071 to stage 6) built here? → A: Yes: the review `⋯` (desktop and phone) gains `copy link ▸`, copying the match's review link at `?review=last`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Invite a friend by link (Priority: P1)

Birna is alone in the Icelandic lobby. She presses `bjóða vini ▸` / `invite a friend ▸`. A link is made and copied, and her line slot shows it with its time left. She pastes it to a friend in a chat app.

**Why this priority**: It is the only way to start a match when nobody else is in the lobby, which is the usual state of the beta.

**Independent Test**: Sign in to an empty lobby, press `invite a friend ▸`. The clipboard holds a link to `/c/<token>` (or `/en/c/<token>`), and the line slot reads `Tengill afritaður · gildir í 9:58` with `afrita aftur ▸` and `ógilda tengil ▸`.

**Acceptance Scenarios**:

1. **Given** a signed-in player in an empty lobby, **When** the lobby renders, **Then** `BJÓÐA VINI ▸` / `INVITE A FRIEND ▸` is the page primary and `finna mótspilara ▸` / `find an opponent ▸` is a secondary (B1 empty state).
2. **Given** a lobby with other players, **When** it renders, **Then** below the here-now table a secondary reads `BJÓÐA VINI ▸` / `INVITE A FRIEND ▸`, followed in mono muted by `tengill sem gildir í 10 mínútur` / `a link that works for 10 minutes`.
3. **Given** the player presses `invite a friend ▸`, **When** the link is made, **Then** it is copied to the clipboard and the line slot takes the status style (precedence 4, below an incoming call, a running match and an outgoing challenge, above a search): line 1 `Link copied · valid 9:58` / `Tengill afritaður · gildir í 9:58`, secondaries `copy again ▸` / `afrita aftur ▸` and `cancel link ▸` / `ógilda tengil ▸`, and a 4px drain over 10 minutes. The wait has no primary.
4. **Given** a link is out, **When** the player sends a challenge, starts a search, accepts a call or switches lobby, **Then** the link is cancelled first, and the composer (`sending cancels your link` / `tengillinn þinn fellur úr gildi`) and the find action say so before the press.
5. **Given** a link is out, **When** the player presses `invite a friend ▸` again, **Then** the old link is cancelled and a new one replaces it (one outgoing challenge per player).
6. **Given** a link is out, **When** the player presses `cancel link ▸`, **Then** the link stops working at once, the slot reads the cancelled outcome for 4s, then returns to its next state.
7. **Given** a link reaches 0:00 unused, **When** it expires, **Then** the slot reads `link expired` / `tengillinn rann út` for 4s and returns to its next state.
8. **Given** the player moves to another signed-in page (profile, rules), **When** it renders, **Then** the link stays in the line slot with its countdown.
9. **Given** a phone, **When** a link is out, **Then** the bottom slot shows the same status line at 64px, following the same precedence.

---

### User Story 2 - A friend opens the link and accepts (Priority: P1)

Kári's friend opens the link in a browser that has never visited Wottle. They see the door with a band that says Kári challenges them, a name field and `accept ▸`. They type a name, press accept, and sit at Kári's table.

**Why this priority**: Without the arrival side, the link does nothing.

**Independent Test**: Open a fresh link in a private window. The page is A2. Enter a free name and press `accept ▸`. The friend lands on the table (C1), seated. The sender's page moves to the same table.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor opens a valid link, **When** the page renders, **Then** it is the door (A1) with these changes in column B:
   - a call-style band at the top (`--tint` ground, 3px ink left rule, a 12px `--opp` square): line 1 `Kári challenges you` / `Kári skorar á þig`; line 2 `1265 · English words · link valid 9:12` / `1187 · íslensk orð · tengill gildir í 9:12`, counting down;
   - the name label, input and error line below the band;
   - the primary `ACCEPT ▸` / `SAMÞYKKJA ▸`;
   - the secondary `enter the lobby instead` / `bara inn í lobbíið`;
   - the consequence line `Accepting signs you in with this name and seats you at Kári's table.` / its Icelandic equivalent;
   - the rest of column B (here now, how it plays, `how to play ▸`) as on A1.
2. **Given** the visitor enters a free name and presses `accept ▸`, **When** the server accepts, **Then** the visitor is signed in under that name (the same claim as the door, spec 067), the link is used, a match in the link's language is created through the one match-creation path, the visitor is seated by their press, and they land on the table (C1).
3. **Given** the name is taken, badly formed, or the visitor is rate limited, **When** they press `accept ▸`, **Then** the door's error line shows the same message as A1, the link is not used, and the band keeps counting.
4. **Given** a browser whose device key names a player after a sign-out, **When** it opens a link, **Then** column B shows the returning state (the name with a `--you` square, not an input) under the band, `accept ▸` signs them in as that player, and `not Birna? · use another name` shows the empty input.
5. **Given** the visitor presses `enter the lobby instead`, **When** they enter, **Then** they sign in as on A1 and the link stays unused and valid, shown in their line slot as an incoming link call (Story 3).
6. **Given** an expired, used or cancelled link, **When** it is opened, **Then** the band reads `this link has expired` / `þessi tengill er útrunninn` with no countdown, and the primary returns to `enter the lobby ▸` / `inn í lobbíið ▸`. The page never says which of the three it was.
7. **Given** a link made in one language is opened under the other locale's path, **When** it is requested, **Then** it redirects to its own locale's path. It never reads as expired.
8. **Given** any request that only reads the link (a chat app's preview, a prefetch, a crawler, a reload), **When** it is served, **Then** nothing is created, used or changed. Only the explicit accept press does that.

---

### User Story 3 - A signed-in player opens a link (Priority: P1)

Hekla sends a link to Birna, who is already signed in. Birna taps it and lands in her lobby with Hekla's invitation in the line slot.

**Why this priority**: Most links will reach players who have played before.

**Independent Test**: Signed in, open someone else's valid link. The URL becomes the lobby, the slot shows `Hekla invites you by link · accept ▸`, and accept seats Birna at Hekla's table.

**Acceptance Scenarios**:

1. **Given** a signed-in player opens another player's valid link, **When** it is requested, **Then** it redirects to the lobby of the link's language, with the link's call in the line slot in call style: line 1 `Hekla invites you by link` / `Hekla býður þér með tengli`, line 2 the sender's rating, the language and `link valid 9:12`, and `accept ▸` as the call's action. Nothing is created by opening it.
2. **Given** the call is shown, **When** the player presses `accept ▸` (after the 500ms guard), **Then** they are seated at a new table with the sender. Their own search, outgoing challenge, link and rematch request are withdrawn, as for any accept.
3. **Given** the player dismisses or ignores the call, **When** they leave the lobby, **Then** the call is gone for this session; opening the link again brings it back while the link is valid.
4. **Given** the player's lobby language differs from the link's, **When** they land on the link's lobby, **Then** the lobby-language rule of spec 070 applies: it switches at once, unless a search, challenge or link of theirs is out, in which case the consequence line comes first.
5. **Given** the player is in a pending or live match, **When** they open a link, **Then** they are sent to their match; the link is not used.
6. **Given** the sender opens their own link, **When** it is requested, **Then** it redirects to the lobby with `this is your link · copy ▸` / `þetta er tengillinn þinn · afrita ▸` in the slot. Their link is unchanged.

---

### User Story 4 - The sender is brought to the table (Priority: P1)

Kári made a link and went to read the rules. His friend accepts. Kári's tab pulls him to the table; if the tab was hidden it plays the cue, changes the title and shows a notification. The table waits for him until the link would have expired.

**Why this priority**: The sender is often away from the lobby when the link is used, and a 20s table would void before they noticed.

**Independent Test**: Make a link, hide the tab, accept from a second browser. The first tab plays the cue, its title shows the table, and pressing `ready ▸` within the link's remaining time starts the match.

**Acceptance Scenarios**:

1. **Given** a friend accepts the sender's link, **When** the match is created, **Then** the sender's pages push to its table (C1), with the `challenge` cue, the title and an OS notification when the tab is hidden and permission was granted (the §7.7 "link opened" event).
2. **Given** the sender's attention is fresh (a visible tab with input in the last 30s), **When** the table opens, **Then** the sender is seated by the input rule of spec 069.
3. **Given** the sender is not seated, **When** the table is shown, **Then** its deadline is the link's expiry time, not 20s, and the friend's slip reads `THE TABLE WAITS · 9:12` / `BORÐIÐ BÍÐUR · 9:12` while the sender is away.
4. **Given** the sender has not sat down, **When** the friend leaves the table (`leave`, or Back), **Then** it voids as `not_seated` with the sender as the absent player, and the leave does not count toward the friend's table-leave cooldown.
5. **Given** the sender never sits down, **When** the link's expiry passes, **Then** the table voids as `not_seated` under spec 069's rules (no rating, no history), and the friend reads the void slip.
6. **Given** two browsers press `accept ▸` on the same link at the same moment, **When** both reach the server, **Then** exactly one creates a match; the other reads `this link has expired`.
7. **Given** the sender became busy between making the link and its use (a race the one-commitment rule should prevent), **When** a friend accepts, **Then** no match is created and the friend reads `this link has expired`.

---

### User Story 5 - Your own profile (Priority: P2)

Birna opens her profile from the masthead. She sees her Icelandic rating, how it moved in the last 30 days, her last ten results, her record and her three best words, and can open any recent match.

**Why this priority**: It is the one place a player sees their progress; it is not needed to play.

**Independent Test**: Open `/profile` with fixture IS-T1. The page shows `Birna` and `1212`, the sub-lines, the chart, the form strip `S S T S T S S T S S`, the record `20 · 15 · 0 · 57%`, the best words HESTAR 32, BORÐA 29, SKÍRN 24, and eight recent matches.

**Acceptance Scenarios**:

1. **Given** a signed-in player opens `/profile` (or `/en/profile`), **When** it renders, **Then** column A shows:
   - **Name row:** a 16px `--you` square, the name as the page's one `h1`, and the rating in this page's language right-aligned in `--you`.
   - **Sub-line:** `@birna · spilar síðan í mars 2026 · 35 viðureignir` / `@birna · playing since March 2026 · 35 matches`; right: `ELO · ÍSLENSKA · HÆST 1216 · +16 Í VIKUNNI` / `RATING · ENGLISH · PEAK 1216 · +16 THIS WEEK`.
   - **Chart** of the rating in this language over the last 30 days, labelled `FYRIR 30 DÖGUM` / `30 DAYS AGO` and `Í DAG` / `TODAY`. With no matches in the window, a flat line at the current rating labelled `1212 · engar viðureignir síðustu 30 daga` / `1212 · no matches in the last 30 days`.
   - **Form strip** `SÍÐUSTU TÍU` / `LAST TEN`, with the same cells, letters and label as the lobby's (B1), win bars in `--you`.
   - **Record row:** four ruled cells, `20 · 15 · 0 · 57%` over `SIGRAR · TÖP · JAFNTEFLI · SIGURHLUTFALL` / `WON · LOST · DRAWN · WIN RATE`.
   - **Best words** `BESTU ORÐIN` / `BEST WORDS`: three word strips (letters on cells with their values, a `--you` band and a chevron), each with its score beside it.
2. **Given** column B, **When** it renders, **Then** it shows, in order: the primary `FINNA MÓTSPILARA ▸` / `FIND AN OPPONENT ▸`; `NÝLEGAR VIÐUREIGNIR` / `RECENT MATCHES` with up to eight rows (opponent, score, `sigur` / `tap` / `jafnt` or `win` / `loss` / `draw`, `skoða ▸` / `review ▸`); a rule; the other language's profile link `ENSKA · 1310 ▸` / `ICELANDIC · 1212 ▸`, or `engar viðureignir á ensku enn` / `no Icelandic matches yet`; and `skrá út` / `sign out` with the same consequence line and disabling as the lobby.
3. **Given** a recent match row, **When** `review ▸` is pressed, **Then** the match opens in review at its last step (`/match/:id?review=last`).
4. **Given** a call arrives while on the profile, **When** it is in the line slot, **Then** its `accept ▸` is the page primary and `find an opponent ▸` is drawn as a secondary.
5. **Given** a player with no matches in this language, **When** the profile renders, **Then** the rating reads 1200, the sub-line reads `1200 · ELO · ÍSLENSKA · ENGIN VIÐUREIGN ENN` / `1200 · RATING · ENGLISH · NO MATCHES YET`, the chart shows its empty state, the form strip is ten empty cells, the record reads `0 · 0 · 0 · —`, and best words and recent matches read one line each: `Fyrsta viðureignin þín birtist hér.` / `Your first match will show here.`.
6. **Given** the profile, **When** its title and folio are read, **Then** the folio is `ORÐUSTA · PRÓFÍLL · BIRNA` / `WOTTLE · PROFILE · BIRNA` and the tab title names the player and the wordmark.

---

### User Story 6 - Another player's profile and challenge ▸ (Priority: P2)

Birna taps Kári's name in the English lobby. His page shows his English rating, form, record and best words in his seat colour, whether he is here now, and `challenge ▸` with Birna's stakes beneath it.

**Why this priority**: It turns reading about a player into playing them.

**Independent Test**: With fixture EN-L, open `/en/profile/k%C3%A1ri`. The page shows `Kári 1265` in terracotta, `HERE NOW`, `CHALLENGE ▸`, and `english words · win +7 · draw −1 · loss −9`. Pressing challenge opens the composer in column B; sending puts `sent · 0:41` in the primary slot and `withdraw ▸` in the line slot.

**Acceptance Scenarios**:

1. **Given** a signed-in player opens another player's profile, **When** it renders, **Then** column A has E1's layout in the other player's seat colour: name and rating in `--opp`, the chart line and form-strip win bars in `--opp`, best-word letters in `--opp` and numerals in `--opp-text`. The sub-lines read `@kári · playing since April 2026 · 41 matches` and `RATING · ENGLISH · PEAK 1281 · −4 THIS WEEK`.
2. **Given** the page, **When** presence is shown, **Then** a presence line in mono reads exactly one of: `HERE NOW` / `HÉR NÚNA`; `in a match · 6 of 10` / `í viðureign · 6 af 10`; `away` / `fjarverandi`; `in the Icelandic lobby` / `í enska lobbíinu`; `not here` / `ekki hér`. No last-seen time, date or duration is ever shown, and none is sent to the browser.
3. **Given** the player is here in this lobby and can be challenged, **When** column B renders, **Then** the one primary is `CHALLENGE ▸` / `SKORA Á ▸`, with the viewer's stakes beneath it in mono: `english words · win +7 · draw −1 · loss −9` / `íslensk orð · sigur +9 · jafntefli +1 · tap −7`, built from both ratings and the viewer's K as in the lobby composer.
4. **Given** `challenge ▸` is pressed, **When** the composer opens in column B, **Then** it holds the terms and stakes, any consequence line (search, other challenge, link), `send challenge ▸` and `not now`, with the same focus, Esc and guard rules as the lobby composer (B2), and sending goes through the same one send decision.
5. **Given** the viewer's challenge to this player is out, **When** the page renders, **Then** the primary slot reads `sent · 0:41` / `sent · 0:41` (counting) and the line slot carries `withdraw ▸`. Its outcomes (declined, no answer, started another match, left) read in the primary slot and the line slot as in the lobby.
6. **Given** the player is in a match, away, in the other lobby or not here, or the pair is in cooldown or the viewer is silenced or rate limited, **When** column B renders, **Then** there is no `challenge ▸`; the presence line (and, for cooldowns and limits, the same wording as the lobby row) says why, and the page has no primary.
7. **Given** column B, **When** it renders below the primary, **Then** `YOUR MATCHES` / `ÞÍNAR VIÐUREIGNIR` lists the viewer's matches against this player in this language, newest first, each with date, score, result and `review ▸`. The head-to-head summary (`you and Kári · 2–1`) is not shown (phase 2).
8. **Given** a phone, **When** the page renders (F9), **Then** the primary is pinned at the bottom (`skora á ▸`), and the stakes line sits directly above it.

---

### User Story 7 - Profiles for anyone, and handles in URLs (Priority: P3)

A signed-out visitor follows a profile link someone shared. They see the player's page without the challenge action, and can enter the lobby from it.

**Why this priority**: Profiles are shareable, but the main path is signed in.

**Independent Test**: Signed out, open `/profile/k%C3%A1ri`. Kári's page renders with no presence-driven challenge; the primary is `enter the lobby ▸`, which leads to the door and returns to the profile after entering.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor opens a public profile, **When** it renders, **Then** column A is as for a signed-in viewer but drawn in `--you` (there is no viewer seat), the presence line is shown, there are no stakes and no `challenge ▸`, and the primary is `enter the lobby ▸` / `inn í lobbíið ▸`, which opens the door with `?next=` back to this profile.
2. **Given** a signed-out visitor opens `/profile` (their own), **When** it is requested, **Then** they are sent to the door with `?next=/profile`.
3. **Given** a signed-in player opens their own handle's public URL, **When** it is requested, **Then** it redirects to `/profile`.
4. **Given** a handle with Icelandic letters, **When** a link to it is built, **Then** it is percent-encoded (`/profile/k%C3%A1ri`), and both encoded and unencoded forms resolve to the same player.
5. **Given** an unknown handle, **When** it is opened, **Then** the page reads `no player by that name` / `enginn leikmaður með þetta nafn` with `how to play ▸` and the lobby link, and responds as not found.

---

### User Story 8 - The rules, from every page (Priority: P3)

From the door, the invite door, the lobby, a profile, a match, the result or a review, a player can reach the rules; the rules page tells them what to do next.

**Why this priority**: Learning the game should never cost a player their place.

**Independent Test**: Follow `how to play ▸` from each page. Each reaches `/rules` (or `/en/rules`); from a match it opens in a new tab, and that tab's primary is `close this tab ▸`.

**Acceptance Scenarios**:

1. **Given** any page, **When** the player looks for the rules, **Then** `how to play ▸` / `leiðbeiningar ▸` is present: in column B on the door and the invite door, in the masthead on every signed-in page, in `⋯` on a phone page, and in the match `⋯` menu (opening a new tab).
2. **Given** the rules page, **When** it renders, **Then** it is in the page frame with the strip in the masthead, the masthead's `how to play ▸` marked as the current page, the line slot for a signed-in player, and the existing rules content.
3. **Given** the rules page, **When** its primary is chosen, **Then** it is: `find an opponent ▸` for a signed-in player with nothing standing; `close this tab ▸` / `loka flipanum ▸` when opened from a match (it closes the tab, or, if the browser refuses, returns to the match); `enter the lobby ▸` for a signed-out visitor. A call in the line slot takes the primary as on every page.
4. **Given** the rules text, **When** it is read, **Then** the `10moves` typo is fixed, and the clock line describes the clock as it is drawn today: it darkens under a minute and counts the last 15 seconds in words; nothing flashes.

---

### Edge Cases

- **Two accepts on one link** (two devices, a double press): exactly one match; the other press reads expired (Story 4.6).
- **The friend is the sender** in another browser (the same player via device key): treated as the sender (Story 3.6), never as an accept.
- **The friend is busy** (in a pending or live match): accept is refused as busy; the link stays valid for someone else.
- **The friend is in the table-leave cooldown** (spec 069): accepting stays open, as for challenges.
- **The sender is in the table-leave cooldown**: `invite a friend ▸` is refused like sending a challenge, reading `find again in 4:12` in the same place.
- **Rate limits**: making a link counts toward the sender's challenge rate limit (6 per minute). Accept presses are limited like other accepts.
- **The sender signs out** with a link out: the link is cancelled (sign-out withdraws challenges and links, §7.5 item 13).
- **The sender reloads** the page with a link out: the slot keeps the link and its countdown. If this browser no longer has the link's text, `copy again ▸` is replaced by `new link ▸`, which cancels the old link and makes a fresh one.
- **The clipboard is refused** by the browser: the slot reads `Link ready · valid 9:58` / `Tengill tilbúinn · gildir í 9:58` and shows the link as selectable text in the slot's place for line 2; on a phone the system share sheet is offered where available.
- **A link opened at 0:00 exactly**: whichever the server decides (expiry is judged by the server's clock at accept) is final; the band re-reads expired if the accept is refused.
- **Guessing links**: the token is long and random, only its hash is stored, and wrong tokens read exactly like expired ones.
- **Profile of a player with ratings only in the other language**: this language reads as a new player (Story 5.5) and the other-language link shows their rating there.
- **Void and abandoned matches** never appear in recent matches, your matches, the form strip, the record, the chart or best words.
- **A best word scored more than once**: it appears once, at its highest score. Ties are broken by the earlier match.
- **Presence changes while the page is open**: the presence line and `challenge ▸` update within the lobby's poke/poll interval; an open composer stays open, and its send is refused with the lobby's wording if the player is no longer challengeable.
- **Long names and strings**: every fixed slot (band, presence line, stakes, sent state) holds its longest string in either language without overflow at 1440 and 390.

## Requirements _(mandatory)_

### Functional Requirements

**Invite links out (B9, S11)**

- **FR-001**: A signed-in player MUST be able to make an invite link from the lobby (`invite a friend ▸`), which is the page primary in an empty lobby and a secondary below the here-now table otherwise.
- **FR-002**: A link MUST be single use, valid for 10 minutes from creation, and bound to its sender and the sender's lobby language at creation.
- **FR-003**: The server MUST store only a one-way hash of the link's token, never the token itself. Tokens MUST be long enough and random enough that guessing one is impractical.
- **FR-004**: A link MUST count as the sender's one outgoing challenge: making it withdraws an earlier challenge or link and cancels the sender's search; sending a challenge, starting a search, accepting anything, switching lobby or signing out cancels it.
- **FR-005**: Making a link MUST copy it to the clipboard and show it in the line slot as a status state, below an incoming call, a running match and an outgoing challenge, and above a search, with `copy again ▸`, `cancel link ▸`, the time left, and a 4px drain over its life.
- **FR-006**: Making a link MUST be refused, with the same wording as a refused send, while the sender is in a pending or live match, in the table-leave cooldown, or over the challenge rate limit.
- **FR-007**: `cancel link ▸` MUST make the link unusable at once. Expiry and cancel MUST each show a 4s outcome in the slot.

**Opening a link (A2, T5, T6, T55, T64)**

- **FR-010**: Opening a link (the GET) MUST only render or redirect. It MUST NOT create a match, use the link, sign anyone in or write any state.
- **FR-011**: A link opened under the other locale's path MUST redirect to its own locale.
- **FR-012**: For a signed-out visitor, a valid link MUST render the invite door (A2): the door with the call band naming the sender, their rating, the language and the time left; the name input (or the returning state); `accept ▸`; `enter the lobby instead`; and the consequence line.
- **FR-013**: An expired, used or cancelled link, or a token that matches nothing, MUST render the same `this link has expired` band with `enter the lobby ▸` as the primary. The four cases MUST be indistinguishable to the visitor.
- **FR-014**: For a signed-in player, a valid link MUST redirect to the lobby of the link's language with the link's call in the line slot (`Hekla invites you by link · accept ▸`). For the sender, it MUST redirect to the lobby with `this is your link · copy ▸`. For a player in a pending or live match, it MUST redirect to that match.
- **FR-015**: The link's pages MUST not be indexed by search engines, and their preview metadata MUST name at most the sender and the language.

**Accepting a link (T5, T63, S2)**

- **FR-020**: Accepting MUST be an explicit POST, guarded for 500ms after the control appears.
- **FR-021**: For a signed-out visitor, accept MUST first sign them in with the same name rules, claim and errors as the door; a sign-in failure MUST leave the link unused.
- **FR-022**: Accept MUST use the link by compare-and-set: of any number of concurrent accepts, exactly one succeeds, and the rest read expired.
- **FR-023**: A successful accept MUST create the match through the one match-creation path (`create_match_between`), in the link's language, with origin `link`, the accepter seated by their press. It MUST be refused if either player is busy, and the refusal MUST leave the link valid when the sender is not the busy one.
- **FR-024**: The link table MUST wait for its sender until the link's expiry time (not the 20s table deadline). The sender MUST be seated by the input rule of spec 069, or by `ready ▸`. A table not filled by then MUST void as `not_seated`. If the accepter leaves before the sender sits, the table MUST void as `not_seated` (the sender absent), and the leave MUST NOT count toward the accepter's table-leave cooldown.
- **FR-025**: The sender's open pages MUST be poked and pushed to the table, with the `challenge` cue, the title and an OS notification when hidden (the §7.7 "link opened" event). While the sender is not seated, the accepter's slip MUST read `THE TABLE WAITS · m:ss` / `BORÐIÐ BÍÐUR · m:ss`.
- **FR-026**: The accepter's own search, outgoing challenge, link and rematch request MUST be withdrawn on accept, as for any accept.

**Your profile (E1, F9)**

- **FR-030**: `/profile` and `/en/profile` MUST show the signed-in player's profile in the page's language: name (`h1`), rating, handle, the month they started playing, matches played in this language, peak rating in this language, and the rating change over the last 7 days.
- **FR-031**: The profile MUST draw a chart of the rating in this language over the last 30 days, with a flat-line empty state at the current rating.
- **FR-032**: The profile MUST show the form strip of the last ten matches in this language (the lobby's form strip), the record (won, lost, drawn, win rate = won ÷ matches, rounded to a whole percent, `—` with no matches), and the three best words in this language by score.
- **FR-033**: Column B MUST hold `find an opponent ▸` as the primary (a secondary while a call is up), up to eight recent matches with `review ▸`, the other language's profile link or its empty line, and `sign out` with the lobby's consequence line and disabling.
- **FR-034**: Counts, record, form, chart and best words MUST include only rated matches that were played (never void or abandoned) in this language.

**Another player's profile (E2, F9)**

- **FR-040**: `/profile/:handle` MUST show another player's profile with E1's column A in that player's seat colour relative to the viewer, via the seat colour mapping, never player A/B.
- **FR-041**: The page MUST show exactly one presence word for the player (here now, in a match with their move count, away, in the other lobby, not here). No last-seen time MUST ever be shown, and none MUST be included in any data sent to the browser for this page.
- **FR-042**: When the player is here in this lobby and challengeable by the viewer, `challenge ▸` MUST be the page's one primary, with the viewer's stakes (win, draw, loss rating changes and the language) beneath it.
- **FR-043**: `challenge ▸` MUST open the lobby's composer in column B and send through the same one send decision, with the same refusals, cooldowns, limits and outcomes. A sent challenge MUST show in the primary slot (`sent · 0:41`) and in the line slot with `withdraw ▸`.
- **FR-044**: When the player is not challengeable, the page MUST show no `challenge ▸` and no primary, and say why in the presence line or with the lobby row's cooldown wording.
- **FR-045**: Column B MUST list the viewer's matches against this player in this language with `review ▸`. The head-to-head aggregate, block and report MUST NOT be drawn.
- **FR-046**: Signed out, a public profile MUST render without stakes or challenge, with `enter the lobby ▸` returning to it after entry. A player opening their own public URL MUST be redirected to `/profile`. An unknown handle MUST read `no player by that name` and respond as not found.
- **FR-047**: Handles in profile links MUST be percent-encoded, and encoded and unencoded forms MUST resolve alike.

**Phone profile (F9)**

- **FR-050**: At phone widths the profile MUST stack: name with the rating on its own line, sub-lines on two lines, a 358-wide chart, the form strip, the record row, 32px best-word strips, the recent matches, and the primary pinned at the bottom (the call line takes its place while a call is up). The page MUST scroll with its last row clear of the pinned slot.

**Rules and `how to play ▸` (E3)**

- **FR-060**: `how to play ▸` MUST reach `/rules` (in the page's locale) from every page: the door, the invite door, the lobby, both profiles, the rules page itself (marked current), and from a match, the result and review through the match `⋯` menu in a new tab.
- **FR-061**: The rules page MUST be in the page frame, with the line slot for a signed-in player, and its primary chosen by state: `find an opponent ▸` (signed in, nothing standing), `close this tab ▸` (opened from a match; falls back to returning to the match when the tab cannot close), `enter the lobby ▸` (signed out).
- **FR-062**: The rules text MUST fix the `10moves` typo and describe the clock as currently drawn (it darkens under a minute; nothing flashes), in both languages.
- **FR-063**: The review foot's `⋯` (desktop and phone) MUST offer `copy link ▸` / `afrita tengil ▸`, copying the match's review link (`/match/:id?review=last` in the match's locale), with a 2s `link copied` / `tengill afritaður` confirmation in place.

**Copy, language and accessibility**

- **FR-070**: Every new string MUST exist in both languages; Icelandic strings the source marks `(?)` MUST be marked for native reading.
- **FR-071**: Each page MUST have exactly one `h1`, the landmarks of the page frame, and pass automated accessibility checks at 1440×900 and 390×844 in both languages.
- **FR-072**: Every count and duration (10 minutes, moves, clock) MUST come from configuration, never literals.
- **FR-073**: Every new page state MUST have a static fixture on the page fixture route and a visual baseline, including: invite door (valid, expired, returning), link out in the slot, link call in the slot, own profile (full, new player, with a call), public profile (here, sent, in a match, away, signed out), and phone profile.

### Key Entities

- **Match link**: an invite a player sends by link. It holds the token's hash (never the token), the sender, the sender's lobby language at creation, when it expires (10 minutes after creation), when it was used or cancelled, and the match it created. It is the sender's one outgoing challenge while it is valid.
- **Link table**: a table whose origin is a link. Its deadline is the link's expiry time rather than 20s.
- **Profile summary**: derived per player and language: rating, peak, 7-day change, matches played, first month played, record, last ten, the 30-day rating series and the three best words. It never carries last-seen times.
- **Presence word**: derived from spec 070's per-tab presence for one player as seen by one viewer: here, in a match (with move count), away, in the other lobby, not here.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A player in an empty lobby can make and copy an invite link in one press, and a friend on a fresh browser can go from opening the link to sitting at the table in under 30 seconds.
- **SC-002**: Across 100 rounds of two browsers pressing `accept ▸` on the same link at the same moment, exactly one match is created each time.
- **SC-003**: Fetching a link's page any number of times (previews, reloads, prefetches) changes nothing: the link stays valid and no match or player is created, in 100% of runs.
- **SC-004**: An expired, used, cancelled and made-up link render identical pages.
- **SC-005**: When a friend accepts, the sender's open page reaches the table within 2 seconds, and a hidden tab also plays the cue and changes its title.
- **SC-006**: A link table voids only after the link's expiry time, never after 20 seconds.
- **SC-007**: A player never has a link and another outgoing challenge or search at the same time, under any sequence of presses.
- **SC-008**: On fixture IS-T1 the own profile shows rating 1212, record `20 · 15 · 0 · 57%`, form `S S T S T S S T S S` and best words HESTAR 32, BORÐA 29, SKÍRN 24; on EN-L Kári's profile shows `HERE NOW`, `CHALLENGE ▸` and `win +7 · draw −1 · loss −9`.
- **SC-009**: No response for any profile page or its data contains a last-seen time.
- **SC-010**: From a public profile, a signed-in player can send a challenge in two presses (`challenge ▸`, `send challenge ▸`).
- **SC-011**: `how to play ▸` reaches the rules from every page listed in FR-060, and from a match it never navigates the match tab.
- **SC-012**: Every new fixture passes the visual suite at three viewports and automated accessibility checks with no violations, in both languages.

## Assumptions

- **Link life and waiting.** 10 minutes (§7.1 link TTL), and a link table waits for its sender until that time (§3 timings). The countdown on the invite door and in the call is the link's remaining time.
- **Rate limits.** Making a link counts toward the challenge rate limit of spec 070 (6 per minute) and is refused during the table-leave cooldown like a send. It is not subject to the per-pair decline cooldown or the three-declines rule, since it has no recipient until accepted.
- **"Enter the lobby instead" keeps the link.** The visitor who declines to accept from the door still sees the link's call in their slot (Story 2.5), since the link remains valid. There is no decline action on a link; ignoring it lets it expire.
- **Reload and copy again.** Because only the hash is stored, the server cannot show the link again. The browser that made it keeps its text for the link's life; any other page or device of the sender offers `new link ▸` in place of `copy again ▸`.
- **Clipboard fallback.** Where the clipboard is refused, the link is shown as selectable text, and a phone offers its share sheet where available. This is not drawn in the source.
- **Preview metadata.** The link's page title and preview name the sender and the language (`Kári challenges you · Wottle`), and are marked not to be indexed. This follows from "the GET only renders"; the source does not draw the preview.
- **Profile language.** A profile shows the ratings, record, form, chart and best words of the page's language (`/` Icelandic, `/en` English), per spec 060's per-language ratings. "Matches" in the sub-line counts matches in this language.
- **Peak and week.** Peak is the highest rating ever held in this language. "This week" is the change over the last 7 days, shown only when non-zero.
- **Best words** are the three highest-scoring distinct words the player scored in this language, from the stored word score rows, each at its highest score.
- **Signed-out profiles.** With no viewer there are no seats, so the profile owner is drawn in `--you`, following review's rule for non-participants (the first seat takes `--you`).
- **The rules clock line.** E3 asks for "in the last 15 seconds it flashes", which predates spec 068's "nothing blinks". The line follows spec 068.
- **Phone rules link.** The phone masthead holds only the player and `⋯`, so `how to play ▸` lives in the phone `⋯` menu on signed-in pages.

## Dependencies

- Spec 067: the name claim and device key (the invite door's sign-in), and `create_match_between`.
- Spec 069: the table, seating by input, the void and the table-leave cooldown.
- Spec 070: the page frame, the line slot and its precedence, per-tab presence, pokes, the composer and the one send decision, the challenge rate limit and per-pair cooldown, the form strip, the lobby-language rule, and the notification and cue rules.
- Spec 071: review at `?review=last`, used by every `review ▸` on a profile.
- Spec 060: per-language ratings and locale routing.
