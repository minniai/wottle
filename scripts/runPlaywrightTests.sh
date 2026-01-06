if [ "$PLAYWRIGHT_SUITE" = "playtest" ]; then
  if grep -R --include='*.spec.ts' -q '@two-player-playtest' tests; then
    pnpm exec playwright test --config=playwright.config.ts --reporter=line --grep "@two-player-playtest"
  else
    echo "Skipping playtest suite: no '@two-player-playtest' tests found yet."
  fi
else
  pnpm exec playwright test --config=playwright.config.ts --reporter=line --grep-invert "@two-player-playtest"
fi