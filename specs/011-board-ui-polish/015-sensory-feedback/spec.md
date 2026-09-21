# Feature Specification: Sensory Feedback & Sequential Round Reveal

**Feature Branch**: `015-sensory-feedback`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "Sensory feedback system with audio SFX, haptic feedback, sequential round resolution temporal reveal, and player settings toggles for sound and haptics"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sequential Round Resolution Reveal (Priority: P1)

After both players submit their moves, the round resolves with a step-by-step animated reveal rather than all changes appearing simultaneously. The first submitter's move is shown first — their swap animates, their found words highlight, and their score is displayed — followed by the second submitter's move with the same treatment. Players can see exactly why certain tiles were frozen first and how submission order affected the outcome.

**Why this priority**: This is the highest-impact change. It makes the time-based precedence rule legible and teaches players the core competitive mechanic. It also directly improves perceived fairness and strategic depth without requiring any new game data — the round summary already contains everything needed.

**Independent Test**: Can be fully tested by playing a round where both players submit and verifying the resolution plays out in two sequential steps, each showing one player's swap, word highlights, and score delta before the final summary appears.

**Acceptance Scenarios**:

1. **Given** both players have submitted moves for a round, **When** the round resolves, **Then** the first submitter's swap animation and word highlights appear before the second submitter's.
2. **Given** the first player's move is revealed, **When** their found words are highlighted, **Then** their score delta is visible before the second player's reveal begins.
3. **Given** both reveals have completed, **When** the round summary is ready, **Then** the final round summary panel appears after both individual reveals.
4. **Given** a player's found words conflict with already-frozen tiles from the first reveal, **When** the second reveal plays, **Then** the affected tiles are shown as frozen and the player's word score reflects the frozen-tile outcome.

---

### User Story 2 - Round 1 Timer Parity (Priority: P1)

When a player submits their move, their own chess clock pauses. Their opponent's clock continues running until the opponent also submits, at which point the round resolves. This behaviour applies to all rounds. Round 1 currently behaves differently: submitting in round 1 does not pause the submitting player's clock. This inconsistency was a deliberate design from an earlier era when the first-move advantage mattered; that design is no longer relevant. Round 1 must now behave identically to all other rounds.

**Why this priority**: Timer behaviour is a core game mechanic. An inconsistency in round 1 is confusing and unfair — the player who submits first in round 1 receives no clock benefit that they would receive in every other round. Fixing this aligns the game rules and eliminates a legacy special case.

**Independent Test**: Can be fully tested by starting a match, having one player submit in round 1, and verifying only that player's clock pauses while the opponent's clock keeps ticking — matching the observable behaviour in rounds 2–10.

**Acceptance Scenarios**:

1. **Given** round 1 is active and neither player has submitted, **When** the first player submits their move, **Then** only that player's clock pauses; the opponent's clock continues ticking — identical to behaviour in rounds 2–10.
2. **Given** round 1 is active and the first player has submitted (their clock paused, opponent's clock running), **When** the second player also submits, **Then** the second player's clock pauses and the round resolves normally.
3. **Given** rounds 2–10 are active, **When** the first player submits, **Then** only the submitting player's clock pauses and the opponent's clock continues ticking (no regression).

---

### User Story 3 - Audio Feedback for Game Actions (Priority: P2)

Players hear distinct, short sound effects when they select a tile, successfully swap tiles, discover a word, or make an invalid move. Each sound is contextually appropriate — pleasant for successes, subtly negative for errors — so players receive immediate auditory confirmation of their actions without needing to watch the screen.

**Why this priority**: Audio feedback is a foundational "game feel" improvement that reinforces every interaction. It is independent of other features and delivers immediate value, but is lower priority than sequential reveal because it is purely additive (removing it does not break comprehension of game mechanics).

**Independent Test**: Can be fully tested by performing each game action (select tile, swap, word discovered, invalid move) and verifying the correct sound plays for each, with no audio playing when sounds are turned off in settings.

**Acceptance Scenarios**:

1. **Given** sound effects are enabled, **When** a player taps/clicks a tile to select it, **Then** a brief selection sound plays immediately.
2. **Given** sound effects are enabled, **When** a player completes a valid tile swap, **Then** a swap sound plays within 100ms of the action.
3. **Given** sound effects are enabled, **When** a word is discovered during round resolution, **Then** a rewarding word-discovery sound plays.
4. **Given** sound effects are enabled, **When** a player attempts an invalid move (e.g., swapping a frozen tile), **Then** a distinct error sound plays.
5. **Given** sound effects are disabled, **When** any game action occurs, **Then** no audio plays.

---

### User Story 4 - Haptic Feedback for Game Actions (Priority: P3)

On supported mobile devices, players feel tactile vibration patterns confirming their actions. A brief pulse confirms a valid swap; a double staccato pulse signals an invalid action such as attempting to move a frozen tile. A distinct longer pattern signals the start and end of a match. Players can distinguish valid from invalid actions by touch alone.

**Why this priority**: Haptic feedback is a mobile-specific enhancement. It is the most narrowly applicable of the three features (desktop users are unaffected) and delivers the least incremental value on top of audio and visual feedback already present.

**Independent Test**: Can be fully tested on a mobile device with vibration support by performing valid swaps, invalid moves, and match start/end, and verifying the correct vibration pattern is felt for each.

**Acceptance Scenarios**:

1. **Given** haptic feedback is enabled and the device supports vibration, **When** a player completes a valid swap, **Then** a single short vibration pulse is felt.
2. **Given** haptic feedback is enabled, **When** a player attempts to swap a frozen tile, **Then** a double staccato vibration pattern is felt.
3. **Given** haptic feedback is enabled, **When** a match starts or ends, **Then** a distinct longer vibration pattern is felt.
4. **Given** haptic feedback is disabled, **When** any game action occurs, **Then** no vibration is triggered.
5. **Given** haptic feedback is enabled but the device does not support vibration, **When** any game action occurs, **Then** the game continues normally with no errors.

---

### User Story 5 - Sensory Feedback Settings (Priority: P2)

Players can toggle audio sound effects and haptic feedback independently via a settings control accessible from both the lobby and the match interface. Their preferences persist between sessions so they do not need to adjust settings on every visit.

**Why this priority**: Settings are a prerequisite for respectful delivery of audio and haptics. Players should always be able to opt out. This is P2 (same as audio) because audio without the ability to disable it would be a regression for some users.

**Independent Test**: Can be fully tested by toggling each setting, verifying the change takes effect immediately, navigating away and returning, and confirming the preference was retained.

**Acceptance Scenarios**:

1. **Given** a player is in the lobby or match UI, **When** they click/tap the gear icon in the page header, **Then** they see a settings panel with independent toggles for "Sound Effects" and "Haptic Feedback."
2. **Given** a player toggles sound effects off, **When** any subsequent game action occurs, **Then** no sound plays.
3. **Given** a player saves their settings and closes the browser, **When** they return to the game, **Then** their sound and haptic preferences are restored.
4. **Given** a player toggles haptic feedback off, **When** they perform a valid swap, **Then** no vibration occurs.

---

### Edge Cases

- What happens if both players submit simultaneously in round 1 — both clocks pause (each on their own submission) and the round resolves normally, same as all other rounds.
- What happens when a player has "prefers-reduced-motion" enabled — the sequential reveal shows all data in order without animations, with no errors.
- What happens when a player's device has its hardware mute switch enabled or media volume at zero — audio must remain silent without errors.
- What happens when the browser's autoplay policy blocks audio before first user interaction — sounds must either queue until after the first interaction or fail silently; no error must surface to the player.
- What happens when only one player submits a move in a round (the other times out) — the reveal shows only that player's move, then proceeds to round summary.
- What happens when both players submit moves targeting the same tile (conflict) — the first submitter's move is revealed first; the second submitter's move is shown as a no-op or rejected.
- What happens when the sequential reveal is interrupted by a disconnect — the summary state must be recoverable when the player reconnects.
- What happens when haptic vibration is called on a device that does not support the vibration API — must fail silently with no error surfaced to the player.

## Requirements *(mandatory)*

### Functional Requirements

#### Round 1 Timer Parity

- **FR-000**: When a player submits their move, the system MUST pause only that player's chess clock; the opponent's clock MUST continue running until they also submit.
- **FR-000a**: In round 1, the system MUST apply the same clock-pause behaviour as all other rounds: submitting player's clock pauses, opponent's clock keeps ticking.
- **FR-000b**: The system MUST NOT apply any special-case timer logic to round 1 that differs from rounds 2–10.

#### Sequential Round Resolution

- **FR-001**: The system MUST reveal the first-submitting player's swap and found words before revealing the second-submitting player's swap and found words.
- **FR-002**: Each reveal step MUST include the player's swap animation, highlighting of any words they scored in that round, and their score delta for that move.
- **FR-003**: The final round summary panel MUST appear only after both individual move reveals have completed.
- **FR-003a**: The combined sequential reveal (both steps) MUST complete within a maximum of 1.6 seconds. Players cannot skip or fast-forward the reveal sequence.
- **FR-003b**: When the OS or browser "prefers-reduced-motion" setting is active, the reveal MUST display each step's data (swap positions, word highlights, score delta) in sequence without motion animations, while preserving the sequential timing.
- **FR-004**: If only one player submitted a move in a round, the system MUST show a single reveal step for that player, then proceed to the round summary.
- **FR-005**: The reveal sequence MUST correctly show tiles frozen by the first player's move before the second player's outcome is displayed.

#### Audio Feedback

- **FR-006**: The system MUST play a distinct sound effect when a player selects a tile.
- **FR-007**: The system MUST play a distinct sound effect when a valid tile swap is completed.
- **FR-008**: The system MUST play a distinct sound effect when a word is discovered during round resolution.
- **FR-009**: The system MUST play a distinct error sound when a player attempts an invalid move.
- **FR-010**: All sound effects MUST begin playing within 100ms of the triggering action.
- **FR-011**: The system MUST NOT play any sound when the player has disabled sound effects.

#### Haptic Feedback

- **FR-012**: On devices that support tactile vibration, the system MUST trigger a single short vibration pulse when a player completes a valid swap.
- **FR-013**: On devices that support tactile vibration, the system MUST trigger a double staccato vibration pattern when a player attempts an invalid move (e.g., frozen tile swap).
- **FR-014**: On devices that support tactile vibration, the system MUST trigger a distinct vibration pattern at match start and match end.
- **FR-015**: The system MUST NOT trigger vibration when the player has disabled haptic feedback.
- **FR-016**: The system MUST NOT throw errors or disrupt gameplay when haptic vibration is unavailable on the device.

#### Settings

- **FR-017**: The system MUST provide an independent toggle for "Sound Effects" (on/off).
- **FR-018**: The system MUST provide an independent toggle for "Haptic Feedback" (on/off).
- **FR-019**: Settings toggles MUST be accessible via a gear/cog icon permanently visible in the page header on both the lobby and in-match pages.
- **FR-020**: Player sensory preferences MUST persist across browser sessions without requiring login.
- **FR-021**: Toggling a setting MUST take effect immediately without requiring a page reload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-000**: In round 1, only the submitting player's clock pauses on submission and the opponent's clock continues ticking — matching the observable behaviour in rounds 2–10 with no measurable difference.
- **SC-001**: The gap between the first player's reveal completing and the second player's reveal beginning is at least 600ms, and the total reveal duration across both steps does not exceed 1.6 seconds, in all observed rounds.
- **SC-002**: All sound effects play within 100ms of the triggering player action across all tested game events.
- **SC-003**: Player sensory preferences are retained across 100% of browser sessions tested (close and reopen browser).
- **SC-004**: Disabling sound effects results in zero audio events fired for any subsequent game action.
- **SC-005**: Disabling haptic feedback results in zero vibration events for any subsequent game action.
- **SC-006**: The sequential reveal completes without errors in all edge cases: single-player submission, conflicting tile targets, and disconnect/reconnect during the reveal phase.
- **SC-007**: Settings controls are reachable in 1 interaction (a single tap or click on the header gear icon) from both the lobby view and the in-match view.

## Clarifications

### Session 2026-03-14

- Q: Can players skip or fast-forward the sequential reveal? → A: No skip; the reveal has a hard maximum total duration (1.6 seconds across both steps) and completes automatically.
- Q: How are settings accessed from the lobby and match pages? → A: A gear/cog icon permanently visible in the page header on both pages (reachable in 1 interaction).
- Q: Does the sequential reveal respect the OS/browser "prefers-reduced-motion" accessibility preference? → A: Yes — when reduce-motion is active, reveals play in sequence without animations but retain their timing and all data (swap positions, word highlights, score delta).

## Assumptions

- The existing round summary broadcast from the server already contains submission timestamps and per-player word and score data sufficient to drive the sequential reveal without additional backend changes.
- Sound assets (SFX files) will be selected or synthesized as part of implementation; no audio assets currently exist in the project.
- The vibration API is the only haptic mechanism in scope — native app haptic engines are out of scope.
- Player settings are stored in the browser's local storage; no server-side persistence of preferences is required.
- The sequential reveal animation durations (600–800ms per step) are implementation defaults and may be tuned during development, but the sequential ordering of the two reveals is non-negotiable and the total must not exceed 1.6 seconds.
- "Invalid move" in the context of haptics and audio means specifically: attempting to swap a frozen tile. Other validation errors such as rate limit exceeded are out of scope for sensory feedback.
- The round 1 timer discrepancy was an intentional legacy design from when first-move advantage determined turn order. That mechanic has been removed, making the special-case round 1 timer behaviour obsolete. No new game rule or data model change is required — only the removal of the special-case condition.
