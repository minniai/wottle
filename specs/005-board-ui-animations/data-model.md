# Data Model: Board UI and Animations

**Feature**: 005-board-ui-animations
**Date**: 2026-02-23

## Overview

This feature is entirely client-side. No database schema changes, no new tables, no migrations. All data consumed by the UI components already exists in the `MatchState` type broadcast via Supabase Realtime.

## Entities (Client-Side)

### PlayerColors (new constant)

Centralized color definitions extracted from BoardGrid's FROZEN_COLORS.

```
PlayerColors
├── PLAYER_A_HEX: "#3B82F6" (Blue)
├── PLAYER_A_OVERLAY: "rgba(59, 130, 246, 0.4)" (40% opacity)
├── PLAYER_A_HIGHLIGHT: "rgba(59, 130, 246, 0.6)" (60% opacity for glow)
├── PLAYER_B_HEX: "#EF4444" (Red)
├── PLAYER_B_OVERLAY: "rgba(239, 68, 68, 0.4)" (40% opacity)
├── PLAYER_B_HIGHLIGHT: "rgba(239, 68, 68, 0.6)" (60% opacity for glow)
└── BOTH_GRADIENT: "linear-gradient(135deg, <A_OVERLAY> 50%, <B_OVERLAY> 50%)"
```

**Source**: Extracted from `components/game/BoardGrid.tsx` FROZEN_COLORS (existing values unchanged).
**Consumers**: BoardGrid (frozen overlays), GameChrome (score accents), MatchClient (word highlights).

### AnimationPhase (new enum)

State machine for round resolution visual sequencing.

```
AnimationPhase
├── "idle"            — No animation in progress
├── "highlighting"    — Word discovery highlights playing (600-800ms)
├── "freezing"        — Frozen tile overlays updating (~200ms settle)
└── "showing-summary" — Round summary panel displayed
```

**Transitions**: idle → highlighting → freezing → showing-summary → idle (on dismiss)
**Trigger**: Receiving a `round-summary` broadcast event in MatchClient.

### GameChromeProps (new interface)

Props for the opponent/player bar component.

```
GameChromeProps
├── position: "opponent" | "player"
├── playerName: string
├── score: number
├── timerSeconds: number
├── timerPaused: boolean
├── hasSubmitted: boolean (drives green/neutral timer color)
├── moveCounter?: number (only for position="player")
└── playerColor: string (hex color for accent)
```

**Source data**: All fields derivable from MatchState + session player ID.

## Existing Entities (No Changes)

### MatchState (consumed, not modified)

```
MatchState
├── matchId: string
├── board: string[][] (10x10)
├── currentRound: number
├── state: MatchPhase
├── timers: { playerA: TimerState, playerB: TimerState }
├── scores: ScoreTotals { playerA: number, playerB: number }
├── lastSummary?: RoundSummary
├── disconnectedPlayerId?: string
└── frozenTiles?: FrozenTileMap (Record<"x,y", { owner: FrozenTileOwner }>)
```

### FrozenTileMap (consumed, not modified)

```
FrozenTileMap = Record<string, FrozenTile>
├── key: "x,y" coordinate string (e.g., "3,5")
└── value: FrozenTile { owner: "player_a" | "player_b" | "both" }
```

### RoundSummary (consumed, not modified)

```
RoundSummary
├── matchId: string
├── roundNumber: number
├── words: WordScore[] (with playerId, coordinates for highlight positioning)
├── deltas: ScoreTotals (round points earned)
├── totals: ScoreTotals (cumulative scores)
├── comboBonus?: ScoreTotals
├── highlights: Coordinate[][] (tile groups for visual highlights)
└── resolvedAt: string
```

## Database Impact

**None**. Zero migrations. Zero schema changes. All data already flows from server to client via the existing Realtime broadcast infrastructure established in specs 002 and 003.
