# 015-sensory-feedback-sequential-reveal

## Context

Following the **013-scoring-change** (orthogonal-only scanning, submission-time precedence, and cross-validation), the game's mechanics have become more nuanced and competitive. To ensure these rules are intuitive and the game feels "alive," we need to focus on sensory feedback and the temporal flow of round resolution.

This proposal targets **"Juice"** and **Visual Clarity** as defined in PRD §1.3 (Mobile Feedback) and §7.2 (Visual/Audio Feedback).

---

## 1. Sensory Feedback (Audio & Haptics)

We will implement a unified sensory feedback system to enhance tactile engagement, particularly for mobile players.

### 1.1 Audio Feedback
Implement a simple `useAudio` hook or service to manage sound effects (SFX). Since no assets exist, this spec includes selecting or synthesizing a set of consistent, low-latency sounds:
- **Tile Selection:** A subtle "click" or high-frequency "pop."
- **Tile Swap:** A satisfying "whoosh" or sliding sound (150-250ms duration).
- **Word Discovery:** A rewarding chime or chord that scales slightly with word length.
- **Invalid Move:** A low-frequency "thud" or "buzz" to accompany the existing shake animation.

### 1.2 Haptic Feedback
Utilize the `navigator.vibrate` API to provide tactile confirmation of actions:
- **Valid Swap:** A single short pulse (10-20ms).
- **Invalid Swap:** A double-pulse "staccato" (e.g., `[30, 50, 30]`) when attempting to move frozen tiles.
- **Match Start/End:** A longer, distinct vibration pattern.

---

## 2. Sequential Round Resolution

Currently, when a round resolves, all newly discovered words flash simultaneously. This obscures the **Time-Based Precedence** rule where the first player to submit gets their tiles frozen first.

### 2.1 The "Temporal Reveal" Flow
Refactor the resolution phase in `MatchClient` to show the sequence of events:
1. **Move 1 Reveal:** Animate the first-submitter's swap, highlight their found words, and show their score delta. (Duration: 600-800ms)
2. **Move 2 Reveal:** Animate the second-submitter's swap, highlight their words (which might be affected by Move 1's frozen tiles), and show their score delta. (Duration: 600-800ms)
3. **Round Summary:** Display the final `RoundSummaryPanel` after both moves have been visually resolved.

This sequence makes it clear *why* certain tiles were frozen first and builds tension during the reveal.

---

## 3. Settings & Controls

Sensory feedback can be polarized. We will provide simple toggles to ensure accessibility and player comfort.

### 3.1 Settings Menu
Add a "Settings" overlay or section in the Lobby and Match UI:
- **Sound Effects:** Toggle (On/Off).
- **Haptic Feedback:** Toggle (On/Off).
- Settings should persist in `localStorage`.

---

## 4. Why this is the Next Step

1. **Low Technical Risk:** No database migrations or complex backend logic required. The data for sequential reveals is already provided by the `RoundSummary`.
2. **High Playability Impact:** Sensory "juice" is the difference between a functional grid and an addictive game. It reinforces the "feel" of the board and the reward of finding words.
3. **Strategic Clarity:** Sequential reveals teach the player the value of submission speed, which is a key differentiator in the Wottle meta.
4. **PRD Compliance:** Fulfills multiple "Visual/Audio Feedback" requirements that are currently missing.
