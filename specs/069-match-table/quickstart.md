# Quickstart: The table

## See it without a database

```bash
ROOM_FIXTURES=1 pnpm dev
```

Open these phases, in both languages (`/en/dev/room?phase=…` and `/dev/room?phase=…`):

| Phase | What it shows |
|---|---|
| `table` | The ready slip with `ready ▸`, the drain at 0:14, the opponent `on the way` |
| `table-seated` | `you are seated`, no primary, `leave` in row 2 |
| `starting` | The count in the scoreboard's clock row, the letters landed, the slip gone |
| `void` | `Kári did not sit down · nothing was rated`, from a challenge table: `challenge again ▸` and `lobby` |
| `void-queue` | `… you are back in the queue` with `cancel ▸`, the viewer's row `you · searching` |
| `searching-paused` | The queue screen `search paused · resume ▸` |

Phone views: `phone-table` at 390×844, 390×664 and 360×640.

## Try it with two players

```bash
pnpm quickstart && pnpm dev
```

1. Sign in as two players in two browsers and press `find an opponent ▸` in both.
2. Both land on the table at `/match/:id`, and both are seated, because each tab had input in the last 30s.
3. The count runs, and the letters land during `3`.
4. Repeat, but switch one browser to another tab before pairing.
   - Its search pauses; the other keeps searching alone.
   - Come back and press `resume ▸`.
5. Repeat, and after pairing wait 30s without touching one browser.
   - It sees `ready ▸`.
   - Let the 20s run out: both see the void.
   - The other player is `searching` again.
6. Press `leave` on two tables within 10 minutes. The lobby reads `find again in 4:5x`.

## The gates

```bash
pnpm test                                   # unit: derivations, slip models, stakes, queue view
pnpm test:integration -- tests/integration/db/table.race.test.ts   # needs local Supabase
pnpm exec playwright test tests/integration/ui/table.spec.ts
pnpm test:visual                             # the new phases, at 3 viewports
pnpm lint && pnpm typecheck && pnpm docs:check
```
