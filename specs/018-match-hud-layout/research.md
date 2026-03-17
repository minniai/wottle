# Research: Match HUD Three-Column Layout

**Feature**: 018-match-hud-layout
**Date**: 2026-03-16

## R1: Player Profile Data Availability

**Decision**: Fetch player profiles server-side at match page load, pass as separate prop to MatchClient.

**Rationale**: MatchState is broadcast via Supabase Realtime — adding player profiles would bloat every broadcast. Player identity is static for the match duration, so fetching once at page load is sufficient. The summary page already uses this exact pattern (`supabase.from("players").select(...).in("id", [playerAId, playerBId])`).

**Alternatives considered**:
- Embed in MatchState type: rejected (broadcast payload bloat, profiles don't change mid-match)
- Client-side fetch: rejected (server-authoritative principle, would require additional client action)

## R2: Responsive Layout Strategy

**Decision**: CSS-only responsive switching — render both desktop (full panels) and mobile (compact bars) layouts in the DOM, toggle visibility with `display: none` via media queries.

**Rationale**: Next.js SSR + React hydration requires consistent server/client HTML. JS-based viewport detection (`window.innerWidth`) causes hydration mismatches. CSS media queries are the established pattern in the codebase (see existing 900px breakpoint in board.css).

**Alternatives considered**:
- JS-based responsive rendering: rejected (hydration mismatch risk)
- Single component with CSS grid rearrangement: rejected (too complex for the full vs compact variant differences)

## R3: Timer Urgency Indicator

**Decision**: CSS pulse animation on background color when remaining time < 30 seconds. Red background with opacity oscillation (1.0 → 0.7 → 1.0) at 1s period. Respects `prefers-reduced-motion` with a static red border fallback.

**Rationale**: Pulse animation is lightweight (opacity only, GPU-composited), clearly communicates urgency, and follows the project's pattern of CSS-only animations. The 30-second threshold matches the spec's FR-006.

**Alternatives considered**:
- Color gradient transition: rejected (less noticeable at a glance)
- Font size change: rejected (causes layout shift)

## R4: RoundSummaryPanel Overlay Positioning

**Decision**: Wrap RoundSummaryPanel in an absolutely-positioned overlay div within the board container. Semi-transparent black backdrop (50% opacity). Board remains visible but dimmed.

**Rationale**: Absolute positioning within the board container keeps the overlay scoped and doesn't affect the three-column layout. The existing RoundSummaryPanel component needs no internal changes — only its container changes.

**Alternatives considered**:
- Fixed position full-screen modal: rejected (overly intrusive, covers player panels)
- CSS backdrop-filter blur: rejected (performance cost, not used elsewhere in the project)

## R5: GameChrome Deprecation Strategy

**Decision**: Keep GameChrome during development; remove only after PlayerPanel is fully integrated and all tests pass with the new component.

**Rationale**: Incremental replacement reduces risk. If PlayerPanel has issues, GameChrome is still available as fallback. Clean deletion in the final task.

**Alternatives considered**:
- Modify GameChrome in-place: rejected (scope too different, would complicate diffs and reviews)
- Keep both permanently: rejected (dead code violates Clean Code principle)

## R6: Panel Width on Desktop

**Decision**: 14rem (224px) per side panel, matching the approximate width needed for timer display and player info without crowding the board.

**Rationale**: The board needs to remain the dominant element. At 900px viewport: 14rem × 2 = 28rem (448px) leaves 452px for the board + gaps, which is sufficient for the 10×10 grid. At wider viewports, the board expands naturally via the existing container-query sizing.

**Alternatives considered**:
- 20rem panels (current summary width): rejected (too wide, squeezes the board at 900px breakpoint)
- 10rem panels: rejected (too narrow for timer display and controls)
