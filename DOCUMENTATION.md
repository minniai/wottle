# Project Documentation

## Overview

Wottle is a local-first prototype of a board game experience. The current focus is on a two-player playtest milestone, enabling users to login, matchmake, and play a 10-round game.

## Technology Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database/Backend**: Supabase (PostgreSQL, Realtime, Auth)
- **Testing**:
  - **E2E**: Playwright
  - **Unit**: Vitest
  - **Performance**: Artillery

## Project Structure

- **`app/`**: Next.js application routes and pages.
- **`components/`**: React components.
- **`lib/`**: Shared utilities, domain logic, and backend services.
- **`specs/`**: GitHub Spec-kit specifications.
  - **`001-e2e-board-scaffold`**: Initial board scaffold (Completed).
  - **`002-two-player-playtest`**: Current milestone (In Progress).
- **`prd/`**: Product Requirement Documents.
- **`scripts/`**: Utility scripts for database seeding, verification, etc.
- **`tests/`**: Test suites (unit, integration, contract, perf).

## Development Status

The project follows a spec-driven development workflow using GitHub Spec-kit.

### Current Spec: `002-two-player-playtest`

This spec focuses on enabling a two-player game loop.

**Completed Phases:**

- **Phase 1: Setup**: Environment and CI configuration.
- **Phase 2: Foundational**: Database schema, RLS policies, domain types, and realtime helpers.
- **Phase 3: User Story 1 (Login/Lobby)**: Authentication, lobby presence, and UI.
- **Phase 4: User Story 2 (Matchmaking)**: Invites, queueing, and match initialization.

**Next Phase:**

- **Phase 5: User Story 3 (Submit Rounds & Resolve Moves)**:
  - Implementing the 10-round state machine.
  - Handling move submissions and validation.
  - Synchronizing game state between players.
  - Implementing the timer HUD.

## Key Entities

- **PlayerIdentity**: User profile and session.
- **LobbyPresence**: Real-time status of players in the lobby.
- **Match**: Game session state, including board seed and rounds.
- **Round**: State of a specific round, including submissions and resolution.
- **MoveSubmission**: A player's move for a round.

## Workflow

1. **Spec**: Define requirements in `specs/`.
2. **Plan**: Create an implementation plan based on the spec tasks.
3. **Test**: Write RED tests (TDD) before implementation.
4. **Implement**: Write code to pass tests.
5. **Verify**: Run automated tests and manual verification.
