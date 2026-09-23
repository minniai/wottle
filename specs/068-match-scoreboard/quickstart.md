# Quickstart: spec 068

```bash
pnpm dev                                   # with ROOM_FIXTURES=1 for /dev/room
open "http://localhost:3000/en/dev/room?phase=idle"
```

| Phase | Check |
|---|---|
| `idle` (1440×900) | One box above the field: the clock (`≈27s a move`, 3:12, 6 blocks + 3 ticks), Kári (6 of 10 · playing, 34), Birna (move 4 of 10, 44). No bars. Ledger rows level with board rows. |
| `low-clock`, `last-seconds` | Tinted clock row, ink ticks, heavy numeral, `last 12s`. Nothing blinks (watch 3s). |
| `missed`, `stakes` | `move 4 · no word` / `−5 · move 5 opens`; `3 moves left · −15 if unplayed`. Only the numbers are crimson. |
| `last-moved`, `pick-cleared` | Terracotta ticks on Kári's two cells; the line 2 notice for 2s. |
| `gone`, `offline`, `end-early` | `gone for 2:04`, outlined lanes; `offline · reconnecting`; the end-early slip with its headline focused. |
| `resign` | `Resign the match?`, with `keep playing ▸` focused. |
| `phone-match`, `-664`, `-360` | Scoreboard across the top, no tick marks, foot pinned, no scroll. |
| any | Tab title `3:12 · move 4 · Wottle`; the ledger wordmark reads `Wottle` (`/dev/room`: `Orðusta`). |

```bash
pnpm test:unit && pnpm lint && pnpm typecheck && pnpm docs:check
pnpm test:visual                                   # --update-snapshots to re-baseline (darwin)
pnpm exec playwright test tests/integration/ui/moves-flow.spec.ts --project=playtest-firefox --workers=1
```
