# Contract: the fixture route

`/dev/room` — a development and test surface. Not a player-facing feature; nothing links to it.

## Request

```
GET /dev/room?phase=<phase>
```

`phase` ∈ `landing | lobby | queue | found | match | reveal | final | disconnect | profile`.
Missing or unrecognised → `match`.

## Guard

```
process.env.NODE_ENV === "production" && !process.env.ROOM_FIXTURES  →  notFound()
```

The CI visual job sets `ROOM_FIXTURES=1` against a production build; the deployed application does not.

## Response

The room for that phase, rendered from `app/dev/room/fixtures.ts`:

- a server component reads `phase` and applies the guard;
- a client component seeds `useRoomStore` and `usePreferencesStore` from the fixture, then renders `RoomShell` → `Room` with `PlayerBar`, `Field`, and `Ledger` / `LobbyLedger` / `ProfilePage` — the same presentational components the live room uses, through `LobbyRoomView`, `QueueRoomView` and `MatchRoomView`.

`reveal` mounts `useReveal` once over the round-3 words so the band draw, chevron and count-up are captured mid-flight.

## Isolation — enforced, not intended

Nothing under `app/dev/room/` may import from:

- `lib/supabase/**`
- `app/actions/**`
- `components/room/*Controller.tsx`

Asserted by `tests/unit/app/roomFixtures.imports.test.ts`, which walks the folder and fails on a matching import. A controller import would drag in transport and timers and make the route non-deterministic — the reference images would drift.

## Determinism

Every clock, count, rating and timestamp in the fixtures is a literal. No `Date.now()`, no `Math.random()`, no locale-dependent formatting.

## Visual suite

`tests/integration/ui/room-fixtures.spec.ts`, run by three Playwright projects:

| Project | Viewport |
| --- | --- |
| `visual-1440x900` | 1440 × 900 |
| `visual-1280x800` | 1280 × 800 |
| `visual-390x844` | 390 × 844 |

Per phase: navigate, wait for the field's hundred cells, then

```ts
await expect(page).toHaveScreenshot(`${phase}.png`);
```

with `maxDiffPixelRatio: 0.002` and `animations: "disabled"` set once in `TestConfig.expect`. Playwright resolves the baseline path from the project name, so the three viewports never collide, and it awaits `document.fonts.ready` and two consecutive identical frames on its own.

`pnpm test:visual` runs the three projects. `pnpm test:visual --update-snapshots` is the only way to change a baseline.

## Lifecycle

- **R1** — route, fixtures and spec land. Baselines are **not** committed; they would enshrine defects A1–A4. The CI job is `continue-on-error: true` and uploads the images as artifacts.
- **R2–R6** — each PR runs the suite locally with `--update-snapshots` and attaches the images.
- **R7** — a person compares each image with its figure, the 27 baselines are committed, and `continue-on-error` is removed.
