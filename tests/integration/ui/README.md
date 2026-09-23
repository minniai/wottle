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
| Scoreboard (match, spec 068) | `scoreboard`, `scoreboard-clock` (`role=timer`, `data-phase` = starting · running · underMinute · lastSeconds · time · over), `scoreboard-clock-track`, `scoreboard-row-opp`, `scoreboard-row-you`, `scoreboard-name`, `scoreboard-subline`, `scoreboard-turn` (`data-tone`), `scoreboard-track` (`role=progressbar`, `aria-valuenow` = moves left, `data-mode` = moves · outlined; ten `.scoreboard__segment` with `data-state` = left · scoring · spent), `scoreboard-total` |
| Player bars (lobby, queue) | `player-bar-top`, `player-bar-bottom`, `player-bar-name`, `player-bar-lane` (`role=progressbar`, max = the move limit, `aria-valuenow` = moves left, `data-mode` = moves · searching · disconnected · empty; in a match ten `.player-bar__segment` with `data-state` = left · scoring · spent), `player-bar-score`, `player-bar-subline`, `player-bar-name-input` (+ `name-input-form`, `name-input-error`), `player-bar-action`, `player-bar-action-play`, `player-bar-action-find`, `player-bar-action-cancel` |
| Field | `field`, `field-cell` (`data-x`, `data-y`, `data-state` = free · picked · frozen · scored, `data-seat` = the owner's seat), `field-bands`, `field-band` (`data-seat`, `data-direction`, `data-move`, `data-word`, `data-cells` = the cells the band covers, `x,y;x,y`) |
| Ledger (match) | `ledger`, `ledger-caption`, `ledger-header`, `ledger-rows`, `ledger-row-<n>` (`data-status` = past · live · settled · future), `ledger-head` (desktop: `ledger-caption`, `ledger-state-line`, `ledger-header`), `ledger-context`, `ledger-caption-actions` (desktop final), `ledger-live-row`, `ledger-totals` (phone sheet, final), `ledger-territory`, `ledger-hint`, `ledger-notice`, `ledger-foot` (lobby; phone sheet), `ledger-phone-foot` (phone match), `ledger-how-to-play` (lobby, final), `ledger-result` (final, once the slip is lifted), `verdict` |
| Slip (over the field) | `slip` (`role=dialog`, `data-kind` = signIn · resign · endEarly · matchOver), `slip-how-to-play`, `slip-confirm-resign` / `slip-keep-playing`, `slip-end-early` / `slip-keep-waiting`, `slip-rematch` / `slip-new-opponent` / `slip-review-field` / `slip-lobby`, `slip-accept-rematch` / `slip-decline-rematch`, `slip-rematch-waiting`, `slip-score`, `slip-ratings` |
| Ledger notices | `notice-accept-challenge` / `notice-decline-challenge` (the resign confirmation, the claim and the rematch request moved to the slip with spec 048) |
| Ledger menu | `ledger-menu`, `ledger-menu-trigger`, `ledger-menu-list`, `ledger-menu-item-{sound,profile,signout,howToPlay,resign,leave}` (`howToPlay` is an `<a target=_blank>` to `/rules`, match only) |
| Ledger (lobby / queue / final) | `ledger-here-now`, `ledger-here-now-row`, `ledger-here-now-empty`, `ledger-challenge-<playerId>`, `ledger-last-matches`, `ledger-last-match-row`, `ledger-cancel-queue`, `ledger-lobby` (rematch and new opponent are on the match-over slip) |
| Rules page | `rules-page`, `rules-figure-{swap,words,crossing}`, `rules-scoring`, `rules-play`, `rules-back-top` / `rules-back-bottom` |
| Ledger sheet (< 900px) | `ledger-sheet`, `ledger-sheet-close` |
| Profile | `profile-page`, `profile-identity`, `profile-handle`, `profile-rating`, `profile-rating-chart`, `profile-rating-line`, `profile-record`, `profile-best-words`, `profile-best-word`, `profile-recent-matches`, `profile-recent-match`, `profile-foot`, `profile-back-lobby`, `profile-change-name`, `profile-sign-out`, `profile-not-found` |

Retired with their components (do not reintroduce): `hud-card`, `round-pip-bar`, `your-move-card`,
`scored-words-card`, `tiles-claimed-card`, `move-lock-banner`, `round-announce`, `match-ring`,
`post-game-scoreboard-card`, `rematch-banner`, `rematch-interstitial`, `series-badge`, `final-summary`,
`disconnection-modal`, `board-grid`, `tile-*`, and with spec 050 `player-bar-clock`, `round-rail`, with spec 068 `match-clock` (the clock is the scoreboard's), `slip-claim-win`, and since 2026-09-21 `move-rail` (`pinned` survives only in the `/rules` swap figure).

Conventions that follow from the design: the slip is the only thing positioned over the field, so a spec that needs
another dialog is wrong; frozen letters are `aria-disabled` cells — use `dispatchEvent("click")` if Playwright's
actionability check refuses them; sign in with `loginViaSlip(page, username)` from `helpers/matchmaking.ts` (it
waits for the in-place URL rewrite to `/lobby` — navigating earlier is a race); the same file has the
challenge/accept flow and `helpers/swaps.ts` the field ids. `moves-flow.spec.ts` and `disconnect-claim.spec.ts` are the
`@two-player-playtest` specs (ten moves each, Firefox project, `--workers=1`); `deadline-flow.spec.ts` runs only with a short
`PLAYTEST_MATCH_CLOCK_MS` set for both the server and Playwright; run two-player files one at a
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

