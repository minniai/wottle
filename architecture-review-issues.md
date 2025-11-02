# Technical Architecture Review - Issues & Inconsistencies

**Review Date:** 2025-11-02  
**Reviewer:** Technical Design Lead  
**Purpose:** Identify inconsistencies, errors, and PRD misalignments in technical_architecture.md

---

## Critical Issues

### 1. ❌ Architecture Diagram (Section 2.1) - INCORRECT

**Issue:** Diagram shows "Edge Functions" with operations that should be Server Actions:

```txt
│    │ • Move Handler  │  ❌ Should be Server Action
│    │ • Board Gen     │  ❌ Should be Server Action  
│    │ • Validation    │  ❌ Should be Server Action
│    │ • Matchmaking   │  ❌ Should be Server Action
```

**Expected:** Diagram should show:

- Server Actions (Vercel/Next.js) as primary application layer
- Edge Functions only for WebSocket handlers and cron jobs

**Location:** Line 95-103

**Fix Required:** Update diagram to reflect Server Actions architecture

---

### 2. ❌ Missing Move Counter Display in UI Documentation

**PRD Requirement:**

- Display format: "M7" (where 7 is completed moves, range M0-M10)
- Shows current move number for active player
- Updates immediately after each move

**Architecture Doc Status:**

- Move counter mentioned in database schema (`move_number INTEGER NOT NULL`)
- **NOT documented in UI/UX sections (Section 3, Section 7)**
- Missing from component architecture descriptions

**Location:**

- PRD: Lines 212-214
- Architecture: Missing from Section 3 (Frontend Architecture) and Section 7 (UI/UX)

**Fix Required:** Add move counter to:

- Component architecture (Section 3.3)
- UI layout descriptions (Section 7.1 equivalent)
- State management (if separate from timer)

---

### 3. ⚠️ Simultaneous Clock Mechanics - Partially Documented

**PRD Requirement:**

- Both clocks start running when game begins
- Either player can make first move
- Server resolves who moved first
- If both move simultaneously, random decision
- After first move, strict turn-based

**Architecture Doc Status:**

- Mentions `current_turn: 'simultaneous'` in database schema ✅
- Documented in `executeMove` logic: "Validate player's turn (or simultaneous phase)" ✅
- **BUT:** Clock behavior during simultaneous phase not fully detailed

**Location:**

- Section 10 (Timer & Clock Management) mentions clocks but doesn't explicitly state:
  - Both clocks count down during simultaneous phase
  - First move pauses mover's clock, continues opponent's

**Fix Required:** Add explicit documentation in Section 10.1 about simultaneous phase clock behavior

---

### 4. ⚠️ Frozen Tiles Safeguard - Documentation Gap

**PRD Requirement:**

- Server enforces **≥24 unfrozen tiles** after any move
- If threshold breached, game ends immediately (lockup win)

**Architecture Doc Status:**

- Database function `check_board_lockup` mentioned (Line 566) ✅
- Returns true if <24 unfrozen ✅
- **BUT:** Not documented in:
  - `executeMove` Server Action logic flow
  - Game end conditions
  - Error handling section

**Location:**

- Section 4.4 (Database Functions) mentions it
- Missing from Section 4.2 (executeMove logic)
- Missing from Section 6.2 (Move Validation Pipeline)
- Missing from Section 11 (Game end conditions)

**Fix Required:**

- Add lockup check to `executeMove` step-by-step logic
- Document lockup as game end condition
- Add to error handling section

---

### 5. ⚠️ Game End Conditions - Incomplete

**PRD Requirement:**

- Both players reach 10 moves (20 total)
- Time expires for both players
- One player resigns
- Lockup (≤24 unfrozen tiles)

**Architecture Doc Status:**

- Move limit mentioned: "Enforced by 10-move limit + clocks" ✅
- Time expiry mentioned ✅
- Resignation mentioned ✅
- **Lockup missing from game end conditions documentation**

**Location:**

- Section 11 mentions move limit
- Missing comprehensive game end section

**Fix Required:** Add explicit game end conditions section documenting all 4 scenarios

---

## Medium Priority Issues

### 6. ⚠️ Score Delta Popup - Missing Implementation Details

**PRD Requirement:**

- Display duration: 2-3 seconds
- Animation: Fade in 200ms, hold 2-2.8s, fade out 200ms
- Content format: "+18 letters, +3 length, +2 combo"
- Position: Adjacent to score display

**Architecture Doc Status:**

- Component `<ScoreDelta>` mentioned in directory structure ✅
- Breakdown string format matches PRD ✅
- **BUT:** No animation timing details
- No duration/positioning specs

**Location:** Section 3.3 mentions component but lacks PRD-level detail

**Fix Required:** Add animation timing specifications to component documentation

---

### 7. ⚠️ Reconnection Window - Clock Behavior Unclear

**PRD Requirement:**

- ≤10 second reconnection window
- Disconnected player's clock pauses immediately
- After 10s, clock resumes if not reconnected

**Architecture Doc Status:**

- 10-second window mentioned ✅
- Edge Function `handle-disconnection` documented ✅
- **BUT:** Clock pause/resume logic during 10s window not fully detailed
- Missing: What happens if clock expires during disconnect?

**Location:** Section 7.4, Section 4.3

**Fix Required:** Clarify clock behavior during disconnect → reconnect → timeout flow

---

### 8. ⚠️ Move Number Validation

**PRD Requirement:**

- 10 moves per player (move_number 1-10)
- After 10 moves, player cannot make more moves

**Architecture Doc Status:**

- Schema: `move_number INTEGER NOT NULL` (1-10) ✅
- Zod validation: `z.number().int().min(1).max(10)` ✅
- **BUT:** Not documented in `executeMove` validation steps
- Missing: Check if player already made 10 moves

**Location:** Section 4.2, Section 14.2

**Fix Required:** Add move limit check to `executeMove` validation logic

---

### 9. ⚠️ Word Uniqueness - Implementation Detail Missing

**PRD Requirement:**

- Each word counts only once per player per match
- Re-forming same word yields 0 points

**Architecture Doc Status:**

- `claimed_words` table exists ✅
- `isNew` flag in `FoundWord` ✅
- Scorer filters `newWords` ✅
- **BUT:** Not clear how claimed_words table is updated in `executeMove`

**Location:** Section 4.2 (executeMove), Section 5.1 (claimed_words table)

**Fix Required:** Add step to `executeMove` logic showing claimed_words table update

---

### 10. ⚠️ Board Generation Failure Handling

**PRD Requirement:**

- Retry with new seed if generation fails
- After 3 failed attempts, cancel match

**Architecture Doc Status:**

- Retry mentioned: "Up to 3 attempts" ✅
- **BUT:** Not documented what happens after 3 failures
- Missing: Match cancellation logic

**Location:** Section 4.2 (generateBoard), Section 6.1

**Fix Required:** Document match cancellation flow after 3 board generation failures

---

## Minor Issues / Clarifications Needed

### 11. ⚠️ Data Flow Diagram - Outdated

**Section 2.3** shows "Supabase Backend" as central node, but architecture uses:

- Server Actions (Vercel) for most operations
- Supabase for database/realtime only

**Fix:** Update diagram labels to show Server Actions → Supabase DB

---

### 12. ⚠️ Scoring Formula - Verification Needed

**PRD Formula:**

```txt
Turn Score = Σ(Base Word Scores) + Σ(Length Bonuses) + Multi-Word Combo Bonus
- Length Bonus: (word_length − 2) × 5 per word
- 2 words → +2
- 3 words → +5
- 4+ words → +7 + (n−4)
```

**Architecture Implementation:**

- Matches PRD ✅
- Formula correct in code ✅

**Status:** ✅ Verified correct

---

### 13. ⚠️ Simultaneous Move Conflict Resolution

**PRD:** If both players move simultaneously in initial phase, random decision

**Architecture:**

- Mentions 409 Conflict for simultaneous moves
- Database transaction ensures one executes
- **Missing:** Explicit "random" tie-breaker mentioned in PRD

**Fix:** Document random tie-breaker logic for simultaneous first moves

---

### 14. ⚠️ Clock Increment - Verification

**PRD:** +3 seconds after each move

**Architecture:**

- `time_increment_seconds INTEGER DEFAULT 3` ✅
- Logic: `newClock = remainingTime + 3` ✅

**Status:** ✅ Verified correct

---

## Summary

### Critical (Must Fix):h

1. Architecture diagram showing wrong server functions
2. Missing move counter UI documentation
3. Frozen tiles lockup check missing from move execution flow
4. Game end conditions incomplete

### Medium Priority (Should Fix)

5. Score delta popup animation details
6. Reconnection clock behavior clarification
7. Move limit validation in executeMove
8. Claimed words table update in move flow
9. Board generation failure handling

### Minor (Nice to Have)

10. Data flow diagram labels
11. Simultaneous move random tie-breaker

---

## Action Items

1. **Update Section 2.1 diagram** - Replace Edge Functions with Server Actions
2. **Add move counter** to UI/component sections
3. **Enhance Section 10** - Simultaneous phase clock mechanics
4. **Update executeMove logic** - Add lockup check, move limit, claimed_words update
5. **Add game end conditions section** - Document all 4 scenarios
6. **Clarify reconnection** - Clock behavior during 10s window
7. **Document board generation** - Match cancellation after 3 failures

---

**Next Steps:**

- Review this document with team
- Prioritize fixes
- Update technical_architecture.md
- Re-verify against PRD
