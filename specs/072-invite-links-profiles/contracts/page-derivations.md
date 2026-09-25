# Contract: pure derivations

Every function is pure, has an explicit return type, takes `copy` for strings, and gets a unit test in `tests/unit/lib/…` written first.

## Line slot (`lib/pages/standingSlot.ts`, `slotLines.ts`, `pagePrimary.ts`)

```ts
standingSlot(inputs: SlotInputs & { linkCall: LinkCall | null; ownLink: boolean }): SlotState
```

Precedence (FR-005, §5.0):

1. calls (challenge calls first, then a link call; `more` counts both);
2. match;
3. switch;
4. sent;
5. **link** (a pending link, or its held outcome; `ownLink` without a pending link shows `this is your link · copy ▸`);
6. search;
7. notice;
8. empty.

| State                             | Line 1                                                           | Line 2                                   | Actions                         | Drain     |
| --------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- | ------------------------------- | --------- |
| link pending, text stored         | `Link copied · valid 9:58` / `Tengill afritaður · gildir í 9:58` | —                                        | `copy again ▸`, `cancel link ▸` | 10:00     |
| link pending, no text stored here | `Link out · valid 9:58` / `Tengill úti · gildir í 9:58`          | —                                        | `new link ▸`, `cancel link ▸`   | 10:00     |
| clipboard refused                 | `Link ready · valid 9:58`                                        | the URL (selectable)                     | `cancel link ▸`                 | 10:00     |
| held `cancelled` / `expired` (4s) | `link cancelled` / `link expired`                                | —                                        | —                               | —         |
| link call                         | `Hekla invites you by link` / `Hekla býður þér með tengli`       | `1250 · English words · link valid 9:12` | `accept ▸` (primary), `dismiss` | to expiry |
| own link opened                   | `this is your link` / `þetta er tengillinn þinn`                 | `valid 9:12`                             | `copy ▸`                        | to expiry |

`pagePrimary(slot, copy, { composing, page })`: a link call's `accept ▸` is the page primary on every page. A pending link is a wait, so it has no primary.

`lobbyPrimary(rows, slot)`: when no one else is here, `invite a friend ▸` is the primary and `find an opponent ▸` a secondary. Otherwise `find an opponent ▸` is the primary and `invite a friend ▸` a secondary below the table, with `a link that works for 10 minutes`.

`composerModel` and `findConsequence`: line 3 gains `sending cancels your link` / `tengillinn þinn fellur úr gildi` when `facts.link?.status === "pending"`. The find action shows `finding cancels your link` in the same place as `finding withdraws your challenge`.

## Invite door (`lib/pages/inviteDoor.ts`)

```ts
inviteDoorModel(view: LinkView | null, state: "empty" | "returning", nowMs: number, copy: Copy): {
  band: { line1: string; line2: string | null; expired: boolean };
  primary: { label: string; action: "accept" | "enterLobby" };
  secondary: { label: string; action: "enterLobby" } | null;
  consequence: string | null;       // null when expired
}
```

- `line2` counts `m:ss` down to `expiresAt`. At 0 it switches to the expired band without a reload.
- Expired: `line1 = this link has expired`, `line2 = null`, primary `enter the lobby ▸`, no secondary, no consequence.

## Table slip (`lib/room/tableSlip.ts`, changed)

`readySlipModel` label: `origin === "link"` and the viewer seated and the other seat empty → `THE TABLE WAITS · m:ss` / `BORÐIÐ BÍÐUR · m:ss` (to `deadlineAt`). Otherwise unchanged.

## Profile (`lib/profile/`)

```ts
profileHeader(view: ProfileView, copy: Copy, now: Date): { subLeft: string; subRight: string }
// "@birna · playing since March 2026 · 35 matches" | new player: "1200 · RATING · ENGLISH · NO MATCHES YET"
// "RATING · ENGLISH · PEAK 1216 · +16 THIS WEEK" (the week clause dropped when 0; minus sign U+2212)

recordCells(record, copy): { value: string; label: string }[]   // "57%" | "—"
weekChange(ratings: {at: string; before: number; after: number}[], current: number, now: Date): number
chartSeries(ratings, current, now: Date, days = 30): { points: {x: number; y: number}[]; empty: boolean; ticks: number[] }
bestWordStrips(words: ProfileWord[], cell: 40 | 32): WordStripModel[]
presenceLine(p: PresenceWord, copy: Copy, lobbyLanguage: Language): string   // no time ever
publicPrimary(p: PresenceWord, row: LobbyRow | null, facts: StandingFacts | null, held, now, copy):
  | { kind: "challenge"; label: string; stakes: string }
  | { kind: "sent"; label: string }                // "sent · 0:41"
  | { kind: "closed"; reason: string | null }      // no primary; the cooldown wording or null
  | { kind: "enterLobby"; label: string }          // signed out
```

- The stakes come from `calculateElo` with the viewer's K and both ratings, formatted as in the composer (`english words · win +7 · draw −1 · loss −9`).
- Seat colours come from `getSeatColors(viewerSlot, slot)`: own profile `you`; public profile `opp` for the owner; signed out, the owner in `you`.

## Rules (`lib/pages/pagePrimary.ts`)

```ts
rulesPrimary(slot: SlotState, ctx: { signedIn: boolean; from: string | null }, copy): PagePrimaryModel
// call → accept ▸; from → close this tab ▸; signed in and empty → find an opponent ▸; signed out → enter the lobby ▸
```

## Copy (`lib/i18n/copy/{en,is}.ts`, `pages.{en,is}.ts`)

New keys: `link.*` (slot, door band, consequence, outcomes, call), `profile.*` (sub-lines, record labels, best words, presence words, your matches, empty lines, not found), `rules.closeTab`, `review.copyLink`, `review.linkCopied`. The copy-parity test covers them. Strings the source marks `(?)` are `// native-read` in `is.ts`. The slot-overflow test renders every new slot string in both languages at 1440 and 390.
