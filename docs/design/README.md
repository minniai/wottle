# Wottle design — Field & Ledger

The binding design for every screen in Wottle is the **Field & Ledger** system. The bundle lives in
`docs/design_documentation/260914-wottle-new-design/`:

| Document | Role |
| --- | --- |
| [`WOTTLE_DESIGN_SYSTEM.md`](../design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md) | The design system: principles, seven colour tokens, two type families, layout, components, motion, copy, accessibility. Binding for all UI work. When it and the code disagree, the code is wrong. |
| [`WOTTLE_DESIGN_PLAN.md`](../design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_PLAN.md) | Implementation plan (steps P0–P5), contract changes, tests and acceptance, open decisions. |
| [`DOCS_CONSISTENCY.md`](../design_documentation/260914-wottle-new-design/DOCS_CONSISTENCY.md) | Documentation edits that keep the repo consistent with the design, plus the grep list of phrases the docs must no longer contain. |
| `260914-wottle-new-design-v2.pdf` | The UX audit with the figures (Fig. 2 desktop match, Fig. 5 phone, Fig. 6 lobby, Fig. 7 matchmaking, Fig. 8 post-game, Fig. 9 profile, Fig. 10 states). `v1` is the earlier draft. |

The Speckit feature that implements it is `specs/044-field-ledger-redesign/`.

## Decisions that override the bundle (2026-09-14)

The bundle is kept as authored. Read it with these team decisions substituted (spec 044, "Decisions"):

| Bundle says | Decision |
| --- | --- |
| 10:00 per-player clock (`10:00 clocks`, lane = 10:00, progress max 600) | **5:00** — the current budget stays; lane = 5:00, max 300, copy `5:00 clocks` |
| Second tap previews; `instantCommit` setting opts out | **Second tap commits** (as today); a `preview` setting (default off) opts in |
| Queue field shows the real match board | **Placeholder board**; letters that differ swap in at match start |
| Directory challenges start unranked matches | **All matches are rated** (no rating change in scope); copy `here now · challenge for a ranked match` |

## The one rule

Every visible element is one of: a letter (or a state of a letter) on the **field**; a fact about one
player in that player's **bar**; a fact about the match in the **ledger**. Anything else is removed,
not restyled.

## Previous designs

The Warm Editorial look (April–June 2026) is superseded. Its two Claude Design handoff bundles are kept
for reference under `docs/archive/260420-wottle-game-design/` and `docs/archive/260422-wottle-game-design/`;
the phased plan is `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` (marked superseded).
The local `ds-bundle/` folder is an untracked design-sync build of the Warm Editorial system and is not a
source for UI work. Do not implement from any of them.
