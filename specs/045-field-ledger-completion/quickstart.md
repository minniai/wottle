# Quickstart — Field & Ledger completion

## See the room in thirty seconds (from R1 onward)

No `.env.local`, no Docker, no Supabase, no second player:

```bash
pnpm install
pnpm dev
open "http://localhost:3000/dev/room?phase=match"
```

Swap `phase` for any of `landing lobby queue found match reveal final disconnect profile`.

This is the point of the feature. If this does not work, nothing below is verifiable — which is exactly the state spec 044 shipped in.

## Check your work against the design

```bash
pnpm test:visual                      # compare against the committed baselines
pnpm test:visual --update-snapshots   # accept the current rendering as the baseline
```

`--update-snapshots` is the only way a baseline changes. Attach the resulting images to the PR.

Three viewports run as three Playwright projects, so a failure names the one that broke:

| Project | Viewport | Figure |
| --- | --- | --- |
| `visual-1440x900` | 1440 × 900 | Fig. 2, 6, 7, 8, 9 |
| `visual-1280x800` | 1280 × 800 | Fig. 2 at the narrow gutter |
| `visual-390x844` | 390 × 844 | Fig. 5 |

Baselines are committed for **two platforms**, because Playwright suffixes a
snapshot with the platform and CI runs Linux while most development here is
macOS.

**The Linux set must come from a production build**, and the safest source is CI
itself: download the `room-fixtures-screenshots` artifact from a visual-job run
and copy its `*-actual.png` files over the matching `*-linux.png` baselines.
Generating them locally against `pnpm dev` produces images that differ from CI
by about 4% of pixels — the dev server and `pnpm start` do not lay the room out
identically, and on Linux the reserved scrollbar gutter shifts the centred pair.
That mistake cost a red CI run on this feature.

Whatever the source, **look at the image before adopting it**. A baseline is
only as good as the render it captures; adopting a broken one silently makes the
defect the standard.

## The full gate, per PR

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check
```

Plus, from R2 on, the three screenshots of every phase the PR touched.

## Working test-first

The constitution makes TDD non-negotiable, and this feature is unusually easy to work that way because most of it is CSS:

**Static stylesheet assertions** — `tests/unit/styles/room-css.test.ts` reads `app/styles/room.css` and matches rule blocks. This is how the paint fixes go red before they go green, with no browser:

```bash
pnpm test:unit -- tests/unit/styles/room-css.test.ts
```

**Rendered assertions** — Playwright against `/dev/room`, for anything that needs a real layout (the gutter measurement, the phone scroll height, computed font sizes).

**Component and reducer assertions** — Vitest + JSDOM as today.

Commit each passing test on its own: `test(room): …` before `fix(room): …`.

## The one trap to know before you touch the field

`components/room/Field.tsx` wraps each row in `<div role="row" class="field__row">` with `display: contents`. The grid is flat, **the DOM is not**. So in `room.css`:

```css
/* right: works — each row has exactly ten button children */
.field__cell:nth-of-type(10n) { border-right: 0; }

/* bottom: WRONG — matches all ten cells of every row, killing every horizontal rule */
.field__cell:nth-last-of-type(-n + 10) { border-bottom: 0; }

/* bottom: correct */
.field__row:last-child .field__cell { border-bottom: 0; }
```

The handoff bundle prescribes the wrong form. `research.md` §1 has the reasoning. Do not delete the row wrappers to make it work — they are the `grid → row → gridcell` tree axe requires.

## Verifying the two decisions that change behaviour

**Unranked challenges** — accept a directory challenge, play it out, confirm neither rating moved and the caption reads `unranked`. A queue match must still move ratings.

```bash
pnpm test:unit -- tests/unit/lib/rating
pnpm test:integration -- tests/contract/post-invite.contract.test.ts
```

**Eight tokens** — the palette gains `--opp-text #C2402A` for coral text below 17px only:

```bash
pnpm test:unit -- tests/unit/styles/tokens.test.ts tests/unit/styles/acceptance-grep.test.ts
```

## The real run, once, at R7

```bash
pnpm quickstart              # Supabase preflight, Docker, migrations, seed, .env.local
pnpm exec playwright test    # the two-player suite
```

Run the two-player spec files one at a time locally; Realtime contention makes the parallel suite flaky (see `tests/integration/ui/README.md`). Record the date and the per-spec result in `tasks.md`, and replace spec 044's "Not run locally: no Supabase" notes with it.

## Where the authority lives

| Question | Answer |
| --- | --- |
| What should it look like? | `Wottle UX Audit.dc.html` Fig. 2, 5–10, and `WOTTLE_DESIGN_SYSTEM.md` |
| What should the field look like exactly? | `Wottle Implementation Review.dc.html` §02, fixture **B** |
| Why is this being changed? | `IMPLEMENTATION_REVIEW.md`, findings A1–E2 |
| What is already correct and must not change? | `IMPLEMENTATION_REVIEW.md` §3 |
| What did the team decide? | `spec.md` → Clarifications (three of 15 Sept, five of 14 Sept) |
| What does the code do today? | the repo. Where it disagrees with the design, **the code is wrong**. |
