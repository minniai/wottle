# Implementation Plan: Game Rules Configuration

**Branch**: `009-game-rules-config` | **Date**: 2026-02-27 | **Spec**: [009-game-rules-config/spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-game-rules-config/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This feature introduces a centralized code-based game configuration (`GameConfig`) to easily adjust parameters like word length, rounds, and turn timers. Crucially, it replaces the existing word validation algorithm with a strict Scrabble-style orthogonal adjacency validator. Moves can no longer be played diagonally, and any new tiles placed _must_ form valid dictionary words with all touching orthogonal tiles. The existing scoring metric remains intact, but now tallies the scores of all uniquely formed valid cross-words.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js, React, Supabase
**Storage**: N/A for MVP config (In-memory/Code constants)
**Testing**: Vitest (Unit tests for game-engine)
**Target Platform**: Web Server (Next.js Server Actions)
**Project Type**: Web Application
**Performance Goals**: Word validation <50ms server-side (per Constitution SLA)
**Constraints**: Must maintain existing scoring mechanism
**Scale/Scope**: Core Game Engine overhaul affecting `board.ts`, `validator.ts`, `scorer.ts`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I: Server-Authoritative Logic**: PASS. The `GameConfig` and validation engine overhaul will reside purely in the server-side Game Engine utility functions, invoked via Server Actions.
- **Principle II: Real-Time Performance Standards**: PASS. The recursive cross-word validation algorithm must be designed to return results within the <50ms SLA. Given the maximum board size (15x15) and standard Trie dictionary, this is highly achievable.
- **Principle VII: Test Driven Development**: PASS. Comprehensive Vitest tests MUST be written to define the Scrabble adjacency behaviors BEFORE overhauling the engine logic.

## Project Structure

### Documentation (this feature)

```text
specs/009-game-rules-config/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command output)
```

### Source Code (repository root)

```text
# Web application
app/
├── actions/
│   └── game.ts          # Uses new GameConfig
├── ...

lib/
├── constants/
│   └── game-config.ts   # NEW: Centralized defaults
├── game-engine/
│   ├── board.ts         # MODIFIED: Orthogonal validation
│   ├── scorer.ts        # MODIFIED: Score all cross-words
│   └── word-finder.ts   # MODIFIED: Scrabble adjacency
└── types/
    └── index.ts         # MODIFIED: Add GameConfig, MoveEvaluation interfaces

tests/
├── unit/
│   ├── game-engine/
│   │   ├── board.test.ts
│   │   ├── scorer.test.ts
│   │   └── word-finder.test.ts
└── ...
```

**Structure Decision**: The logic firmly belongs in the existing `/lib/game-engine/` directory which acts as the core ruleset, tested via `/tests/unit/`. The `GameConfig` belongs in a shared constants or types file.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_(No violations. Overhauling the game engine to perfectly match a standard dictionary word game's validation rules is unavoidable complexity strictly required by the product specification)_
