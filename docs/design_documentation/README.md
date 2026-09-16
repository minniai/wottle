# Wottle design — Field & Ledger

The binding design for every screen in Wottle is the **Field & Ledger** system. The bundle lives in
`260914-wottle-new-design/` beside this file:

| Document | Role |
| --- | --- |
| [`WOTTLE_DESIGN_SYSTEM.md`](260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md) | The design system: principles, eight colour tokens, two type families, layout, components, motion, copy, accessibility. Binding for all UI work. When it and the code disagree, the code is wrong. |
| [`WOTTLE_DESIGN_PLAN.md`](260914-wottle-new-design/WOTTLE_DESIGN_PLAN.md) | Implementation plan (steps P0–P5), contract changes, tests and acceptance, open decisions. |
| [`DOCS_CONSISTENCY.md`](260914-wottle-new-design/DOCS_CONSISTENCY.md) | Documentation edits that keep the repo consistent with the design, plus the grep list of phrases the docs must no longer contain. |
| `260914-wottle-new-design-v2.pdf` | The UX audit with the figures (Fig. 2 desktop match, Fig. 5 phone, Fig. 6 lobby, Fig. 7 matchmaking, Fig. 8 post-game, Fig. 9 profile, Fig. 10 states). `v1` is the earlier draft. |

The Speckit features that implement it: `specs/044-field-ledger-redesign/` (the rebuild, shipped 2026-09-14), `specs/045-field-ledger-completion/` (the 15 September review's twenty-five findings, shipped 2026-09-15) and `specs/047-room-as-rendered/` (the 16 September rendered review's nine findings and amendments P1–P4). The review handoffs live in `260915-design-scope-clarification/` and `260916-design-scope-clarification/`; the design system above carries every decision and amendment, so read it, not the handoffs' own copies.

## Decisions and amendments carried by the design system

The 260914 bundle was updated in place, so the tables below are a record, not a substitution list.

| Decided               | What                                                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-14 (spec 044) | 5:00 clocks, lane = 5:00; second tap commits, preview is opt-in; placeholder queue board; one chevron per run                                                                                                           |
| 2026-09-15 (spec 045) | directory challenges are **unranked** (`matches.rated`, copy `challenge for an unranked match`); `--opp-text` for coral text under 17px (eight tokens); numeral floor `max(9px, 18%)`, hidden below 32px cells          |
| 2026-09-16 (spec 047) | P1 the live row carries state and instruction, the hint collapses; P2 a fixture phase per signal (`/dev/room?phase=…`); P3 the ledger is the height of the stack, never stretched; P4 shared letters are ink throughout |

## The one rule

Every visible element is one of: a letter (or a state of a letter) on the **field**; a fact about one
player in that player's **bar**; a fact about the match in the **ledger**. Anything else is removed,
not restyled.

## Previous designs

The previous look (April–June 2026) is superseded. Its two Claude Design handoff bundles are kept
for reference under `docs/archive/260420-wottle-game-design/` and `docs/archive/260422-wottle-game-design/`;
the phased plan is `docs/archive/superpowers/specs/2026-04-19-wottle-design-implementation.md` (marked superseded).
The local `ds-bundle/` folder is an untracked design-sync build of that previous system and is not a
source for UI work. Do not implement from any of them.
