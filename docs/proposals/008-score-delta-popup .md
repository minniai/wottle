# Next Feature After 006-Match-Completion

**Purpose:** Recommend the next spec to implement after 006-match-completion so the game feels more polished and moves toward an “amazing playable word game” without large scope or long implementation time.

**References:** PRD (`docs/prd_and_requirements/wottle_prd.md`), 006-match-completion (`docs/proposals/006-match-completion.md`), 007-next-feature-after-board-ui (`docs/proposals/007-next-feature-after-board-ui.md`), CLAUDE.md (implementation status).

---

## 1. Current State (Post–006)

After 006-match-completion (and 007’s server-authoritative timer + frozen-tile tiebreaker):

- **Done:** 10-round limit, post-game victory screen (FinalSummary), return to lobby, winner (score + frozen-tile tiebreaker), server-authoritative clocks, time expiry and timeout-pass flow.
- **Core loop:** Swap → find words → score → freeze → round summary → next round → game end. The loop is complete and bounded.

So the next step is **polish and feel**: small, high-impact features that make each round more satisfying and the product clearly “game-like” without reopening big systems.

---

## 2. Recommended Next Spec: **007-Score-Delta-Popup** (or 008 if 007 is used for timer)

Implement the **Score Delta Popup** as defined in PRD §7.2 (Visual Feedback).

### Why this feature

- **PRD-defined:** Section 7.2 specifies:
  - “Score Delta Popup: Transient popup appears **near player's score** displaying move points breakdown.”
  - “Display Duration: 2–3 seconds before auto-dismissing.”
  - “Content Format: '+18 letters, +3 length, +2 combo' or similar breakdown.”
  - “Animation: Fade in over 200ms, hold for 2–2.8s, fade out over 200ms.”
- **Small scope:** One new component + wiring. Backend already provides per-round breakdown (letter total, length bonus, combo) in `RoundSummary` (deltas, comboBonus, word breakdowns). No new server work.
- **High impact:** Players see *why* their score went up (letters vs length vs combo) right next to their score. This makes scoring tangible and reinforces the core loop. Combo bonuses become visible and rewarding.
- **Moves toward “amazing playable”:** Clear, immediate feedback is what separates a prototype from a game that feels good to play.

### Scope of work

1. **Component: `ScoreDeltaPopup`** (or similar)
   - Props: `breakdown: { letters: number; length: number; combo: number } | null`, optional `total` for display.
   - Renders only when `breakdown` is non-null: text like “+18 letters, +3 length, +2 combo” (or “+24 pts” if you prefer a short form; PRD prefers breakdown).
   - Position: Adjacent to the player’s score in the HUD (TimerHud / player info area), non-intrusive (e.g. above or to the side).
   - Animation: Fade in 200ms → hold 2–2.8s → fade out 200ms; then clear so it doesn’t re-show on re-renders.
   - Accessibility: Optional `aria-live="polite"` so screen readers get the update without interrupting.

2. **Wiring**
   - When `MatchClient` receives a new `RoundSummary`, derive “your” breakdown from existing data: sum `wordScore.letterPoints` and `wordScore.bonusPoints` over your words (filter by player; exclude duplicates), and take combo from `summary.comboBonus`. No backend or type changes required.
   - Pass the breakdown into the HUD (e.g. `TimerHud`) and render `ScoreDeltaPopup` when the round summary updates for the current player.

3. **Edge cases**
   - No popup when delta is 0 (e.g. round with no new words for you).
   - Only show for the viewing player’s delta, not the opponent’s (popup is “your” feedback).

### Out of scope for this spec

- Changing round summary content or server scoring.
- Invalid-swap feedback (shake, red border) — good candidate for the *next* small spec.
- Rematch flow, board generation, or legacy cleanup.

---

## 3. Alternative / Quick Win: **Invalid Swap Feedback**

PRD §7.2 also specifies:

- “Invalid Swap Feedback: When swap is rejected (frozen tiles, invalid selection, etc.): Shake Animation (3–4 oscillations, 300–400ms), Red Border (brief 200ms), optional short error sound.”

Currently, rejection is communicated (e.g. via `MoveFeedback` toast), but the **tile shake and red border** are not implemented (E2E tests for this are skipped). Implementing this would be another small, PRD-aligned improvement that makes the game feel more responsive and polished.

**Suggestion:** Either bundle invalid-swap feedback into the same spec as the score delta popup (both are “visual feedback” in §7.2) or do **007-Score-Delta-Popup** first, then **008-Invalid-Swap-Feedback** as a short follow-up.

---

## 4. Summary

| Recommendation | Scope | Value |
|----------------|--------|--------|
| **007-Score-Delta-Popup** | One component + wiring to round summary; optional type tweaks for breakdown. | Makes scoring transparent and satisfying; fulfils PRD §7.2; small, low-risk. |
| **Invalid-swap feedback** (same or next spec) | Shake + red border on rejected swap; reuse existing rejection path. | Clear, tactile feedback on errors; completes PRD visual feedback. |

**Next feature after 006-match-completion:** Implement **Score Delta Popup** (and optionally Invalid Swap Feedback) so the next step is **bounded, PRD-grounded, and directly improves “playability”** on the path to an amazing word game.
