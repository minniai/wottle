# Quickstart — Scored-letter integrity and ownership

## See the defect, then the fix, on the affected match

Read-only, against production (the CLI is linked; `supabase db query --linked`):

```bash
# the diagnostic from research.md §4, for the 20 September match
pnpm exec supabase db query --linked "$(sed -n '/^```sql/,/^```/p' specs/049-scored-letter-integrity/research.md | sed '1d;$d' | sed "s/:match/'ed22c625-a2fe-4c3f-83a4-3096eafe8bf6'/")"
```

Every `at_round` and `at_end` equals its `word`: the records are clean. Then open that match as either player after deploying; the field is round 10's board and every band spells.

## Locally, without a database

```bash
pnpm dev
open "http://localhost:3000/dev/room?phase=reveal"   # LEK over GILT: the L is coral, LEK's band covers E and K
open "http://localhost:3000/dev/room?phase=final"
```

## Check

```bash
pnpm test:unit -- tests/unit/lib/match tests/unit/lib/room tests/unit/components/room
pnpm test:visual                      # baselines for reveal, settle, final, over-slip change; --update-snapshots after the unit tests pass
pnpm exec playwright test match-completion --project=chromium --workers=1
pnpm lint && pnpm typecheck && pnpm docs:check
```

## Replay the stale write (unit)

`tests/unit/lib/match/roundEngine.staleWrite.spec.ts` builds the 20 September row (`state: completed`, `current_round: 6` after ten rounds) and replays a round-5 step-14 write: zero rows, one `match.write.stale` warn, the row unchanged.
