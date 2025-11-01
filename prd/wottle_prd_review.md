# Wottle PRD Review - Critical Issues & Recommendations

This document identifies inconsistencies, missing requirements, and clarifications needed before implementation.

## 🔴 CRITICAL INCONSISTENCIES

### 1. Time Increment Discrepancy
**Issue:** The ideation document specifies **+2 seconds** per move, but the PRD specifies **+3 seconds**.

- **Ideation (line 47):** "On each completed move, two seconds are added to the remaining time"
- **PRD (line 24):** "Each player has 5:00 minutes of base time, with a **+3 second** increment"

**Recommendation:** Decide on one value. For 5+3 chess timing, +3 seconds is standard. Update ideation OR confirm +2 seconds is intentional for MVP.

### 2. Length Bonus Formula Discrepancy
**Issue:** Different formulas between documents.

- **Ideation (line 62):** "Add +(word length – 2) per new word, i.e. +1 for 3‑letter, +5 for 7‑letter"
- **PRD (line 55):** "(word_length − 2) × 5 points per word" (would give +5 for 3-letter, +25 for 7-letter)

**Recommendation:** These are fundamentally different. PRD version is 5× higher. Clarify intended formula.

### 3. Multi-Word Bonus Discrepancy
**Issue:** Different bonus structure.

- **Ideation (line 63):** "+2 for 2 words, +5 for 3+ words, +7 for 4+ words etc."
- **PRD (lines 57-60):** 
  - 2 words → +2
  - 3 words → +5
  - 4+ words → +7 + (n−4)

**Recommendation:** PRD adds progressive bonus for 4+ words (e.g., 5 words = +8, 6 words = +9). Confirm if ideation meant "etc." to include progression or if PRD should match ideation exactly.

### 4. Letter Distribution Logic Conflict
**Issue:** Conflicting statements about distribution method.

- **Ideation (line 38):** Mentions "weighted distribution of the scoring" but sentence is contradictory ("letters that score the lowest appear most often and the once that score the highest appear most often")
- **PRD (line 9):** "Letters are placed according to their frequency in the language (not by point value)"

**Recommendation:** PRD approach (language frequency) is clearer and makes more sense. Ensure ideation is understood correctly - low-value letters appearing more often makes sense.

### 5. Word Search Scope Ambiguity
**Issue:** Unclear whether word detection scans entire grid or just swapped positions.

- **Ideation (line 61):** "all leters in that have been found in the whole grid by the letter swap"
- **PRD (line 15):** "checks all 8 directions from the swapped positions"

**Recommendation:** PRD approach (from swapped positions only) is more logical and performant. However, if ideation meant "entire grid," this is a significant gameplay difference. Clarify intent.

### 6. Starting Player Contradiction
**Issue:** Ideation has contradictory statements about who starts.

- **Ideation (line 14):** "The player with white starts the game by making a move, like in chess"
- **Ideation (line 42):** "Both players can make the first move as soon the game starts"
- **PRD (line 24):** Matches the simultaneous start approach

**Recommendation:** PRD is correct - simultaneous first move. Remove the "white starts" statement from ideation or clarify it's just about who gets "white" color assignment.

## 🟡 MISSING REQUIREMENTS FROM IDEATION

### 7. Timer Visual Feedback
**Missing from PRD:** Timer color indication during active turn.

- **Ideation (line 54):** "timer is green when it is actively counting down and neutral color otherwise"
- **PRD:** No mention of color coding for active timer

**Recommendation:** Add to Section 7.2 (Visual Feedback) or Section 1.4 (Turn Structure).

### 8. Timer Stops on First Tile Selection
**Missing from PRD:** Precise timer behavior when selecting first tile.

- **Ideation (line 55):** "The player's timer counts down as soon as it is their turn to make a move and stops when they click/tap on the first tile"
- **PRD (line 26):** Only mentions clock pauses "when a move is made" but doesn't specify if this is after swap completion or first tile selection

**Recommendation:** Clarify in Section 1.4 whether timer pauses on first tile selection or only after swap completion.

### 9. Initial Tile Color
**Missing from PRD:** Initial board appearance specification.

- **Ideation (line 35):** "256 light-grey letter tiles"
- **PRD:** No mention of initial tile color/appearance

**Recommendation:** Add to Section 1.1 or Section 7.2.

### 10. User Registration & Authentication Flow
**Missing from PRD:** Detailed user management flow.

- **Ideation (lines 97-103):** Detailed lobby, invitation, and pairing system
- **PRD (Section 3.1):** Mentions modes but lacks detail on:
  - User registration/username creation
  - Landing page flow
  - Lobby display of other users
  - Direct invitation mechanics (clicking on player name)
  - "Start a game" button and immediate pairing logic

**Recommendation:** Expand Section 3.1 to include complete user flow from landing page through matchmaking.

### 11. Missing Section Number
**Issue:** Section numbering jumps from 7 to 9.

- **PRD:** Section 7 (UI/UX), then Section 9 (Non-Functional Requirements)
- Missing Section 8

**Recommendation:** Either add Section 8 or renumber Section 9 to Section 8.

## 🟠 INTERNAL PRD INCONSISTENCIES

### 12. Next.js Version Specification
**Inconsistency:** Different Next.js versions mentioned.

- **PRD (line 117):** "Next.js 16 (React)"
- Need to verify if this is intentional or should be updated

### 13. Word List File Reference
**Issue:** Ideation references wrong file for word list.

- **Ideation (line 93):** References `word_list_is_nouns.ts` in `letter_scoring_values_is.ts` file path
- Should reference `word_list_is_nouns.ts` directly

**Recommendation:** Fix reference in ideation (separate issue).

## 🔵 CLARIFICATIONS NEEDED

### 14. Word Validation Scope After Move
**Unclear:** Does word detection scan entire board or only from swap location?

- PRD implies scanning from swapped positions in 8 directions
- Should clarify if this means:
  a) Only words passing through/swapped tiles are checked, OR
  b) All words formed anywhere on the board that include the swapped tiles

**Recommendation:** Clarify in Section 1.2 or 1.3.

### 15. Opponent Using Frozen Tiles
**Unclear:** Can opponent use opponent's frozen tiles in word formation?

- **PRD (line 36):** "Opponent cannot form new words that use opponent's frozen tiles"
- **PRD (line 37):** "Player can use own frozen tiles to extend new words"

**Clarification:** Confirm this is correct - opponent's frozen tiles cannot be used at all, even if they happen to align with new word formation?

### 16. Game End When Time Expires
**Unclear:** What happens if both players run out of time mid-game?

- **PRD (line 44):** "Time expires for both players"
- **Ideation (line 87):** Incomplete sentence about time expiration

**Recommendation:** Clarify end-game logic when both clocks expire before 10 moves.

### 17. Move Counter Display
**Missing:** PRD shows "M7" in UI mockup (line 148) but doesn't specify this feature.

**Recommendation:** Add specification for move counter display in Section 7.1 or 7.2.

### 18. Simultaneous Move Resolution
**Unclear:** When both players make first move simultaneously, PRD mentions random resolution. What about subsequent simultaneous moves during game?

**Recommendation:** Clarify if simultaneous moves are possible after first move, or if turn-based structure prevents this.

## 📝 RECOMMENDED ADDITIONS

### 19. Error Handling & Edge Cases
**Missing:** 
- What happens if player disconnects?
- Invalid swap attempts (both tiles frozen, same tile selected twice)
- Server error during move validation

**Recommendation:** Add Section 11: Error Handling & Edge Cases.

### 20. Accessibility Requirements
**Missing:** Color contrast, keyboard navigation, screen reader support.

**Recommendation:** Add to Section 7 or create accessibility subsection.

### 21. Animation Timing Details
**Partial:** PRD mentions animation duration (~150–250ms) but doesn't specify:
- Word highlight duration
- Score delta popup duration/behavior
- Invalid swap feedback timing

**Recommendation:** Expand Section 7.2 with timing specifications.

### 22. Mobile-Specific UX
**Missing:** Mobile layout, touch interactions beyond basic tap.

**Recommendation:** Add mobile layout mockup to Section 7.1, expand Section 1.3 with mobile-specific controls.

## ✅ SUMMARY OF REQUIRED FIXES

**Priority 1 (Critical - Block Implementation):**
1. Resolve time increment (+2 vs +3 seconds)
2. Resolve length bonus formula (×1 vs ×5)
3. Clarify word search scope (entire grid vs swap area)
4. Fix section numbering (Section 8 missing)

**Priority 2 (Important - UX/Clarity):**
5. Add timer visual feedback (green when active)
6. Clarify timer behavior on first tile selection
7. Expand user registration/lobby flow
8. Add initial tile color specification
9. Clarify game end conditions for time expiration

**Priority 3 (Nice to Have):**
10. Clarify multi-word bonus progression
11. Add move counter specification
12. Add error handling section
13. Expand mobile UX details

