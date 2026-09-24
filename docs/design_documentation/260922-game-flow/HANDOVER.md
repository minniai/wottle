# Game flow: handover to implementation

The game flow redesign is specified in [`GAME_FLOW_SPEC.md`](GAME_FLOW_SPEC.md) and drawn on the design canvas at https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo (33 artboards). This file splits the work into six stages, each a Speckit feature with its own branch and PR, and gives the prompt that starts each one.

## How to run a stage

1. Start a new Claude Code session on an up-to-date `main`.
2. Paste the stage's prompt. It opens with `/speckit.specify`; continue with `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks` and `/speckit.implement` as CLAUDE.md requires.
3. Merge the stage's PR before starting the next one. The order matters: each stage builds on the server work of the ones before it.

The canvas is private. A session signed in to the owner's account reads it with the Artifact tool: `read` with the canvas URL lists the files, and each artboard is `project/<Name>.dc.html` (for example `project/Match.dc.html`). Share the canvas from its page before handing it to anyone else.

## Rules for every stage

- **CLAUDE.md is binding:** Speckit, TDD, server-authoritative logic, the design system, and the rules document for anything that touches scoring.
- **The owner's decisions are final.** Spec §10 records the answers to every open question (23 September 2026). Do not ask them again in clarify.
- **Later amendments win.** The amendments at the end of the spec supersede the earlier text. For the match room the current ones are _the scoreboard_ and _the opponent's colour and the penalty red_; the ledger clock, match rail and boxed clock amendments are history.
- **Design system in the same PR.** A stage that changes what the player sees updates `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` (spec §8) and CLAUDE.md's Design section in the same PR.
- **Rules document in the same PR.** A stage that changes the rules updates `docs/prd_and_requirements/wottle_game_rules.md` (spec §8b).
- **Fixtures and visual tests.** New or changed room states get a `/dev/room` fixture phase. Baselines change only through `pnpm test:visual --update-snapshots`, and the Linux set comes from the CI visual job.
- **Icelandic strings marked (?) ship as drafted.** They stay listed for a native read in spec §10 Q1.
- **Out of scope in every stage:**
  - phase 2: S15 block, report and rename, S16 reactions, S17 best-here hints, S18 Web Push, S20 provisional ratings and the 1200 pairing rule (S14 head-to-head was built in stage 4)
  - identity recovery, which comes with Supabase Auth in the next phase
  - watching live matches and following players, both out of this beta
  - cross-language challenges, S19, which is withdrawn

## The stages

| #   | Stage                                              | Server work (§7.9)            | Screens                                | Status (24 September 2026)                                |
| --- | -------------------------------------------------- | ----------------------------- | -------------------------------------- | --------------------------------------------------------- |
| 1   | Identity and one commitment at a time              | S1, S2                        | A1 returning door, name taken          | Merged, spec 067, PR #310                                 |
| 2   | The scoreboard, one grid, colours and brand casing | none                          | C4, C6, C8, F3, F8 (resign, end early) | Merged, spec 068, PR #313                                 |
| 3   | The table                                          | S3, S7, S12, S13 (table rows) | C1, C2, C3, F5                         | Merged, spec 069, PR #317                                 |
| 4   | Door, lobby, challenges and presence               | S4, S5, S6, S10 (and S14)     | A1, B1–B8, C7, F1, F2, F6, F8 (leave)  | Built on branch `070-door-lobby`, spec 070; PR not opened |
| 5   | Result, rematch and review                         | S8, S9, S13 (review rows)     | D1, D2, D3, F4, F7                     | Not started                                               |
| 6   | Invite links and profiles                          | S11                           | A2, B9, E1, E2, E3, F9                 | Not started                                               |

### Stage 1 · Identity and one commitment at a time

```
/speckit.specify Stage 1 of the game flow redesign: identity, and one commitment at a time.

Source of truth: docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md — §1 verdict problems 2 and 3, §7.5 server invariants, §7.8 safety (must-have parts only), §7.9 rows S1 and S2, and the A1 door's returning and name-taken states. Owner decisions are in §10; do not re-ask them.
Design canvas (read with the Artifact tool): https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo — artboards DoorReturning, DoorIs, DoorEn.

Build:
- An HMAC-signed session cookie. The current cookie is unsigned base64 JSON, so anyone can become anyone.
- Sign-out no longer resigns the player's match (retire resignActiveMatch in logout.ts).
- create_match_between(a, b, language, origin, ref) and accept_invite(invite, actor): the only way a match is created. The queue claim, challenge accept, crossed challenges, rematch accept, crossed rematches and link accept all call it, so one player can never be booked into two matches.
- The returning door and the `name taken · pick another` message.

Supabase Auth is planned for the next phase and will replace much of S1. In /speckit.clarify, settle how much of S1's device key and claim hash to build as a bridge. The signed cookie and the single match-creation function are needed either way.

Out of scope: every other screen change; phase 2 items (S14–S20); identity recovery.
```

### Stage 2 · The scoreboard, one grid, colours and brand casing

```
/speckit.specify Stage 2 of the game flow redesign: the match room's scoreboard, one grid for board and ledger, the new colours and the capitalised brand.

Source of truth: docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md — C4 (match), C6 (resign slip), C8 (disconnect and end early), F3 (phone match), F8 (resign and end-early slips on a phone), §8 design-system amendments items 5, 6, 8, 9, 11, 12 and 14, and the two current amendments at the end of the file: "the scoreboard" and "the opponent's colour and the penalty red". The earlier clock amendments are superseded. Owner decisions are in §10; do not re-ask them.
Design canvas (read with the Artifact tool): https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo — artboards MatchRail (the scoreboard sheet), Match, MatchLastMinute, ResignSlip, Disconnect, PhoneMatch, PhoneMatchShort.

Build:
- One scoreboard box above the board. Row 1 is the match clock: ten 30s blocks of six 5s ticks, the numeral and the pace. Row 2 is the opponent and row 3 is you: name, sub-line, that player's ten moves on the same ten-column track, and their total. The player bars around the field go away. Urgency is weight only, and nothing blinks.
- One grid. The ledger's first three rows mirror the scoreboard's rows, and each move row sits level with a row of the board (desktop field 713px, 71px cells). Phone: the scoreboard at 358px with 34px rows and no tick marks.
- Colours: `--opp` burnished terracotta #B56A4F (bands at 14% and 30%); `--opp-text` #A1583D for opponent text under 17px; a new `--err` crimson #AD1F3D used only for points lost (`−5` no word, `−5` not played, `−15 if unplayed`). Only the number is crimson; its label stays muted. Rating losses stay ink.
- Brand casing: Orðusta and Wottle are capitalised everywhere, including the ledger wordmark and tab titles.
- Update WOTTLE_DESIGN_SYSTEM.md: tokens, the scoreboard replacing the bars and the ledger clock, the wordmark's casing. Update CLAUDE.md's Design section. Add /dev/room fixture phases and refresh the visual baselines.

Out of scope: the table, lobby, result and review screens; any server change.
```

### Stage 3 · The table

```
/speckit.specify Stage 3 of the game flow redesign: the table. Nobody is rated for a match they did not sit down at.

Source of truth: docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md — §1 verdict problems 1 and 5, C1 (table), C2 (starting), C3 (void), F5 (phone table), §4 flow rows for the table, §7.3 seating and the table, §7.9 rows S3, S7 and S12, §8 item 2 (the ready and void slips), and §8b's table rows for the rules document (S13). Owner decisions are in §10; do not re-ask them. The timings are confirmed: 20s to sit down; a 5-minute cooldown after two table leaves in 10 minutes.
Design canvas (read with the Artifact tool): https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo — artboards Table, Starting, Void, PhoneTable.

Build:
- Every match begins at the table. The field is an empty frame, and the server holds the board until both players are seated. The seating rules are in §7.3: your own press seats you, and so does a visible tab with input in the last 30s; anyone else gets `ready ▸` / `ég er til ▸` and 20s.
- seat_player sets started_at to now + 4.5s. The server's 3·2·1 plays in the scoreboard's clock row while the letters land.
- Void: nothing is rated, the seated queue player goes back to the front of the queue, and the absent player's search stops. resignMatch refuses a pending match; leaveTable leaves it.
- The queue (S7): queued_at order, a 10s freshness filter, a hidden tab pauses its search on every device, the 3:00 "still searching?" check, and requeue at the front after a void.
- The table-leave cooldown (S12).
- The rules document amendments for the table (§8b).

Out of scope: lobby challenges and presence (stage 4); rematch (stage 5).
```

### Stage 4 · Door, lobby, challenges and presence

```
/speckit.specify Stage 4 of the game flow redesign: the door, the lobby, challenges and presence.

Source of truth: docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md — §2 principles, §3 screen map, §4 flow graph, §5.0 shared frames, A1 (door), B1–B8 (lobby, composer, sent and outcomes, incoming, incoming elsewhere, searching, your match running), C7 (leave slip), F1, F2, F6 and F8's leave slip, §6 logo and landing, §7.1 presence, §7.2 lobby language, §7.4 challenge lifecycle, §7.7 notification rules, §7.8 (must-have parts), §7.9 rows S4, S5, S6 and S10, and §8 items 1, 3, 4, 7, 10 and 13. Owner decisions are in §10; do not re-ask them. Signed-out visitors see the names of players here now. Challenges stay within one language's lobby. The timings are confirmed: challenge 60s, decline cooldown 60s.
Design canvas (read with the Artifact tool): https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo — artboards FlowMap, DoorIs, DoorEn, Lobby, LobbyEmpty, LobbyComposer, LobbySent, LobbyIncoming, LobbySearching, PhoneDoorIs, PhoneDoorEn, PhoneLobby, PhoneComposer.

Build:
- Pages where there is no field. The door and lobby are pages on the room's grid, with a masthead and the line slot.
- The door: the lockup, headline, lede, name field and one primary, in both languages.
- The lobby: your block, the form strip, who is here with your record against each, and the last match as a band map.
- The line slot under every masthead carries a call, your match, your challenge or your search, on every page, with a countdown, the cue and the tab title.
- The challenge composer opens its row in place and states the stakes before you send.
- Sent, outcomes, incoming, searching and empty states.
- The leave slip, which never resigns.
- Presence per tab (S5), payload-free pokes on a player channel (S6), and the lobby overview route (S10).

Out of scope: invite links and profiles (stage 6); phase 2 items; watching and following.
```

**What stage 4 left for the stages after it** (spec `specs/070-door-lobby/`, tasks and gate results in its `tasks.md`):

- **S14 moved forward.** The owner chose to build the lobby's record column in stage 4, so head-to-head (`head_to_head`, `lib/matchmaking/headToHead.ts`) exists; it is no longer a phase 2 item. Block, report and rename still are.
- **Pages have their own fixtures.** The door and the lobby render at `/dev/page?phase=…` (door, lobby, composer, the line slot's states), next to `/dev/room`. A new page state gets a page phase. Page screenshots freeze the clock at the fixtures' instant, and `?long=1` swaps every name for a 24-character one for `tests/integration/ui/slot-overflow.spec.ts`.
- **Take baselines from a production build.** The dev server draws its issue badge into full-page screenshots. Build with `NEXT_PUBLIC_DISABLE_REALTIME=false` (the quickstart's `.env.local` turns realtime off, so the dev server only polls) and run the two-player specs one at a time against it.
- **Stage 5.** The rematch id is no longer broadcast: both players get a `rematch` poke and read `rematchMatchId` from the old match's state route (`useRematchNegotiation.check`). A call that arrives on the result screen after the slip is lifted is the ledger's line through `ledgerCallLine(rematch, call)`, which already ranks a rematch first; stage 5 passes its request in. A match that ends while a player is away stays in their line slot (`unseen_result_match_id`) until they open it, and the slot's `result ▸` goes to the match page, which review will extend.
- **Stage 6.** The profile is already a page in the page frame, with the masthead and line slot; the invite door and the public profile's `challenge ▸` should reuse the door's form and the lobby's composer and its stakes. A link counts as the sender's outgoing challenge, so it goes through `send_challenge`'s gates (`lib/matchmaking/challengeService.ts` is the one caller; a grep test enforces it).

### Stage 5 · Result, rematch and review

```
/speckit.specify Stage 5 of the game flow redesign: the result, rematch and review.

Source of truth: docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md — D1 (result), D2 (rematch negotiation), D3 (review), F4 (phone result), F7 (phone review), §4 flow rows for the end of a match, §7.9 rows S8 and S9, and §8b's review rows for the rules document (S13). Owner decisions are in §10; do not re-ask them. The rematch action is `annan leik? ▸` / `rematch ▸`; the review action is `yfirfara viðureignina ▸` / `review the match ▸`. The timings are confirmed: a rematch is 30s within a 2:00 window.
Design canvas (read with the Artifact tool): https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo — artboards Result, RematchIncoming, Review, PhoneResult, PhoneReview.

Build:
- The result slip lands 600ms after the last reveal and focuses its headline. The detail line says once why the match ended.
- Rematch (S8): the 2:00 window, one request, accept through create_match_between from stage 1, and a cooldown after a decline or expiry. A request that arrives during review is the ledger's first line and never re-raises the slip.
- Review (S9) at ?review=n on the same field. It steps through every move in receipt order, with the scrubber in the scoreboard's clock row, labelled controls and keys. /summary redirects to ?review.
- The rules document amendments for review (§8b).

Out of scope: best-here hints (S17, phase 2). Once S17 ships, review waits for the hints (D3); that state is not built now.
```

### Stage 6 · Invite links and profiles

```
/speckit.specify Stage 6 of the game flow redesign: invite links and profiles.

Source of truth: docs/design_documentation/260922-game-flow/GAME_FLOW_SPEC.md — A2 (door for a friend's invite), B9 (invite link out), E1 (own profile), E2 (public profile), E3 (rules), F9 (phone profile), and §7.9 row S11. Owner decisions are in §10; do not re-ask them.
Design canvas (read with the Artifact tool): https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo — artboards DoorInvite, ProfileOwn, ProfilePublic.

Build:
- Invite links (S11): match_links with a hashed token, single use by compare-and-set, and the sender's language. The GET only renders, so link previews are harmless. The POST accepts through create_match_between. A link counts as the sender's outgoing challenge.
- The invite door.
- Your profile: rating in this language, a 30-day chart, the form strip, record and best words.
- Another player's profile: challenge ▸ is the one primary, with your stakes beneath. No last-seen time is ever shown.
- `how to play ▸` reaches /rules from every page.

Out of scope: head-to-head, block, report and rename (phase 2); identity recovery (Supabase Auth, next phase).
```
