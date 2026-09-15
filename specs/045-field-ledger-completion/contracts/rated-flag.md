# Contract: the `rated` flag

Decision 1 of 15 September 2026. **Supersedes spec 044's clarification** that all matches stay rated.

## Storage

```sql
alter table matches add column rated boolean not null default true;
```

Additive, no backfill. Every existing row is rated, which is what it was.

## Creation

`bootstrapMatchRecord(client, input)` — `lib/matchmaking/service.ts`, the single creation point.

```ts
interface MatchBootstrapInput {
  id?: string;
  boardSeed: string;
  playerAId: string;
  playerBId: string;
  roundLimit?: number;
  rematchOf?: string;
  rated?: boolean;      // NEW — omitted means rated
}
```

| Caller | `rated` passed | Result |
| --- | --- | --- |
| `startAutoQueue` | omitted | `true` |
| `respondToInvite` (accept) | `false` | `false` |
| `requestRematch` | source match's `rated` | inherited |
| `respondToRematch` | source match's `rated` | inherited |

## Read

`loadMatchState` selects `rated` and sets it on `MatchState`. A `MatchState` assembled without the column defaults to `true`.

## Rating

`app/actions/match/completeMatch.ts` — when `rated === false`, the Elo calculation and `persistRatingChanges` are both skipped. No `match_ratings` row is written; neither `players.elo_rating` changes.

## Copy

| Place | rated | unrated |
| --- | --- | --- |
| match caption | `ranked · round n of 10` | `unranked · round n of 10` |
| final caption | `final · 10 rounds · mm:ss` | `final · unranked · 10 rounds · mm:ss` |
| queue caption | `ranked · 10 rounds · 5:00 clocks` | n/a — the queue is always ranked |
| final rating line | `1191 → 1203 · +12 · wins` | omitted |
| lobby `here now` | — | `challenge for an unranked match` |

## Tests

- `tests/contract/post-invite.contract.test.ts` — an invite-created match has `rated: false`.
- queue path — a queue-created match has `rated: true`.
- rematch — a rematch of an unrated match is unrated; of a rated match, rated.
- `tests/unit/lib/rating/**` — no rating update and no `match_ratings` row when `rated === false`.
- `tests/unit/lib/room/ledgerRows.spec.ts` — captions by flag.
- `tests/unit/lib/constants/copy.spec.ts` — `HERE_NOW` contains `challenge for an unranked match`.

## If the team inverts the decision

Skip this contract entirely and record "challenges are ranked" in the design bundle (T033). Nothing else in the feature depends on it.
