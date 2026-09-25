# Implementation Plan: Fix Lobby Empty State

**Branch**: `073-fix-lobby-empty-state` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

## Summary

Replace the first-player instructional board in the lobby's last-match slot with a truthful no-prior-game state. Retain completed-match previews unchanged. The instructional board is a real, fixed-size field and exceeds the intermediate-width sidebar, so removing it also eliminates the reported clipping at its source.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22  
**Primary Dependencies**: Next.js 16, React 19  
**Storage**: Existing Supabase match history; no schema change  
**Testing**: Vitest unit tests; existing Playwright visual coverage where applicable  
**Target Platform**: Modern desktop and mobile browsers  
**Project Type**: Web application  
**Performance Goals**: No additional network request or client-side rendering cost  
**Constraints**: A lobby page never renders a field; all content is reachable at supported narrow widths  
**Scale/Scope**: One lobby empty-state component and focused regression coverage

## Constitution Check

| Gate | Status | Evidence |
| --- | --- | --- |
| Server-authoritative game logic | Pass | Presentation-only; no match state or scoring changes. |
| Real-time performance | Pass | Removes an unnecessary 100-cell field from first-player lobby rendering. |
| Type safety | Pass | Reuses existing nullable `Overview.lastMatch` contract. |
| Mobile-first | Pass | Removes the 300px child that exceeds the 260px sidebar at 901–1167px. |
| TDD | Pass | Add focused regression assertions before component changes. |
| Design system | Pass | Binding design says pages, including the lobby, never draw a field. |

## Project Structure

```text
components/page/lobby/Lobby.tsx                 # Empty-state/completed-preview conditional
components/page/lobby/LastMatch.tsx             # Existing completed-match preview, unchanged
lib/lobby/overview.ts                           # Existing nullable last-match lookup, unchanged
tests/unit/components/page/lobby/Lobby.spec.tsx # Regression coverage
```

**Structure Decision**: Keep the page/lobby component boundary. `overview.lastMatch` already distinguishes completed history from no history, so no data or server-contract change is needed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| None | — | — |
