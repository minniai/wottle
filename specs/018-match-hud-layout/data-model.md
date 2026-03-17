# Data Model: Match HUD Three-Column Layout

**Feature**: 018-match-hud-layout
**Date**: 2026-03-16

## Entities

### MatchPlayerProfile (new type, no new storage)

Represents a player's identity snapshot for display during an active match.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| playerId | string (UUID) | players.id | Primary key |
| displayName | string | players.display_name | Shown in player panel |
| username | string | players.username | Fallback if display_name empty |
| avatarUrl | string \| null | players.avatar_url | Image URL or null for placeholder |
| eloRating | number | players.elo_rating | Default 1200 for new players |

### MatchPlayerProfiles (new type, no new storage)

Container for both players' profiles in a match.

| Field | Type | Notes |
|-------|------|-------|
| playerA | MatchPlayerProfile | Player assigned to slot A |
| playerB | MatchPlayerProfile | Player assigned to slot B |

## Data Access

### loadMatchPlayerProfiles()

**Location**: `lib/match/stateLoader.ts`
**Query**: `supabase.from("players").select("id, username, display_name, avatar_url, elo_rating").in("id", [playerAId, playerBId])`
**Called from**: `app/match/[matchId]/page.tsx` (server component, once at page load)
**Caching**: No caching needed — profiles are static for the match duration and page is not cached.

## Existing Entities (unchanged)

### MatchState
No changes. Player profiles are passed as a separate prop, not embedded in MatchState.

### TimerState
No changes. Contains `playerId` which is used to map to the corresponding MatchPlayerProfile.

### players table (PostgreSQL)
No schema changes. All required columns already exist: `id`, `username`, `display_name`, `avatar_url`, `elo_rating`.
