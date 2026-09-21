# Room fixture baselines

Playwright selects a baseline by phase, viewport and operating system. Updating
the `*-darwin.png` files locally does not update the `*-linux.png` files used by
GitHub Actions. Keep both sets current when the design or fixture phases change.

- macOS: run `pnpm test:visual --update-snapshots` and review the changes.
- Linux: use the `room-fixtures-screenshots` artifact from the CI **Visual (fixture
  route, no database)** job for the same UI revision. Review each failure against
  the design, then copy the original `test-results/**/<phase>-actual.png` to
  `<phase>-visual-<viewport>-linux.png`. The result directory names identify the
  viewport. Include new phases and the reduced-motion snapshot.
- Run the suite again without `--update-snapshots`. Do not increase the screenshot
  tolerance to accommodate intentional design changes, or rename macOS images
  to Linux: the production Linux renderer must supply the Linux pixels.

The September 21, 2026 Linux refresh uses CI run
[35633942178](https://github.com/minniai/wottle/actions/runs/35633942178)
(UI revision `79d14d5`): 38 outdated baselines were replaced and 27 missing
baselines added for the shipped move-based game and ledger clock. The 65 captures
were checked against independent run
[35633909918](https://github.com/minniai/wottle/actions/runs/35633909918):
64 PNGs were byte-identical, and the phone preview differed by only four pixels.
