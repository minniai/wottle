# Wottle Project Analysis

**Date:** 2026-02-14
**Scope:** Full project analysis against PRD and specifications

---

## Executive Summary

Wottle has a strong foundation: both spec milestones (001 and 002) are marked complete, the CI pipeline is robust, the architecture is well-designed, and the codebase follows solid patterns. However, there is a significant gap between what's been built and what the PRD defines as the core gameplay experience. The most critical missing piece is **the word-finding and scoring engine** — the heart of the game — which remains a placeholder.

---

## 1. Critical Gaps (PRD vs Implementation)

### A. Word-Finder Engine (Not Implemented)

This is the single biggest gap. The PRD defines Wottle as a "competitive word duel" where the core loop is: swap tiles → find words → score points → freeze tiles. Currently:

- `computeWordScoresForRound()` in `app/actions/match/publishRoundSummary.ts` is a **placeholder returning an empty array**
- No Trie or hash-set dictionary implementation exists
- No 8-directional word scanner exists
- No delta detection (new words formed vs pre-existing)
- No unique-word-per-player-per-match tracking

The 683k-entry Icelandic word list (`prd/wordlist/word_list_is.txt`) is present but unused at runtime.

**What's needed per the PRD (Section 5):**

- In-memory Trie structure with binary search fallback; O(1) lookup
- 8-directional scanner: horizontal (L→R, R→L), vertical (T→D, D→T), diagonals (all 4)
- Valid words: 3+ contiguous letters in one direction, no wrapping
- Delta detection: only newly formed words after a swap
- Unique scoring: each word scores only once per player per match

### B. Scoring Formula Mismatch

The scoring formula is partially implemented in `lib/scoring/roundSummary.ts` but uses a simplified bonus structure that doesn't match the PRD.

**PRD formula (Section 2.1):**

```
Turn Score = Σ(Base Word Scores) + Σ(Length Bonuses) + Multi-Word Combo Bonus

Length Bonus = (word_length − 2) × 5 per word

Multi-Word Bonus:
  1 word  → +0
  2 words → +2
  3 words → +5
  4+ words → +7 + (n−4)
```

**Current implementation:**

```
Length >= 6 → (length - 5) * 2
Length >= 4 → length - 3
No multi-word combo bonus at all
```

Additionally, `getCurrentScoreTotals()` returns hardcoded `{ playerA: 0, playerB: 0 }`.

### C. Frozen Tiles (Not Implemented)

The PRD's frozen tile mechanic (Section 1.5) is a core strategic element — claimed words freeze tiles, creating territory. None of this is implemented:

- No frozen tile tracking in board state
- No swap validation preventing frozen tile moves
- No visual frozen overlay on the board
- No server-side enforcement of the ≥24 unfrozen tiles safeguard
- No dual-color pattern for shared-letter tiles

### D. Clock/Timer Management (Partially Implemented)

`TimerHud.tsx` and `timerStore.ts` exist, but the PRD specifies:

- 5+0 chess clock (5 minutes per player, no increment)
- Clock pauses when player submits swap
- Clock resumes on next round
- Server-authoritative time (client clocks are display-only)
- Time expiration prevents further moves
- Periodic clock sync updates (>1s drift triggers correction)

The current timer appears to be client-side only, without server-authoritative enforcement.

---

## 2. Architecture & Code Quality

### Strengths

| Area | Assessment |
|---|---|
| Server-authoritative pattern | Well-implemented. All mutations flow through Server Actions with Zod validation |
| Supabase client separation | Clean split between service-role (server) and anon (browser), with guard script |
| Realtime with polling fallback | Graceful degradation in `matchChannel.ts` and `presenceChannel.ts` |
| State machine | Clean round lifecycle (`pending → collecting → resolving → completed`) |
| Type safety | Shared types in `/lib/types/` with Zod schemas. Explicit return types on Server Actions |
| Rate limiting | Scoped limits (`auth:login` 5/min, `match:submit-move` 30/min) |
| Accessibility | Focus trap, roving focus, WCAG considerations |
| Database schema | Well-structured migrations with RLS policies on all tables |
| Reconnection handling | 10-second window with graceful degradation |

### Areas for Improvement

- **Legacy endpoints remain**: `api/board/route.ts`, `api/swap/route.ts`, `actions/getBoard.ts`, `actions/swapTiles.ts` from the scaffold phase should be cleaned up or marked deprecated
- **E2E swap tests have TODOs**: Two tests in `swap-flow.spec.ts` note they need updating to create/join a match first
- **No explicit `next.config.js`**: Missing production optimizations, security headers, image config
- **No `.nvmrc` or `engines` field**: Node.js version isn't pinned

---

## 3. Testing & CI

### Strengths

- Comprehensive multi-layer test strategy (unit, integration, contract, E2E, perf)
- Artillery performance tests with threshold assertions
- Act-compatible CI for local testing (`scripts/act.sh`)
- Robust Playwright infrastructure with retry helpers and exponential backoff
- JUnit XML output for CI reporting

### Concerns

- **TDD compliance is weak in practice**: Git history shows ~20% conventional commit adherence. Very few `test(...)` commits precede `feat(...)` commits. The Red-Green-Refactor cycle mandated by the constitution isn't reflected in the commit history.
- **Playwright stabilization consumed significant effort**: ~30+ commits dedicated to making E2E tests pass in CI (Docker networking, timing, port conflicts). Recent commit history includes messages like `"Playwright fix no. 50"`, `"Playwright fix no. 55"`.
- **Commit message quality degraded**: Only ~20% follow conventional commits. Many informal messages during fix cycles.
- **Missing Stylelint in CI**: Configured locally but not enforced in the pipeline.

---

## 4. Infrastructure & Deployment

| Area | Status |
|---|---|
| Package management | `pnpm@10.28.0` pinned, well-maintained |
| Dependencies | Modern and recent (Next.js 16.1.3, React 19.2.3, TS 5.9.3) |
| ESLint | Flat config, zero-warnings policy enforced in CI |
| Prettier | Configured with Tailwind plugin |
| CI pipeline | Comprehensive: lint → typecheck → unit → integration → quickstart → E2E → perf |
| Deployment config | **Not configured** — no Vercel config, no Docker deployment |
| Dependency automation | **Missing** — no Dependabot or Renovate |
| Monitoring | **Missing** — no Sentry, APM, or uptime monitoring |
| Node.js pinning | **Missing** — no `.nvmrc` or `engines` field |

---

## 5. Project Statistics

| Metric | Value |
|---|---|
| Total commits | 305 (263 non-merge) |
| Project lifespan | 2025-10-12 to 2026-02-13 (~4 months) |
| Contributors | 1 (solo project) |
| Pull requests merged | 43+ |
| Server Actions | 12 files |
| API routes | 10 files |
| React components | ~14 files |
| Database migrations | 3 files |
| Unit tests | 15+ files |
| Integration/E2E tests | 15+ files |
| Contract tests | 7 files |

---

## 6. Recommended Next Steps (Priority Order)

### P0 — Core Gameplay (Blocks Playtesting)

#### 1. Implement the Word-Finder Engine

- Build a Trie from the Icelandic word list for O(1) lookups
- Create an 8-directional board scanner that identifies all valid words
- Implement delta detection (new words formed vs pre-existing)
- Wire into `computeWordScoresForRound` replacing the placeholder
- Add unique-word-per-player-per-match tracking
- Target: <50ms validation per the PRD performance SLA

#### 2. Fix the Scoring Formula

- Align `calculateWordScore` with the PRD formula: `(word_length − 2) × 5` for length bonus
- Add multi-word combo bonus (1→+0, 2→+2, 3→+5, 4+→+7+(n−4))
- Implement the turn score delta display format: `"+18 letters, +3 length, +2 combo"`
- Replace `getCurrentScoreTotals` placeholder

#### 3. Implement Frozen Tiles

- Track frozen tile state per player in the board/round model
- Validate swaps reject frozen tiles server-side
- Enforce ≥24 unfrozen tiles safeguard
- Add visual frozen tile overlay (colored border + 40% opacity tint)
- Handle dual-color patterns for shared-letter tiles

### P1 — Gameplay Completeness

#### 4. Server-Authoritative Timer

- Store clock state server-side (not just client)
- Pause clock on swap submission, resume on next round
- Enforce time expiration preventing further moves
- Add clock sync updates to prevent client drift (>1s triggers correction)

#### 5. Board Generation Enhancement

- Seed word embedding (≥6 potential words solvable within ≤2 swaps)
- Anti-clustering validation
- Minimum 20 possible words validation
- Deterministic generation from match_id seed

### P2 — Quality & Polish

#### 6. Clean Up Legacy Code

- Remove or deprecate `api/board/route.ts`, `api/swap/route.ts`, `actions/getBoard.ts`, `actions/swapTiles.ts`
- Fix `swap-flow.spec.ts` TODOs
- Replace `getCurrentScoreTotals` placeholder

#### 7. Improve Git Hygiene

- Re-establish conventional commit discipline
- Consider squash-merging fix cycles to keep history clean
- Add a commit-msg hook (commitlint) to enforce format

#### 8. Add Production Configuration

- Create `next.config.js` with security headers, image optimization
- Add `.nvmrc` pinning Node 20.x
- Add `engines` field to `package.json`
- Configure Dependabot/Renovate

### P3 — Production Readiness

#### 9. Deployment Pipeline

- Configure Vercel deployment (or alternative)
- Set up Supabase Cloud project for production
- Add staging environment
- Configure environment-specific feature flags

#### 10. Monitoring & Error Tracking

- Add Sentry (or equivalent) for error tracking
- Configure uptime monitoring
- Add real-user performance monitoring (Core Web Vitals)
- Set up alerts for performance SLA violations

#### 11. Mobile Responsiveness

- The PRD has detailed mobile specs (touch targets ≥44×44px, pinch-to-zoom, haptic feedback)
- Currently no evidence of mobile-specific implementation or testing

---

## 7. Suggested Spec 003: Word Engine & Scoring

Given that both specs are complete but the core word-finding mechanic is a placeholder, the natural next milestone would be:

**`003-word-engine-scoring`** covering:

1. Trie construction from Icelandic dictionary
2. 8-directional word scanning algorithm
3. Delta word detection (new words per swap)
4. PRD-compliant scoring formula
5. Unique word tracking per player per match
6. Frozen tile mechanics
7. Integration with round engine (`computeWordScoresForRound`)
8. Performance validation (<50ms word validation)

This would transform Wottle from a "swap tiles and see round numbers increment" prototype into an actual playable word game. Everything else — the lobby, matchmaking, realtime infrastructure, round engine — is ready and waiting for this core piece.

---

## 8. Overall Status Matrix

| Area | Status | Rating |
|---|---|---|
| Infrastructure & CI | Excellent | ✅ Strong |
| Architecture & Patterns | Excellent | ✅ Strong |
| Authentication & Lobby | Complete | ✅ Strong |
| Matchmaking & Invites | Complete | ✅ Strong |
| Round Engine & State Machine | Complete | ✅ Strong |
| Realtime & Reconnection | Complete | ✅ Strong |
| **Word Finding & Dictionary** | **Placeholder** | ❌ Critical Gap |
| **Scoring System** | **Simplified / Incomplete** | ❌ Critical Gap |
| **Frozen Tiles** | **Not Implemented** | ❌ Critical Gap |
| Server-Authoritative Timer | Partial | ⚠️ Needs Work |
| Board Generation (seeding) | Partial | ⚠️ Needs Work |
| Mobile Support | Not Started | 📋 Future |
| Deployment / Production | Not Configured | 📋 Future |
| Monitoring / Observability | Not Configured | 📋 Future |
