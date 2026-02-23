# Proposal: 004-board-ui-and-animations

## Overview

Based on the Wottle PRD and the recent completion of `003-word-engine-scoring`, it's clear the backend logic is solidifying but the frontend is lagging behind the product vision. The current UI is mostly a scaffolding for testing and doesn't fit on the screen properly.

To make the game immediately feel playable and enjoyable without taking on a massive chunk of work, we propose the next specification be **`004-board-ui-and-animations`**.

This feature will bridge the gap between your finished scoring logic (003) and the user experience, focusing strictly on presentation and "game feel" rather than backend complexity.

## Scope of Work

This specification would focus entirely on **Section 7: UI / UX** of the PRD, specifically targeting the board and tile interactions. It is scoped to take only a few days but will yield a massive upgrade in playability.

Here is what the scope should include:

### 1. Responsive Board Sizing (Fixing the layout)

- **The Problem:** The 10x10 grid is rigid and overflowing the screen.
- **The Fix:** Refactor the board container and tile components to use responsive CSS (like `vmin` or Tailwind container/aspect-ratio utilities).
- **PRD Goal:** Ensure the board scales gracefully on both Desktop and Mobile, keeping tiles perfectly square and ensuring all 100 tiles are visible without breaking the layout.

### 2. Visual State for "Frozen" Tiles (Building on 003)

- **The Problem:** 003 implemented scoring and tile freezing logic in the backend, but players likely can't see this territory control on the board yet.
- **The Fix:** Implement the PRD's requirement for frozen tiles: a colored border and a 40% opacity overlay based on the player who claimed it (e.g., green for You, red for Opponent).
- **PRD Goal:** Players need to visually understand what tiles are locked out of play and who owns them to strategize.

### 3. Core Interaction Animations

- **The Problem:** Swapping tiles right now probably feels instantaneous or disjointed.
- **The Fix:**
  - Add the **150–250ms smooth CSS transform** when two tiles are swapped.
  - Add the **"Shake" animation + red border flash** (300-400ms) for invalid swap attempts (e.g. trying to swap a frozen tile).
- **PRD Goal:** These micro-interactions are crucial for visual feedback so players know their input was registered.

### 4. Word Discovery Highlights

- **The Problem:** When a word is formed (logic from 003), it just silently updates the score.
- **The Fix:** Implement the brief 600-800ms "pulsing glow" on the newly formed word's tiles right after a round resolves.

## Why this is the best next step

- **Low Risk, High Reward:** It doesn't require modifying the matchmaking, Supabase schema, or the complex game state machine. It is 90% frontend React/Tailwind/CSS work.
- **Playability:** Fixing the sizing and adding frozen tile colors instantly makes the game testable by humans. You can actually play a full match and visually understand the board state constraint.
- **Momentum:** It's inspiring to see the game "snap" into reality. Once it looks and feels like a real game, tackling the remaining complex logic (like clocks, end-game conditions, or ranked matchmaking) will be much easier.
