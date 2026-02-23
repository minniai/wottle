# API Contracts: Board UI and Animations

**Feature**: 004-board-ui-animations

## No New API Contracts

This feature is entirely client-side. It introduces:
- **0** new Server Actions
- **0** new API routes
- **0** new database queries
- **0** new Realtime events

All data consumed by the UI components already exists in the `MatchState` and `RoundSummary` types broadcast via the existing Supabase Realtime channel infrastructure (established in specs 002 and 003).

## Existing Contracts Consumed (No Changes)

| Contract | Type | Source |
|----------|------|--------|
| `match:${matchId}` Realtime channel | WebSocket broadcast | `lib/realtime/matchChannel.ts` |
| `state` broadcast event | MatchState payload | `lib/match/statePublisher.ts` |
| `round-summary` broadcast event | RoundSummary payload | `app/actions/match/publishRoundSummary.ts` |
| `/api/match/${matchId}/move` | POST (swap submission) | `app/api/match/[matchId]/move/route.ts` |
| `/api/match/${matchId}/state` | GET (polling fallback) | `app/api/match/[matchId]/state/route.ts` |
