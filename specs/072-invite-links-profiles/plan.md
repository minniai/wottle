# Implementation Plan: Invite links and profiles

**Branch**: `072-invite-links-profiles` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/072-invite-links-profiles/spec.md`, with clarifications Q1–Q3. Research decisions R1–R16 are in [research.md](./research.md).

## Summary

A player can bring a friend in by link, and every player has a page.

- **Invite links (S11):**
  - `match_links` stores only `sha256(token)`, the sender, the sender's lobby language, and a 10-minute expiry.
  - The GET at `/c/:token` (`/en/c/:token`) only renders (`read_link` is `stable`). Signed out, it shows the invite door (A2). Signed in, it redirects to the lobby with the link's call in the line slot; the sender instead sees `this is your link · copy ▸`.
  - The accept Server Action (a POST) signs in if needed. It then calls `accept_link`, which locks the link and both players and uses the link by compare-and-set, through `create_match_between(…, 'link', …)`. The table's deadline becomes the link's expiry.
  - A link is the sender's one outgoing challenge. Every withdraw path cancels it: sending, searching, any accept, lobby switch, sign out.
  - The line slot gains a `link` state. The sender is poked, pushed to the table, and gets the cue, title and notification.
  - Clarification Q1: if the accepter leaves before the sender sits, the table voids `not_seated` against the sender, with no cooldown for the accepter.
- **Profiles (E1, E2, F9):**
  - One server read, `readProfile`, returns a `ProfileView` with no last-seen field: rating in this language, peak, week change, matches, first month played, record, last ten, the 30-day chart, three best words (a new `best_words` SQL function), and recent or shared matches.
  - The own profile's primary is `find an opponent ▸`.
  - The public profile is in the owner's seat colour. It shows a presence word (never a time) and has `challenge ▸` as the one primary, with the viewer's stakes. The lobby's composer opens in column B, and the lobby's live rows feed presence and challengeability.
- **Rules (E3):** the page frame, a primary chosen by state (`close this tab ▸` when opened from a match), the `10moves` and clock-line fixes, and `how to play ▸` on every page, including the phone `⋯`.
- **Review `copy link ▸`** (Q3) in the review `⋯`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router, `proxy.ts`); PL/pgSQL.
**Primary Dependencies**: Supabase JS v2 (RPC; Realtime pokes from spec 070), Zod, zustand, Tailwind 4, Node `crypto` (`randomBytes`, `createHash`). Browser: the Clipboard API (with a selectable-text fallback), Web Share where available, `localStorage` (the sender's link text, R2), `window.close()`. No new dependency.
**Storage**: Supabase PostgreSQL. One additive migration, `20260927001_invite_links_profiles.sql`:
- the table `match_links`;
- new functions `create_link`, `read_link`, `accept_link`, `cancel_link`, `expire_links`, `best_words` and `presence_word`;
- changed functions `send_challenge`, `create_match_between`, `void_table`, `sign_out_player`, `lobby_pending` and `confirm_lobby_switch`.

See [data-model.md](./data-model.md).
**Testing**:
- Vitest for every derivation in `contracts/page-derivations.md` (slot, invite door, table slip, profile header, record, week change, chart series, presence line, public primary, rules primary).
- The token module, and a link one-caller grep.
- The link-cancel-everywhere grep over the SQL.
- A `ProfileView` field allow-list.
- Contract tests:
  - the GET changes nothing (20 fetches, bot and prefetch UAs);
  - no `last_seen` in profile payloads;
  - `/api/standing` `link`.
- Integration tests against local Supabase (`tests/integration/db/`):
  - `link.test.ts`: create refusals, one pending per sender, the cancel paths, the expiry sweep, own-link, busy actor versus busy sender, the table deadline equal to expiry, and the Q1 void rewrite with no cooldown;
  - `link.race.test.ts`: 100 rounds of two concurrent accepts, exactly one match;
  - `best-words.test.ts`: distinct, void excluded, the tie rule.
- Playwright:
  - `invite-link-flow.spec.ts`, two browsers: signed-out accept, sender pushed, single use, expired, other locale;
  - `profile.spec.ts`: own, public, challenge from the profile, signed out, unknown handle;
  - `rules-links.spec.ts`: every page, and `close this tab`.
- The visual suite for the new page and room phases at 1280×800, 1440×900 and 390×844 (plus 390×664 and 360×640 for the phone profile), in both languages.
- The copy-parity, slot-overflow and name-safe tests extended.
- axe on every new page.
- `perf:link-accept`.

**Target Platform**: Web. Desktop 1280–1440 and phones from 360 wide. Vercel + Supabase.
**Project Type**: Web application (the Next.js single repo).
**Performance Goals**:
- `accept_link` under 200ms p95 locally (the same bar as `perf:seat`).
- `read_link` is one index probe, under 20ms.
- A profile page is one `readProfile` round (parallel queries), under 300ms p95 server time.
- The move path is untouched.

**Constraints**:
- Server-authoritative: single use, expiry, the one outgoing challenge, busy checks and the void rewrite are all in SQL under row locks.
- The GET never writes.
- Tokens are never stored, logged or poked.
- No last-seen time leaves the server.
- Seat colours only via `getSeatColors`; nine tokens; crimson only for points lost; nothing blinks.
- One primary per page; the 500ms guard on anything that appears under the pointer.
- Every slot string fits at 1440 and 390 in both languages.

**Scale/Scope**:
- 3 artboards (DoorInvite, ProfileOwn, ProfilePublic) plus the phone profile (F9) and E3.
- About 22 new page fixture phases and 2 room phases.
- 1 migration, 3 actions, 1 new page route; the profile pages and rules rewritten.
- About 10 new pure modules, and new components:
  - `InviteDoor`;
  - `ProfileOwnPage` and `ProfilePublicPage`;
  - `ProfileHeader`, `RecordRow`, `WordStrip`, `PresenceLine`;
  - `ProfileChart`, a rework of `ProfileRatingChart`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Server-authoritative | ✅ | Link creation, single use (CAS under row locks), expiry, busy checks, the one outgoing challenge, the link table deadline and the Q1 void rewrite are decided in SQL. The client only holds the token text for copying. Profile numbers are server reads. |
| II. Performance | ✅ | The move path is untouched. `accept_link` is benchmarked (`perf:link-accept`, <200ms p95). `read_link` is one unique-index probe. Profile queries run in parallel and are bounded (30 days, 10, 8, 3). |
| III. Type-safe | ✅ | Zod on every action input, the token format, the `?invite` and `?from` params, and `StandingFacts.link`. `LinkView`, `OutgoingLink`, `ProfileView` and the results are typed in `lib/types/`. Explicit return types. |
| IV. Mobile-first | ✅ | F9 phone profile with the pinned primary; the link states in the bottom slot at 64px and the link call at 104px; 44px targets; the phone `⋯` gains `how to play ▸`; the share sheet on phones. |
| V. Observability | ✅ | `link.created / cancelled / expired / accepted / accept_refused` logs with no token or hash, a perf mark on `accept_link`, and the sweep counts. |
| VI. Clean code | ✅ | Pure derivations in `lib/pages/` and `lib/profile/`. One service module per SQL family (`linkService`), enforced by a one-caller grep. The login steps are extracted into `lib/auth/signIn.ts` rather than duplicated. |
| VII. TDD | ✅ | Every task starts with a failing unit, contract, integration or Playwright test. Baselines change only with `--update-snapshots`. |
| VIII. Context7 | ✅ | Next.js 16 `robots` metadata, route headers and server-component redirects under `proxy.ts` are checked before implementation (research, last section). |

No violations, so Complexity Tracking is empty.

**Post-design re-check:** unchanged. The separate `match_links` table (R11) avoids widening `match_invitations`, and every withdraw path is covered by a grep test.

## Project Structure

### Documentation (this feature)

```text
specs/072-invite-links-profiles/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R16
├── data-model.md         # migration, functions, types
├── quickstart.md         # manual walk, fixtures, gates
├── contracts/
│   ├── routes-and-actions.md
│   └── page-derivations.md
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/20260927001_invite_links_profiles.sql       # new

app/
├── [locale]/(pages)/c/[token]/page.tsx                          # new: the invite door (GET renders only)
├── [locale]/(pages)/page.tsx                                    # ?invite → linkCall / ownLink; empty-lobby primary
├── [locale]/(pages)/(framed)/profile/page.tsx                   # readProfile → ProfileOwnPage
├── [locale]/(pages)/(framed)/profile/[handle]/page.tsx          # self redirect, 404, ProfilePublicPage
├── [locale]/(pages)/(framed)/rules/page.tsx                     # page frame, rulesPrimary, ?from
├── actions/link/{create,cancel,accept}.ts                       # new
├── actions/auth/{login,enterAsReturning}.ts                     # → lib/auth/signIn.ts
├── actions/player/{getPlayerProfile,getPlayerProfileByHandle,getBestWords}.ts   # retired
├── api/standing/route.ts                                        # link
└── api/cron/sweep-stale-matches/route.ts                        # expire_links + pokes

lib/
├── matchmaking/linkService.ts   linkToken.ts                     # new (the one caller of the link SQL)
├── matchmaking/challengeService.ts                              # withdrawOutgoing also cancels the link
├── auth/signIn.ts                                               # new (extracted)
├── profile/readProfile.ts  profileHeader.ts  record.ts  weekChange.ts  chartSeries.ts
│          bestWordStrips.ts  presenceLine.ts  publicPrimary.ts  readHandle.ts
├── pages/standingSlot.ts  slotLines.ts  pagePrimary.ts  composer.ts  inviteDoor.ts
├── room/tableSlip.ts                                            # THE TABLE WAITS
├── standing/readStanding.ts                                     # link fact
├── realtime/pokes.ts                                            # "link"
├── constants/links.ts                                           # LINK_TTL_MS
├── i18n/copy/{en,is}.ts  pages.{en,is}.ts                       # link, profile, rules, review strings
└── types/{link,profile,standing}.ts

components/
├── page/door/InviteDoor.tsx  InviteBand.tsx                     # new; DoorForm reused
├── page/lobby/Lobby.tsx  HereNowTable.tsx                       # invite a friend ▸
├── page/LineSlot.tsx  PageMenu.tsx  Masthead.tsx                 # link states; phone how to play; aria-current
├── standing/StandingProvider.tsx  useStandingMachine.ts          # linkCall, ownLink, link text (localStorage)
├── standing/hooks/useNotifications.ts                           # link opened
├── profile/ProfileOwnPage.tsx  ProfilePublicPage.tsx  ProfileHeader.tsx  RecordRow.tsx
│           WordStrip.tsx  PresenceLine.tsx  ProfileChart.tsx  ProfileMatches.tsx     # ProfilePage.tsx retired
└── room/RoomMenu.tsx                                            # review copy link; rules ?from

app/[locale]/dev/page/{fixtures.ts, PageFixture.tsx}             # new phases
app/[locale]/dev/room/fixtures.ts                                # table-link-waits, review-copy-link
components/rules/content/{en,is}.tsx                             # 10moves, clock line
docs/prd_and_requirements/wottle_game_rules.md                   # §12: invite link and profile rows
docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md   # word strip, profile, link slot
CLAUDE.md                                                        # spec 072 paragraph
scripts/perf/link-accept.ts  package.json                        # perf:link-accept

tests/
├── unit/lib/pages/{standingSlot.link,slotLines.link,inviteDoor,pagePrimary.rules}.spec.ts
├── unit/lib/profile/*.spec.ts   unit/lib/room/tableSlip.link.spec.ts
├── unit/matchmaking/{linkToken,link-one-caller,link-cancel-everywhere}.test.ts
├── unit/types/profile-view-allowlist.test.ts
├── contract/{link-get,profile-no-last-seen,standing-link}.contract.test.ts
├── integration/db/{link.test.ts, link.race.test.ts, best-words.test.ts}
└── integration/ui/{invite-link-flow,profile,rules-links,page-fixtures,slot-overflow}.spec.ts
```

**Structure Decision**: The existing single Next.js project. Link logic sits in `lib/matchmaking/` beside challenges (it is an outgoing challenge). Profile logic gets `lib/profile/`, as the constitution asks for by-feature folders. Page-level derivations stay in `lib/pages/`.

## Phasing (for tasks)

1. **Foundation:**
   - the migration and its integration tests (create, read, accept CAS, cancel, expire, one outgoing, the Q1 void, `best_words`, `presence_word`);
   - the types and the token module;
   - `linkService` with its one-caller grep;
   - `lib/auth/signIn.ts` extracted, with the door's tests still green.
2. **US1, link out:**
   - `createLinkAction` and `cancelLinkAction`;
   - the standing `link` fact, `SlotState.link` and slot lines;
   - clipboard, `localStorage` and the share fallback;
   - `invite a friend ▸` in the lobby (the empty-lobby primary);
   - the composer and find consequence lines;
   - expiry in the sweep; pokes.
3. **US2, the invite door:** the route (GET renders only, headers, locale redirect), `InviteDoor`, `inviteDoorModel`, `acceptLinkAction` (name and returning modes), and the contract test that the GET changes nothing.
4. **US3, signed-in open:** the `?invite` redirect, `linkCall` / `ownLink` in the provider, the call in the slot, accept from the slot, and the busy redirect.
5. **US4, the sender at the table:** the table deadline equal to expiry, `THE TABLE WAITS`, the link-opened notification, the race test, and `invite-link-flow` in Playwright.
6. **US5, own profile:** `readProfile`, the derivations, the components, the new-player state, and a call on the profile.
7. **US6, public profile:** presence word, `publicPrimary`, the composer in column B, sent and outcomes, your matches, and the no-last-seen contract.
8. **US7, signed-out profiles and handles.**
9. **US8, rules and `how to play ▸` everywhere,** plus the review `copy link ▸` (FR-063).
10. **Polish:**
    - fixtures and baselines (macOS here, Linux from CI);
    - axe, slot overflow and copy parity;
    - native-read markers;
    - `perf:link-accept`;
    - the rules doc §12, the design system, CLAUDE.md and `docs:check`.

## Complexity Tracking

None.
