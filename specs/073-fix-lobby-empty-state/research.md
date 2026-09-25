# Research: Fix Lobby Empty State

## Decision: Treat a missing last match as a true empty state

**Rationale**: `viewerOverview()` already returns `lastMatch: null` when no eligible completed match exists. The lobby converts that absence into a `RulesFigure` swap demonstration. It is deterministic instructional content, not historical data, but its letter grid visually reads as a played game.

**Alternative rejected**: Keep or scale the rules figure. It still violates the binding page-design rule and keeps the overflow risk.

## Decision: Remove the source of narrow-width overflow

**Rationale**: At 901–1167px, the sidebar is 260px wide while the rules figure renders a fixed 300px field. A text empty state removes that mismatch; the existing completed-match map already uses available sidebar width.

**Alternative rejected**: Clip or scale the field. This hides or shrinks misleading content instead of correcting it.

## Sources

- `components/page/lobby/Lobby.tsx`: `FirstMatch()` renders `RulesFigure` when `overview.lastMatch` is null.
- `components/rules/RulesFigure.tsx`: instructional field size is fixed at 300px.
- `app/styles/pages.css`: intermediate layouts set the sidebar to 260px.
- `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` §1: pages never draw a field.
