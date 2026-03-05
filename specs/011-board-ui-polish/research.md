# Phase 0 Research: Board UI Polish

## 1. Animation Approach

**Unknown**: Should we install `framer-motion` as allowed by constitution, or use pure CSS keyframes with Tailwind for the shake/flash animations?

**Decision**: Use pure CSS keyframes mapped to Tailwind classes.

**Rationale**:
The `board.css` file already contains an `.invalid-shake` keyframe and `.board-grid__cell--invalid` class (from `005-board-ui-animations`). The CSS-based approach is fully GPU-accelerated and already integrates with the optimistic rollback flow in `BoardGrid.tsx`. Using existing CSS is the simplest, most performant approach and avoids adding a new dependency. The main work is triggering this class proactively for client-side rejections (like tapping a frozen tile) rather than relying exclusively on HTML `disabled` attributes or server-side rejections.

**Alternatives considered**:

- `framer-motion`: Overkill for a simple 400ms CSS shake. Adding a heavy dependency for one animation violates the spirit of a lightweight client approach, especially when CSS handles it perfectly at 60fps.

## 2. Board Zoom Implementation

**Unknown**: What is the optimal lightweight approach for pinch-to-zoom in React (native touch events vs a library) to maintain 60 FPS?

**Decision**: Use native React touch events (`onTouchStart`, `onTouchMove`) combined with a native CSS transform scale state.

**Rationale**:
Wottle targets mobile-first with a high performance bar. Using native `TouchEvent`s in a custom React hook (e.g., `usePinchZoom`) allows us to calculate the pinch distance and seamlessly apply it to a CSS `--board-scale` variable. This avoids the overhead of complex gesture libraries, giving us exactly what we need: a bounded 50% to 150% zoom on the grid, while letting the browser handle standard vertical scrolling via CSS `overflow-y: auto`.

**Alternatives considered**:

- `react-use-gesture`: Powerful, but adds bundle weight.
- `react-zoom-pan-pinch`: Full featured, but often intercepts default pan behavior, which could break the standard "vertically scrollable" requirement (FR-004) if not configured carefully.
