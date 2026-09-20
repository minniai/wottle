# Playwright UI Tests

## Prerequisites

These tests require a local Supabase instance to be running.

## Running the Tests

### 1. Start Supabase

Before running the tests, ensure Supabase is running:

```bash
export QUICKSTART_SKIP_TOKEN_CHECK=1
export QUICKSTART_DISABLE_STOP=1
pnpm quickstart
```

###  2. Run the Tests

```bash
# Run all UI tests
pnpm exec playwright test tests/integration/ui

# Run a specific test file
pnpm exec playwright test tests/integration/ui/lobby-presence.spec.ts

# Run tests in headed mode (see the browser)
pnpm exec playwright test tests/integration/ui --headed
```

## Test ids (spec 044, Field & Ledger)

Every player-facing screen is one room, so every spec locates elements through the same ids
(source of truth: `specs/044-field-ledger-redesign/contracts/room-components.md`; the live list is
whatever `components/room/**` and `components/profile/**` render).

| Surface | Ids |
| --- | --- |
| Room | `room` (`data-phase` = lobby · queue · found · match · final, `data-match-id`), `room-shell`, `room-slot-top` / `room-slot-field` / `room-slot-bottom` / `room-slot-ledger` |
| Player bars | `player-bar-top`, `player-bar-bottom`, `player-bar-name`, `player-bar-clock` (`data-running`), `player-bar-lane` (`role=progressbar`, max 300, `data-mode` = running · stopped · searching · disconnected), `player-bar-score`, `player-bar-subline`, `player-bar-name-input` (+ `name-input-form`, `name-input-error`), `player-bar-action`, `player-bar-action-play`, `player-bar-action-ranked`, `player-bar-action-cancel` |
| Field | `field`, `field-cell` (`data-x`, `data-y`, `data-state` = idle · picked · preview · pinned · frozen, `data-seat`), `field-bands`, `field-band` (`data-seat`, `data-direction`, `data-round`, `data-word`) |
| Ledger (match) | `ledger`, `ledger-caption`, `ledger-header`, `ledger-rows`, `ledger-row-<n>`, `round-indicator`, `ledger-live-row`, `ledger-territory`, `ledger-hint`, `ledger-notice`, `ledger-foot`, `ledger-rules`, `verdict` |
| Ledger notices | `notice-confirm-resign` / `notice-cancel-resign`, `notice-accept-rematch` / `notice-decline-rematch`, `notice-accept-challenge` / `notice-decline-challenge`, `notice-claim-win` |
| Ledger menu | `ledger-menu`, `ledger-menu-trigger`, `ledger-menu-list`, `ledger-menu-item-{sound,preview,profile,signout,resign,leave}` |
| Ledger (lobby / queue / final) | `ledger-here-now`, `ledger-here-now-row`, `ledger-here-now-empty`, `ledger-challenge-<playerId>`, `ledger-last-matches`, `ledger-last-match-row`, `ledger-cancel-queue`, `ledger-rematch`, `ledger-new-opponent`, `ledger-lobby` |
| Ledger sheet (< 900px) | `ledger-sheet`, `ledger-sheet-close` |
| Profile | `profile-page`, `profile-identity`, `profile-handle`, `profile-rating`, `profile-rating-chart`, `profile-rating-line`, `profile-record`, `profile-best-words`, `profile-best-word`, `profile-recent-matches`, `profile-recent-match`, `profile-foot`, `profile-back-lobby`, `profile-change-name`, `profile-sign-out`, `profile-not-found` |

Retired with their components (do not reintroduce): `hud-card`, `round-pip-bar`, `your-move-card`,
`scored-words-card`, `tiles-claimed-card`, `move-lock-banner`, `round-announce`, `match-ring`,
`post-game-scoreboard-card`, `rematch-banner`, `rematch-interstitial`, `series-badge`, `final-summary`,
`disconnection-modal`, `board-grid`, `tile-*`.

Conventions that follow from the design: nothing is positioned over the field, so a spec that needs a
dialog is wrong; frozen letters are `aria-disabled` cells — use `dispatchEvent("click")` if Playwright's
actionability check refuses them; sign in with `loginViaSlip(page, username)` from `helpers/matchmaking.ts` (it
waits for the in-place URL rewrite to `/lobby` — navigating earlier is a race); the same file has the
challenge/accept flow and `helpers/swaps.ts` the field ids. `rounds-flow.spec.ts` is the one
`@two-player-playtest` spec (ten rounds, Firefox project, `--workers=1`); run two-player files one at a
time locally. Bars show the capitalised display name, so compare names with `ignoreCase: true`.

## Troubleshooting

### "Failed to load board from Supabase"

This means Supabase isn't running. Start it with the command above.

### "Connection refused" or "fetch failed"

1. Check that Supabase is running: `supabase status`
2. If not running, start it: `pnpm quickstart`
3. Verify `.env.local` exists and contains Supabase credentials

### Tests are slow or timing out

The tests use `reuseExistingServer: true` in the Playwright config, which means:
- The Next.js dev server should already be running
- If not, Playwright will start it automatically
- First run may be slower as it starts the server

## Known Issues

Some tests may have race conditions or require longer timeouts depending on system performance.

