# Next Feature Recommendation: 004 Match Layout & Playable View

**Context:** After completing **003-word-engine-scoring** (word-finder, scoring, frozen tiles), the game will be functionally playable but the match screen will still look like a backend test harness. This document recommends the next spec: **Match Layout & Playable View** — a focused UI/UX pass so the game feels like a real, playable word duel.

**References:** PRD §7 (UI/UX), `docs/wottle_prd.md`, `docs/project-analysis-2026-02-14.md`, current `MatchClient` / `MatchShell` / `TimerHud` / `BoardGrid`.

---

## 1. Why This Next (and Why Not Bigger)

- **003** delivers the core loop: swap → words → score → freeze. After 003, the main missing piece for “playable” is **presentation**: layout, viewport fit, and clear game chrome.
- The PRD already defines the target layout (desktop and mobile). Implementing it is mostly **layout and component arrangement**, with minimal new backend — so it’s **bounded in scope** and **short to implement**.
- Doing this right after 003 makes every subsequent feature (timer polish, animations, mobile gestures) build on a screen that already **fits the viewport** and **matches the PRD game screen**.

---

## 2. Current vs PRD

| PRD §7 (Target) | Current implementation |
|-----------------|------------------------|
| **Desktop:** Opponent [timer] \| Score → 10×10 grid → You [timer] \| Score \| M7 | Single column; no opponent/player bars; no score in HUD; no move counter |
| **Mobile:** Stacked opponent row, scrollable grid, stacked player row, 44×44px targets | Board has some responsive CSS but no PRD-style stacked layout; touch targets not verified |
| **Board:** Fits viewport, readable tiles | Board is `width: 95%` in a flex column; can overflow or feel tiny depending on viewport |
| **Chrome:** Only game-critical info (timers, scores, M{n}) | Match ID, “Round limit”, “Status”, “Board Loading” placeholders — test/debug clutter |
| **Timer state:** Green when active, neutral when submitted | Single style; no color change by state |

**Result:** The match screen doesn’t follow the PRD layout; UI can not fit the screen; it reads as “testing backend” rather than “playing a game.”

---

## 3. Suggested Spec: **004-match-layout-playable-view**

**Goal:** Implement the PRD §7 match layout so the game screen is recognizable, fits the viewport, and prioritizes the board and game chrome (opponent/you, timers, scores, move counter). No new game logic; optional small timer visual state.

### 3.1 Scope (Must Have)

1. **PRD layout structure**
   - **Opponent bar:** Timer + score (and optionally “Opponent” label).
   - **Central area:** 10×10 grid as the main content.
   - **Player bar:** Timer + score + move counter **M{n}** (n = completed moves for current player, e.g. M0–M10).
   - Desktop: single column, bars above/below grid. Mobile: same order, stacked; bars can wrap (e.g. timer and score on two lines) per PRD.

2. **Viewport-fitting board**
   - Board and chrome live in a **constrained game area** (e.g. full viewport or main content area).
   - Grid **scales to fit** available space (e.g. `max-height` + aspect-ratio or `min()` of width/height) so the board never overflows and remains readable.
   - No horizontal scroll on desktop; optional vertical scroll on very small viewports if needed.

3. **Reduced test clutter**
   - Remove or hide from default play view: Match ID, “Round limit”, “Status”, “Board Loading” / “Players” placeholders.
   - Keep: reconnect/polling banners, swap errors, round summary. Optional: “Match ID” in a collapsible debug section or only in dev.

4. **Move counter**
   - Display **M{n}** for the current player. Use `currentRound` and submission state as a first pass (e.g. M(currentRound - 1) when waiting for opponent after you submitted, M(currentRound) after resolve), or add a small field to match state if needed.

5. **Scores in chrome**
   - Opponent bar: opponent’s score (from `matchState.scores` + slot). Player bar: your score. Update from `matchState.scores` and `lastSummary.totals` when present.

### 3.2 Scope (Nice to Have in Same Spec)

6. **Timer state color (PRD §7.2)**
   - Timer **green** when current player has not yet submitted this round; **neutral** when submitted (clock paused). Only affects styling of the timer in the player bar.

7. **Responsive and a11y**
   - Mobile: touch targets for tiles and buttons ≥ 44×44px (already partially in board CSS; verify and fix).
   - Ensure bars and grid remain usable in portrait and landscape.

### 3.3 Out of Scope (Later Specs)

- Pinch-to-zoom, swipe between views (PRD mobile).
- Score delta popup (“+18 letters, +3 length, +2 combo”) — can stay in round summary only for now.
- Server-authoritative timer (separate P1 item).
- Full mobile UX (haptics, long-press hints).

---

## 4. Why This Size Is Right

- **Not too big:** No new APIs, no new game rules. One new “game screen” layout component (or refactor of `MatchShell` + `MatchClient`), updates to `TimerHud` (or a new `GameChrome`), and CSS/layout. Estimate: **~8–15 tasks** in a spec.
- **High impact:** Players see a real game layout, board fits the screen, scores and move count visible at a glance. Directly addresses “UI doesn’t fit” and “just for testing.”
- **Clear end state:** PRD diagrams and §7.1/7.2 give a clear definition of done; easy to add a short checklist (e.g. “Desktop layout matches PRD diagram”, “Board fits viewport”, “M{n} visible”, “Scores in bars”).

---

## 5. Suggested Checklist Snippets for 004

- [ ] **Layout:** Desktop match view shows Opponent bar (timer + score) → Grid → Player bar (timer + score + M{n}) per PRD §7.1.
- [ ] **Layout:** Mobile match view uses stacked bars and grid; board is scrollable or fits without horizontal overflow.
- [ ] **Viewport:** Board scales to fit available height/width; no desktop overflow; tiles remain readable.
- [ ] **Chrome:** Opponent and player scores and move counter M{n} reflect current match state.
- [ ] **Clutter:** Match ID / Status / placeholders removed or hidden from default play view.
- [ ] **Timer:** (Optional) Timer color reflects “active” (green) vs “submitted” (neutral) per PRD §7.2.
- [ ] **A11y:** Interactive elements (tiles, buttons) meet 44×44px minimum touch target on mobile.

---

## 6. Implementation Hints

- **Layout:** Use a single “game view” wrapper (e.g. `MatchGameView`) with three regions: `GameHeader` (opponent), `BoardArea` (flex-1, min-h-0, grid centered and constrained), `GameFooter` (you). Use flexbox so the middle takes remaining space and the board uses `max-h-full` + aspect-ratio or similar to fit.
- **Board fit:** Constrain the grid wrapper to the remaining space; use `aspect-ratio: 1` and `max-width`/`max-height: 100%` (or CSS `min(…, …)`) so the 10×10 grid scales down on small viewports.
- **Data:** `matchState.scores`, `matchState.currentRound`, `matchState.timers`, and `playerSlot` already exist; use them for opponent/your score, timers, and a derived M{n} (or one extra field if you want “moves completed” stored).
- **MatchShell:** Either simplify to a thin wrapper with no metadata blocks, or split: “play” mode (only chrome + board + alerts) vs “debug” mode (optional Match ID, etc.).

---

## 7. Summary

**Recommendation:** Add **004-match-layout-playable-view** as the next feature after 003-word-engine-scoring. It implements the PRD §7 match layout, viewport-fitting board, scores and move counter in chrome, and de-clutters the screen. Scope is UI/layout only (plus optional timer color), so it’s short to implement and moves the product toward an “amazing playable word game” without expanding backend or game rules.
