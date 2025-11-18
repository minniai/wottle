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

