# Research: Board UI and Animations

**Feature**: 004-board-ui-animations
**Date**: 2026-02-23

## Research Areas

### 1. Animation Library vs. Pure CSS

**Decision**: Pure CSS animations (keyframes + transitions)

**Rationale**: All animations in scope are simple transform/opacity changes achievable with CSS:
- Swap: `translateX`/`translateY` between two tile positions (150-250ms)
- Shake: `translateX` oscillation keyframe (300-400ms)
- Highlight glow: `box-shadow` + `opacity` keyframe (600-800ms)
- Score delta popup: `opacity` transition (200ms in/out)

Adding Framer Motion (~32KB gzipped) would introduce unnecessary bundle size for these simple cases. CSS animations are GPU-accelerated by default via the browser's compositor thread.

**Alternatives considered**:
- **Framer Motion**: Full animation library with layout animations and gesture support. Overkill for this scope. Would be appropriate if we needed physics-based spring animations or complex layout transitions (e.g., reordering tiles).
- **Web Animations API (WAAPI)**: JavaScript-driven but browser-native. More control than CSS but adds complexity. Good candidate for swap animation since we need to calculate dynamic transform values at runtime. Could use as a targeted tool alongside CSS keyframes.
- **React Spring**: Similar to Framer Motion but physics-based. Same overkill concern.

**Note**: The swap animation requires dynamic transform calculation (tile A's position → tile B's position) which is harder with pure CSS classes. Implementation may use WAAPI or inline `style.transform` with transition for the swap specifically, while using CSS keyframes for shake and highlight.

### 2. Responsive Board Sizing Strategy

**Decision**: CSS `min()` function with `calc()` for viewport-based sizing

**Rationale**: The board must be the largest possible square that fits in the space between opponent bar and player bar. Using:
```css
--chrome-height: 120px; /* opponent bar + player bar + gaps */
--board-max: min(calc(100vh - var(--chrome-height)), calc(100vw - 2rem));
width: var(--board-max);
height: var(--board-max);
```
This ensures the board never overflows in either dimension and maintains square aspect ratio.

**Alternatives considered**:
- **Container queries**: `cqi`/`cqb` units relative to a container. Good for component isolation but browser support slightly less universal than `min()`/`calc()`. Adds complexity without benefit here.
- **JavaScript resize observer**: Calculate board size in JS on resize events. Works but introduces layout jank (JS runs after paint). CSS-only solution is smoother.
- **`vmin` units**: `width: 80vmin` scales relative to the smaller viewport dimension. Simple but doesn't account for the chrome height consuming vertical space. Board could still overflow vertically on short-but-wide viewports.

### 3. Swap Animation Implementation

**Decision**: Inline `style.transform` with CSS `transition` property

**Rationale**: Swap animation requires dynamic pixel offsets (tile A must translate by exactly the pixel distance to tile B's position and vice versa). This is best achieved by:
1. On swap trigger: measure tile positions via `getBoundingClientRect()`
2. Apply `transform: translate(dx, dy)` inline styles to both tiles
3. The existing `transition: transform 150ms ease` in board.css handles the animation
4. On `transitionend` event: remove transform, update grid state, unblock interactions

This avoids creating a CSS class for every possible swap direction/distance.

**Alternatives considered**:
- **CSS class with predefined transforms**: Would need classes for every possible offset combination (81+ for a 10x10 grid). Impractical.
- **FLIP technique (First, Last, Invert, Play)**: Calculate position difference, apply inverse transform, then animate to identity. More complex but handles layout-driven changes well. Overkill since we control the exact positions.
- **Absolute positioning during animation**: Temporarily take tiles out of flow, animate with absolute positioning, then re-insert. Risk of layout shift and complexity.

### 4. Round Resolution Animation Sequencing

**Decision**: React state machine with `useEffect` timeout chain

**Rationale**: The three visual phases (highlight → freeze → summary) need sequential execution with specific timing. A state enum (`"idle" | "highlighting" | "freezing" | "showing-summary"`) with `useEffect` watching for transitions provides clean, testable sequencing:

```
onRoundSummary received:
  → Set state to "highlighting", pass highlight data to BoardGrid
  → After 800ms timeout: set state to "freezing", apply frozen tiles
  → After 200ms (visual settle): set state to "showing-summary", show panel
```

**Alternatives considered**:
- **Promise chain**: `await highlight(800ms).then(() => freeze()).then(() => showSummary())`. Harder to integrate with React's render cycle. Requires `useRef` to track cancellation.
- **Custom event system**: Emit events between components. Over-engineered for a linear sequence.
- **Single timeout with CSS delays**: Apply all CSS at once with staggered `animation-delay`. Doesn't work because the freeze data and summary panel need React state updates, not just CSS timing.

### 5. Debug Metadata Toggle

**Decision**: `?debug=1` URL parameter, checked via `useSearchParams()`, stripped in production via build-time constant

**Rationale**: Simple, no keyboard shortcut conflicts, easily shareable debug URLs for testing. In production, the debug component tree is entirely excluded (not just hidden).

**Alternatives considered**:
- **Keyboard shortcut (e.g., Ctrl+Shift+D)**: Discoverability issue; no way to share debug state via URL.
- **Environment variable only**: Can't toggle at runtime during testing sessions.
- **localStorage flag**: Persists across sessions unexpectedly; harder to share.

### 6. Player Color Centralization

**Decision**: New `lib/constants/playerColors.ts` with hex, rgba, and Tailwind-compatible values

**Rationale**: Player colors are already used in `BoardGrid.tsx` FROZEN_COLORS and will be needed in `GameChrome.tsx` (score display), word highlights, and potentially the score delta popup. A single source of truth prevents drift and makes WCAG contrast verification straightforward.

The existing FROZEN_COLORS values already match the spec (Blue #3B82F6, Red #EF4444 at 40% opacity), confirming no visual change needed for frozen tiles — only extraction and reuse.

### 7. Skeleton Board Loading State

**Decision**: Reuse the same CSS grid with `aria-hidden` gray tiles, conditionally rendered when `matchState` is null/undefined

**Rationale**: The skeleton must match the real board's dimensions exactly to prevent layout shift (CLS). By reusing the same `.board-grid` CSS and rendering 100 inert `<div>` elements instead of `<button>` elements, the skeleton is visually identical in size and position.

**Alternatives considered**:
- **Tailwind `animate-pulse` skeleton**: Standard skeleton pattern. Could add a subtle pulse to the gray tiles for visual polish. Low risk.
- **Canvas-based placeholder**: Overkill for a simple gray grid.
- **SSR-rendered board**: Would require knowing the board state at SSR time, which isn't available until after match state loads.

### 8. WCAG Contrast Verification for Frozen Tiles

**Research**: Verified contrast ratios for white text on colored overlays at 40% opacity over the dark tile background (#1e293b).

| Color | Overlay at 40% | Blended with #1e293b | White text contrast |
|-------|----------------|---------------------|-------------------|
| Blue (#3B82F6) | rgba(59,130,246,0.4) | ~#2F5A8E | ~5.2:1 (passes AA) |
| Red (#EF4444) | rgba(239,68,68,0.4) | ~#814040 | ~4.8:1 (passes AA) |

Both colors meet the 4.5:1 WCAG AA threshold for normal text. The existing color choices are confirmed safe.
