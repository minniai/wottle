# Proposal: 006-match-completion

## Overview

Based on the Wottle PRD and the recent/current work in `005-board-ui-animations`, the game is visually coming together. Players can swap tiles, see animations, see claimed words highlight, and watch their scores go up. However, the game currently lacks a true ending. It is effectively an endless sandbox.

To move the implementation forward to a true MVP release, the next specification should be **`006-match-completion`** (or `006-endgame-and-timers`). This feature will bridge the gap between "we can swap tiles and score" and "we can play a complete, discrete match from start to finish."

## Scope of Work

This specification focuses on **Section 1.4 (Turn Structure & Time Control), 1.6 (Game Progression & End Conditions), and 3.4 (Post-Game Flow)** of the PRD.

It is scoped to be relatively small—mostly tying off loose ends in the state machine and adding one new UI screen—but it delivers massive value by completing the core gameplay loop.

### 1. Enforce the 10-Round Limit

- **The Problem:** The game currently allows players to keep submitting moves indefinitely.
- **The Fix:** Implement the PRD's requirement that a match consists of exactly 10 rounds ("moves") per player. Once both players submit their 10th move, the match transitions to an `ended` state.
- **Value:** Creates the necessary tension and strategy. Players only have 10 moves to maximize their score and claim territory.

### 2. Time Control (5:00 Clocks) & Timeouts

- **The Problem:** The PRD specifies a 5:00 minute base time with clocks pausing when a move is submitted, but strict time enforcement may be missing or incomplete.
- **The Fix:**
  - Server-side enforcement of the 5:00 timer.
  - If a player's clock reaches 0, they can no longer submit swaps.
  - The opponent can continue submitting swaps for all remaining rounds until they also reach 10 rounds or run out of time.
- **Value:** Adds the "chess-clock tension" mentioned in the PRD's core vision.

### 3. Post-Game Victory Screen

- **The Problem:** When the match ends, there is no fanfare, winner announcement, or way to leave.
- **The Fix:** Add a `Game Over` modal or screen that displays:
  - Final Scores for both players.
  - The Winner (Highest score wins. Tiebreaker: most frozen tiles).
  - A "Return to Lobby" button.
- **Value:** Provides closure to the match and allows players to cycle back into the lobby to play again, which is essential for MVP playtesting.

## Why this is the best next step

- **Completes the Loop:** You cannot properly playtest a game that doesn't end. By adding the 10-round limit, time expiration, and a victory screen, Wottle becomes a complete, bounded experience.
- **High ROI, Low Risk:** The heavy lifting (matchmaking, real-time board state, word scoring algorithms, and UI animations) is already done. This feature just adds boundaries (move limit, time limit) on top of the existing state machine and a single end-screen component.
- **Path to MVP:** Once `006-match-completion` is done, the core game is feature-complete for unranked playtesting. You can immediately start doing full A/B playtests with real users to test the fun factor.
