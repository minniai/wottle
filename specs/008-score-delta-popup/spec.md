# Feature Specification: Visual Feedback Polish — Score Delta Popup & Invalid Swap Feedback

**Feature Branch**: `008-score-delta-popup`
**Created**: 2026-02-26
**Status**: Implemented
**Input**: User description: "Do a specification for the next feature based on @docs/proposals/008-score-delta-popup .md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See My Score Breakdown After Each Round (Priority: P1)

After a round resolves, a player wants to instantly understand *why* their score increased — how many points came from letter values, word length, and combo bonuses — without navigating away from the board.

A transient popup appears next to the player's score in the HUD showing the breakdown (e.g. "+18 letters, +3 length, +2 combo") for 2–3 seconds, then fades out automatically.

**Why this priority**: This is the core deliverable. It makes scoring transparent and tangible, directly reinforcing the gameplay loop. Players who understand *how* scoring works are more motivated to form longer words and combos.

**Independent Test**: Can be tested by completing a round that scores words and verifying the popup appears, shows the correct breakdown values, animates in and out, and disappears without user interaction.

**Acceptance Scenarios**:

1. **Given** a round resolves and the current player's words earn points, **When** the round summary is received, **Then** a popup appears near the player's score showing the letters, length bonus, and combo components of the delta, and disappears after 2–3 seconds.
2. **Given** a round resolves and the current player earned no points (no new words), **When** the round summary is received, **Then** no popup is shown.
3. **Given** the popup is visible, **When** a screen reader is active, **Then** the score breakdown is announced without interrupting the current reading context.
4. **Given** two consecutive rounds both produce non-zero deltas, **When** each round resolves, **Then** each round triggers its own popup display cycle (the second popup starts fresh and does not overlap with a lingering first popup).

---

### User Story 2 — Understand Why a Swap Was Rejected (Priority: P2)

A player attempts a swap that is rejected (e.g. selecting a frozen tile, or making a selection outside the valid move rules). The board should communicate the rejection clearly and immediately through the tile's visual behaviour, so the player understands the action was not accepted and can try again.

**Why this priority**: Rejection feedback closes the action loop. Without it, players wonder whether the click registered at all. PRD §7.2 defines this as required visual behaviour. It complements P1 by completing the round-start feedback side (failed move) alongside the round-end feedback (score delta).

**Independent Test**: Can be tested by submitting an invalid swap and verifying the selected tiles perform a shake animation with a red border, then return to their resting state, with no board state change.

**Acceptance Scenarios**:

1. **Given** a player selects a frozen tile for swapping, **When** the swap is submitted and rejected by the server, **Then** the involved tiles shake (3–4 oscillations over 300–400ms) and briefly show a red border (visible for ~200ms).
2. **Given** a player makes a swap rejected for any reason, **When** the animation completes, **Then** the tiles return to their normal visual state and remain selectable.
3. **Given** a swap is rejected, **When** the shake animation plays, **Then** the board state is unchanged (no tiles moved).
4. **Given** multiple rapid invalid swaps occur, **When** each rejection is received, **Then** each swap triggers its own independent shake cycle without visual corruption from earlier animations.

---

### Edge Cases

- What happens when the score delta is exactly 0 (round had no scoreable words for the viewing player)? → No popup is shown.
- What happens if a new round resolves while a popup is still fading out from the prior round? → The old popup is dismissed and a new popup cycle starts immediately.
- What happens when the combo bonus is 0? → The combo component is omitted from the display rather than showing "+0 combo".
- What happens when only one word component is non-zero (e.g. letters only, no length bonus, no combo)? → Only the non-zero lines are shown.
- What happens if the player's connection drops mid-round and they receive the round summary late? → The popup appears when the summary arrives, regardless of timing.
- What happens if both tiles in a rejected swap are frozen? → Both tiles shake simultaneously; the behaviour is the same as any other rejected swap.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After each round in which the current player earns points, the system MUST display a transient score breakdown popup near the player's score in the HUD. The popup MUST appear regardless of whether the RoundSummaryPanel overlay is also visible — both may be on screen simultaneously.
- **FR-002**: The popup MUST show the point components that contributed to the player's round delta: letter-value total, length bonus total, and combo bonus (each as a labelled addend, e.g. "+18 letters, +3 length, +2 combo").
- **FR-003**: Components with a value of zero MUST be omitted from the popup display.
- **FR-004**: The popup MUST be visible only to the current player — it reflects "your" round gain, not the opponent's.
- **FR-005**: The popup MUST animate: fade in over 200ms, remain visible for 2–2.8 seconds, then fade out over 200ms, after which it is removed from the display. When the user's reduced-motion preference is active, the popup MUST appear instantly (no fade), hold for the same duration, then disappear instantly — the score breakdown content is still shown.
- **FR-006**: The popup MUST NOT appear when the player's round delta is zero.
- **FR-007**: The popup MUST be accessible to screen readers via an appropriate live region, announcing the score breakdown without interrupting other content.
- **FR-008**: When a move is rejected by the server, the selected tiles MUST perform a shake animation (3–4 oscillations over 300–400ms) to signal the rejection. The shake MUST be triggered exclusively by a server rejection response — no client-side pre-validation triggers the animation (consistent with the server-authoritative architecture).
- **FR-009**: When a move is rejected by the server, the selected tiles MUST briefly display a red border (visible for approximately 200ms) alongside the shake animation.
- **FR-010**: After the rejection animation completes, the tiles MUST return to their default visual state with no residual styling.
- **FR-011**: The rejection animation MUST NOT alter the board state — all tiles remain in their pre-attempt positions.
- **FR-012**: Rejection animations MUST be independent and re-triggerable; a second rejection before a prior animation completes MUST start a fresh animation cycle.

### Key Entities

- **ScoreDeltaBreakdown**: The per-round, per-player scoring components — letter points total, length bonus total, combo bonus — derived from the existing `RoundSummary`. No new server-side data is required.
- **RoundSummary** (existing): Already contains per-word score detail (letter points, bonus points), combo bonus, and player attribution. The breakdown is derived client-side by filtering and summing the existing fields.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a scoring round, the score breakdown popup appears within 200ms of the round summary being received by the client.
- **SC-002**: The popup remains visible for 2–3 seconds (inclusive of fade-in and fade-out) and disappears without any user interaction.
- **SC-003**: Zero additional network requests or server changes are required — all breakdown data is derived from the existing round summary payload.
- **SC-004**: When a swap is rejected, the shake animation begins within one frame of receiving the rejection response, providing perceptibly immediate feedback.
- **SC-005**: All animations are implemented using CSS transforms and opacity changes only, producing no layout reflow and maintaining smooth rendering.
- **SC-006**: The popup and rejection animation pass WCAG 2.1 Level A requirements — content is available to assistive technologies and animations respect the user's reduced-motion system preference. When reduced-motion is active, the score breakdown popup MUST still appear (instant show/hide, no fade); the shake animation for rejected swaps MAY be reduced to a single brief flash or border-only signal without lateral movement.

---

## Clarifications

### Session 2026-02-26

- Q: Should the shake animation be triggered optimistically client-side for locally-detectable invalid moves, or always wait for the server rejection response? → A: Server response only — shake fires exclusively on receiving a server rejection, regardless of rejection reason, consistent with the server-authoritative architecture.
- Q: Should the score delta popup appear in the HUD while the RoundSummaryPanel overlay is also on screen? → A: Show both simultaneously — the popup appears in the HUD regardless of panel state; they occupy different visual areas and serve different purposes.
- Q: When reduced-motion is active, should the score delta popup still appear or be skipped entirely? → A: Appear instantly (no fade) — the score breakdown content is still shown; motion is removed but information is preserved.

---

## Assumptions

- The existing `RoundSummary` payload (accessible in `MatchClient`) already contains sufficient data to derive the score breakdown: per-word letter points, per-word bonus points, combo bonus, and player attribution. No backend changes are required.
- "Current player" is identified by comparing `playerSlot` against the session's `playerId`, using the pattern already established in `MatchClient`.
- Popup positioning ("near the player's score") means adjacent to the player's score display in the HUD, with the exact placement determined during implementation to suit the existing layout.
- Duplicate-word scores (already tracked as `isDuplicate: true` in `WordScore`) contribute 0 to the delta and are excluded from the breakdown totals, matching existing scoring behaviour.
- The shake animation for invalid swaps reuses or extends the animation infrastructure introduced in spec 004 (board CSS keyframes); no new animation library is added.
- "Reduced-motion" system preference will be respected: the score delta popup appears instantly (no fade) rather than being skipped; the shake animation for rejected swaps is reduced to a non-motion signal (border-only flash).
