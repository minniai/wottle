# Wottle: Game Design PRD (MVP → v1)

## Executive Summary

Wottle is a competitive 2-player real-time word game combining strategic grid manipulation with word formation. Players swap two letters per turn on a 16x16 grid to form words across 8 directions, claiming territory through "frozen tiles" while managing chess-style time controls.

The MVP targets the competitive word game market with unique simultaneous-turn mechanics and Icelandic language focus, positioning between traditional async word games (Words with Friends) and real-time strategy games.

**Core Innovation:** Territory-claiming frozen tile mechanic creates spatial strategy beyond pure word-finding, while simultaneous first-move capability and chess clocks inject urgency into a traditionally leisurely genre.

**Target Market:** Competitive puzzle gamers aged 18-34, Icelandic language speakers, chess players seeking word game alternatives.

**Success Hinges On:** Fair resolution of simultaneous moves, intuitive frozen tile visualization, sub-50ms word validation, and matchmaking that maintains player engagement despite narrow multiplayer windows.

--- 

## Product Vision & Strategy

**Vision.** Make head-to-head word play feel like a speed-chess duel: tense, fair, and endlessly replayable. Wottle blends the pattern-seeking joy of word-search with the tactical brinkmanship of chess clocks.

**Target outcomes.**

* **Retention:** Players return because every board is different and skill matters.
* **Fairness:** Clear, deterministic rules; low RNG tilt; transparent scoring.
* **Speed to market:** Ship a polished MVP that stands on its own, then iterate with live data.

**Core one-liner.**
*Wottle is a 2-player, real-time word battle on a 16×16 letter grid. Players alternate swapping two tiles to reveal dictionary words in any straight line, racing the clock for the highest score.* 

---

## Game Overview & Core Mechanics

### High-Level Description

**Genre:** Competitive multiplayer word puzzle with territory control  
**Platform:** Web-based (desktop + mobile responsive)  
**Session Length:** 10-20 minutes per match  
**Players:** Exactly 2 (1v1)  
**Dictionary:** ~18,000 Icelandic nouns (MVP); expandable to other languages

### Personas

* **The Duelist.** Enjoys speed and rating ladders, expects fairness and instant pairing.
* **The Wordie.** Loves language and pattern recognition; appreciates post-game insights.
* **The Newcomer.** Needs rules clarity, guided first game, and practice vs. bot.

### First-time flow

* Landing → “Play Now” (guest name allowed) → quick tutorial (30–45s) → instant pairing or bot.
* Crisp visual hierarchy: whose move, clocks, score delta per move, remaining moves.
* Color-safe highlighting for discovered words (WCAG AA contrast).


### Core Gameplay Loop

1. See board state and remaining time/moves.
2. **Select two tiles** (or drag) to swap.
3. Animation (≤180ms) confirms swap; word(s) discovered are highlighted and *claimed*.
4. Score update pops (e.g., “+18 (word) +3 len +2 multi”).
5. Tiles from discovered words **freeze** (immovable). Shared letters show dual tint.
6. Turn passes; opponent’s clock activates. 

**Setup Phase:**
1. 16x16 grid populated with weighted-random letter distribution
2. Both players assigned unique colors
3. Chess clock initialized (5 minutes per player)
4. Simultaneous game start

**Turn Structure (Per Player):**
1. **Action Phase** (within time limit):
   - Select two letters anywhere on grid
   - Swap their positions
   - System validates all words formed in 8 directions
   
2. **Resolution Phase** (automatic):
   - Server validates words (minimum 3 letters)
   - Calculate score: letter values + length bonus + multi-word bonus
   - Freeze tiles used in valid words (mark in player color)
   - Add 2-second time bonus to player's clock
   - Switch active turn

3. **Endgame:**
   - After 10 moves per player (20 total turns)
   - Player with highest cumulative score wins
   - Tiebreaker: Most frozen tiles claimed

## Rules & Time Controls

### Turn order and clocks (MVP)

* **White moves first**; only the *active* player’s clock counts down. 5:00 per side; **+2s** increment added **on move commit** (not on selection). 
* If a player flags (time ≤ 0) *before* completing 10 moves, opponent may still use their remaining time to finish their own 10 moves; final result by score. (Kept from ideation; we’ll A/B alternative: game ends on flag.) 

> **Change vs. ideation:** Remove “both players’ timers count at start” for clarity and to match player expectations of turn-based chess-style timing. 

### Move definition

* A move is a **swap of two tiles** (adjacent or non-adjacent; MVP allows any two).
* The swap is atomic; on commit, server finds new words (see 4.3).

### Word Validation Rules

* Straight lines only: 8 compass directions; **no wrap**. Minimum length: **3**.
* Case-insensitive; diacritics respected; language-specific letters (e.g., ð, þ, æ) are distinct.
* A word scores **once per match** per player; re-forming the same word by future swaps yields no additional base word score (prevents farm exploits).

**Valid Words Must:**
- Minimum 3 letters long
- Exist in official dictionary
- Form continuous path in one of 8 directions (horizontal, vertical, diagonal - both orientations)
- Use contiguous, non-frozen tiles (own frozen tiles can be incorporated)

## Scoring (precise)

**Scoring Formula:**
```
Base Score = Σ(letter values in word)
Length Bonus = (word_length - 3) × 5 points
Multi-Word Bonus = (words_formed - 1) × 10 points
Turn Score = Σ(Base + Length Bonus) + Multi-Word Bonus
```
**Per move, score = Σ(Base word score for each *newly discovered* word) + Σ(Length bonus) + Multi-word combo bonus.** 

* **Base word score:** sum of letter values (Scrabble-like). (Icelandic letter values come from the provided scoring file; we will store them in DB and version them.) 
* **Length bonus (per new word):** `max(0, word_len - 2)` (so +1 for 3-letter; +5 for 7-letter; etc.). 
* **Multi-word combo bonus (per move):**

  * 1 word → +0
  * 2 words → +2
  * 3 words → +5
  * 4+ words → `+7 + (n-4)` (linear tail to reward larger combos while capping runaway). (Ideation gave examples but not a full function; this makes it explicit.) 
* **Shared letters:** If two new words discovered this move overlap, both count fully once; frozen letter tiles can contribute to new words later, but base word scores never double-count the *same word string* for the same player.


## Tile Claiming & Freezing (MVP)

* Tiles in newly discovered words become **frozen**: they cannot be selected for future swaps by *either* player. Overlaps stay visible and share ownership tint. 
* **Safeguards (MVP):**

  * Ensure at least **K movable tiles** remain after any move (server rejects swaps that would push below K=24 by default).
  * Guarantee seed words are not fully locked before both players’ turn 4 (generator constraint).
* **v1+ options (if late-game stagnates):** a one-time “shuffle two unfrozen tiles anywhere”; or “thaw one tile” power (ranked off, casual on).

### Frozen Tile Mechanic

**Territory Claiming:**
- Tiles used in validated words freeze permanently
- Frozen tiles marked with player's color overlay
- Opponents **cannot** use frozen tiles in new words
- Player **can** incorporate their own frozen tiles in longer words
- Frozen tiles remain for entire game duration

**Strategic Implications:**
- Creates defensive positioning (block opponent's word paths)
- Enables offensive territory expansion
- Introduces spatial awareness beyond word-finding
- Rewards long-term board control planning

### End of game

* After **10 moves per player**; or after both clocks hit zero; or resignation. Highest score wins. 

## Letter Distribution & Board Generation

**Problem:** “Weighted by score” makes rare letters more frequent if misapplied. We must separate *frequency* (for generation) from *value* (for scoring).

**MVP generation policy**

* Use **language frequency** weights (derived from the dictionary corpus) to sample letters for the 16×16 board.
* Guarantee all in-alphabet letters appear **≥ once** (if required by design), but do not force uniformity if it harms naturalness. 
* **Seeding for solvability:** insert at least **S seed words** (S=6 default) invisibly by arranging letters so they *can* be formed by ≤2 swaps (not necessarily present at t=0). (Tech section 13.)
* **Reproducibility:** board is generated by **seed = match_id**, enabling replays.

---
## Modes & Matchmaking

**MVP**

* **Unrated Quick Play** (vs player or bot).
* **Rated** (Elo-like): instant pairing within ±200, expanding by 50 every 10s.
* **Direct Challenge** via lobby invitation. 

**v1**

* **Practice vs Bot** (simple heuristic: maximize length bonus; avoid over-freezing).
* **Custom rooms** (variants; time control presets).

---

## Social & Live Ops

* **Usernames**, avatar color themes, presence (online/playing).
* **Spectator** (v1): delayed by 1 move to avoid stream-sniping.
* **Replays** (seed + move list).
* **Moderation:** Profanity filter for names; report/mute.

---

## Anti-Cheat & Fair Play

* Server-authoritative validation of swaps, clock, claims, scoring.
* Rate-limit move submissions; discard late/dup packets.
* Optionally obfuscate board transport (not security, but reduces trivial memory-scan cheats).
* Detect suspicious pause patterns, repeated perfect play, and dictionary probing via analytics.

## Accessibility & Internationalization

* Color-blind friendly palettes; icon + color state for claimed tiles.
* Keyboard support (arrow navigation, Enter to select, Space to confirm).
* Localization pipeline (Icelandic/English to start; dictionaries are language-specific).

---

## Success Metrics (MVP → v1)

* **DAU / New user day-0 conversion.**
* **Median queue time (p50 < 10s).**
* **G1 Retention (Day-1 ≥ 25% for organic).**
* **Avg. session length** (target ~6–10 min).
* **Fairness:** win rate by seat (white/black) within 49–51%.
* **Stagnation rate:** matches with <4 total words by turn 6 < 5%.
* **Abandon rate:** resignations/flags before move 4 < 8%.


## Summary of the Provided Ideation (with critical notes)

Your ideation specifies: 16×16 board initialized with weighted random letters; words valid in 8 straight-line directions (no wrap); Scrabble-like letter scores; chess-style clocks; 10 moves per player with +2s increment; discovered word tiles freeze; overlapping words can be shared and color-marked; Icelandic nouns dictionary for MVP; Next.js/Tailwind FE and Supabase BE. 

**Critical observations and improvements suggested throughout this PRD:**

1. **Letter distribution “weighted by score”** is likely *backwards* for balance: low-value letters tend to be common because they’re common in the language, not because they’re low-value. Use *language frequency* (per dictionary) to drive generation and keep Scrabble-style scores for valuation. (Design section 6.)
2. **Simultaneous initial countdown** is confusing; use a clear *who-to-move* state and a standard activation of the active player’s clock only. (Design section 4.)
3. **Tile freezing** after discovery could create late-game lockups. We keep it, but add safeguards (e.g., minimum movable tiles; smart seeding; optional late-game relief for v1). (Design section 5.)
4. **Bonuses** (word length and multi-word) need precise, monotonic formulas to prevent exploits. (Design section 7.)
5. **Board solvability** at start is not guaranteed by random fill; add seeding to guarantee *at least N* latent words and prevent dead boards. (Tech section 13.)
6. **Real-time correctness**: make servers authoritative for move legality, scoring, freezes, and time control to prevent desyncs/cheats. (Tech section 10.)
## Critical Analysis & Design Recommendations

### Issue 1: Simultaneous First Move Conflicts

**Problem:** Both players can submit moves simultaneously, potentially targeting the same tile positions. Current specification lacks conflict resolution definition.

**Analysis:** From research on Humankind and Civilization 6, simultaneous turn systems suffer from "click race" problems where faster reactions trump strategy. Real-time simultaneous play creates RTS-like pressure inappropriate for word games.

**Recommended Solution - Planning Phase Model:**

**Turn Structure (Revised):**
1. **Planning Phase (60 seconds):** Both players submit intended swaps privately
2. **Resolution Phase (5-10 seconds):** 
   - Server checks for conflicts
   - Apply priority system: Randomized initiative per turn, alternates each round
   - Execute non-conflicting moves immediately
   - For tile conflicts: Initiative winner's move executes, loser's move fails with clear feedback
   - Display resolution with animations showing both moves
3. **Review Phase (3-5 seconds):** Players see results before next planning phase

**Benefits:**
- Eliminates click-race mechanics
- Pure strategy focus (no reflexes needed)
- Fair conflict resolution through alternating initiative
- Maintains real-time feel without RTS pressure

### Issue 2: 16x16 Grid Overwhelming Complexity

**Problem:** 256 tile positions with 8-directional word formation creates cognitive overload, especially mobile.

**Recommendations:**

**Mobile Optimization:**
- Pinch-to-zoom (1x to 3x)
- Pan controls with momentum scrolling
- Mini-map corner overlay
- Minimum 32px touch targets
- Two-tap pattern (select, then confirm)

**Cognitive Load Reduction:**
- Active area highlighting (fade distant tiles)
- Valid move preview on selection
- Heatmap toggle showing control density
- Progressive tutorial (8x8 → 12x12 → 16x16)

### Issue 3: Frozen Tile Visibility

**Recommended Visual Design:**

**Multi-Modal Indicators:**
- Color overlay (40% opacity player color)
- 3px solid border in player color
- Lock icon overlay (optional)
- Diagonal line pattern (colorblind mode)
- Shimmer animation on freeze moment

**Error Feedback:**
- Tile shake (100ms)
- Red border flash
- Tooltip: "Frozen by [Player]"
- Audio cue + haptic feedback

### Issue 4: Game Length Balance

**Analysis:** 10 moves × 60 sec average = 10 minutes base + 5 minutes clock time = 12-15 minute sessions

**Recommendation:** Keep 10 moves for MVP (ideal casual session length). Test 15-move "Extended" variant post-launch.

### Issue 5: Letter Distribution

**Recommended Icelandic Distribution:**
```
High frequency (30%): A, R, N, I, S
Medium (50%): L, T, U, E, D, G, K, M, F, V
Low (15%): Ö, Ó, Á, Y, Ð, Þ, Æ
Rare (5%): É, Í, Ú, Ý

Vowel ratio: 40% vowels, 60% consonants
Grid validation: Minimum 50 valid words must be findable
```

### Issue 6: Chess Clock Timing

**Current:** 5+2 (5 minutes + 2 second increment)

**Recommendation:** Increase to **5+3** (standard Fischer). 2-second increment barely covers network latency. After 10 moves: 5:30 remaining vs. 5:20.

**Implementation:** Server-authoritative time (not client clocks). Forgive up to 1 second lag per move.

---

## User Stories & Use Cases

### Primary Personas

**Competitive Chris (Age 24)**
- Chess player (1600 rating), strategy gamer
- Wants: Ranked ladder, replay analysis, tournaments
- Frustrations: Slow async games, pay-to-win

**Casual Kata (Age 32)**
- Words with Friends player, native Icelandic speaker
- Wants: Social play, daily challenges, gradual improvement
- Frustrations: Toxic players, complex interfaces, time pressure

**Icelandic Íris (Age 28)**
- Marketing professional, cultural pride in language
- Wants: Icelandic community connection, language celebration
- Frustrations: English-dominant gaming platforms

### Core User Stories

**As a new player**, I want quick account creation (OAuth + email) so I can start playing within 2 minutes

**As a player**, I want valid swap destinations highlighted so I don't waste moves on invalid actions

**As a competitive player**, I want to see my rating history graph so I track skill improvement

**As a strategic player**, I want opponent's frozen tiles clearly visible so I plan counter-strategies

**As a mobile player**, I want zoom/pan on the grid so I see the full 16x16 board on small screens

**As an improving player**, I want to review completed games so I analyze mistakes

**As a friend group**, I want private lobbies so we can play custom tournaments

---

## Detailed Feature Specifications

### F1: Account System & Authentication

**Priority:** P0 (MVP Essential) | **Effort:** Medium (2-3 weeks)

**Requirements:**
- OAuth 2.0: Google, Facebook, Apple Sign-In
- Email/password with verification
- Guest accounts (unranked, 10 games max)
- Profile: username, display name, avatar, bio, country

**Technical Stack:**
- Auth0 or Firebase Authentication
- PostgreSQL users table
- Redis session management
- S3 avatar storage

### F2: Matchmaking System

**Priority:** P0 (MVP) | **Effort:** High (3-4 weeks)

**Modes:**
1. **Quick Match:** Auto-pairing by ELO (±100 points, expand +25 every 15 sec)
2. **Ranked:** Standard 5+3 time control, strict pairing
3. **Unranked/Casual:** Wider range (±300), any time control
4. **Friend Challenge:** Direct invitation, custom rules

**Algorithm:**
```python
def find_match(player, mode):
    rating = player.rating
    range_initial = 100
    time_waited = 0
    
    while time_waited < 120:  # 2 min max
        range_current = min(100 + (time_waited // 15) * 25, 250)
        opponents = query_queue(rating ± range_current, mode)
        if opponents:
            return select_closest_rating(opponents)
        time_waited += 5
        await asyncio.sleep(5)
    return None  # Offer fallback
```

**Tech:** Redis sorted sets, WebSocket notifications, Node.js matchmaking service

### F3: Game Engine & Word Validation

**Priority:** P0 (MVP) | **Effort:** Very High (4-5 weeks)

**Grid Generation:**
- Weighted-random letter distribution (Icelandic frequency)
- Validation: Minimum 50 valid words, 10 words of 5+ letters
- Re-generate if criteria not met (max 10 attempts)

**Word Validation:**

**Client-Side (Immediate Feedback):**
- Trie data structure (1-2MB, 18K words)
- O(L) lookup (L = word length)
- IndexedDB caching

**Server-Side (Authoritative):**
- Same Trie, all moves validated
- Prevents cheating
- Rate limiting: 1 move/second max

**Trie Implementation:**
```javascript
class Trie {
  constructor() {
    this.root = new Map();  // Unicode support
  }
  
  insert(word) {
    word = word.normalize('NFC').toLocaleLowerCase('is');
    let node = this.root;
    for (const char of word) {
      if (!node.has(char)) node.set(char, new Map());
      node = node.get(char);
    }
    node.set('$', true);  // End marker
  }
  
  search(word) {
    word = word.normalize('NFC').toLocaleLowerCase('is');
    let node = this.root;
    for (const char of word) {
      if (!node.has(char)) return false;
      node = node.get(char);
    }
    return node.has('$');
  }
}
```

**Performance Targets:**
- Single word validation: <1ms
- Full grid scan: <50ms
- Client dictionary load: <2s first time, <500ms cached

**Icelandic Unicode:** A-Z + Á, Ð, É, Í, Ó, Ú, Ý, Þ, Æ, Ö (NFC normalization required)

### F4: Chess Clock System

**Priority:** P0 (MVP) | **Effort:** Medium (2 weeks)

**Time Control:** 5+3 (5 minutes + 3 second increment per move)

**Server-Authoritative Implementation:**
```javascript
class ChessClock {
  constructor(initialTime, increment) {
    this.white = initialTime;  // milliseconds
    this.black = initialTime;
    this.increment = increment;
    this.currentPlayer = 'white';
    this.lastMoveTime = Date.now();
  }
  
  makeMove(player) {
    const now = Date.now();
    const elapsed = now - this.lastMoveTime;
    
    if (this.currentPlayer === 'white') {
      this.white -= elapsed;
      this.white += this.increment;  // Add AFTER deducting
    } else {
      this.black -= elapsed;
      this.black += this.increment;
    }
    
    // Check timeout
    if (this.white <= 0) return { result: 'black_wins_timeout' };
    if (this.black <= 0) return { result: 'white_wins_timeout' };
    
    this.currentPlayer = (player === 'white') ? 'black' : 'white';
    this.lastMoveTime = now;
    
    return { whiteTime: this.white, blackTime: this.black };
  }
}
```

**Client Rendering:** Update every 100ms, adjust for network latency

**Lag Compensation:** Server forgives up to 1 second per move

**UI:** Color-coded clocks (green >2min, yellow <2min, red <30sec), pulsing when <10sec

### F5: Frozen Tile & Scoring System

**Priority:** P0 (MVP) | **Effort:** Medium (2-3 weeks)

**Letter Values (Icelandic Scrabble-style):**
```javascript
const LETTER_VALUES = {
  'A': 1, 'E': 1, 'I': 1, 'N': 1, 'R': 1, 'S': 1, 'T': 1, 'U': 1,  // Common
  'D': 2, 'G': 2, 'L': 2, 'K': 3, 'M': 3, 'O': 3,  // Medium
  'F': 4, 'H': 4, 'V': 4, 'Á': 4, 'Y': 4,  // Uncommon
  'B': 6, 'P': 6, 'Ð': 6, 'É': 7, 'Æ': 7,  // Rare
  'Þ': 8, 'Í': 8, 'Ó': 8, 'Ú': 9, 'Ý': 9, 'Ö': 10  // Very rare
};
```

**Scoring Formula:**
```javascript
function calculateScore(words, letterValues) {
  let totalScore = 0;
  
  for (const word of words) {
    let baseScore = 0;
    for (const char of word) {
      baseScore += letterValues[char] || 1;
    }
    const lengthBonus = Math.max(0, word.length - 3) * 5;
    totalScore += baseScore + lengthBonus;
  }
  
  const multiWordBonus = Math.max(0, words.length - 1) * 10;
  return totalScore + multiWordBonus;
}
```

**Frozen Tile Visual:**
- 40% opacity color overlay
- 3px solid border in player color
- Diagonal line pattern (colorblind mode)
- 300ms glow animation on freeze
- Hover shows: "Frozen by [Player] - Word: [WORD]"

### F6: UI/UX Implementation

**Priority:** P0 (MVP) | **Effort:** Very High (5-6 weeks)

**Desktop Layout (1920x1080):**
```
┌────────────────────────────────────────────┐
│  WOTTLE    [Settings] [Profile] [Logout]  │
├────────────┬──────────────────┬────────────┤
│ Player 2   │                  │  Game Info │
│ Score: 340 │   16x16 GRID     │  Move 7/10 │
│ ⏱️  04:23   │  (Interactive)   │  [Undo]    │
│ [History]  │                  │  [Submit]  │
├────────────┤                  ├────────────┤
│ Player 1   │                  │  Frozen:   │
│ Score: 385 │                  │  P1: 18    │
│ ⏱️  04:47   │                  │  P2: 14    │
│ Selected:  │                  │  Last: +29 │
│ Tiles: A,R │                  │            │
└────────────┴──────────────────┴────────────┘
```

**Mobile Layout (375x667):**
```
┌─────────────────────┐
│ Opp: 340  [04:23]   │ ← 50px
├─────────────────────┤
│    16x16 GRID       │ ← 500px (zoom/pan)
├─────────────────────┤
│ You: 385  [04:47]   │ ← 50px
├─────────────────────┤
│ [A][R] [Undo] [✓]   │ ← 67px controls
└─────────────────────┘
```

**Interactions:**
- **Desktop:** Click tile 1, click tile 2, click Submit
- **Mobile:** Tap tile 1, tap tile 2, tap ✓; pinch to zoom, drag to pan

**Animations:** CSS transforms only, 250ms swaps, 60 FPS target

**Accessibility:**
- Keyboard navigation (Tab, Enter)
- Screen reader support
- High-contrast mode toggle
- Reduce motion option

---

## Technical Architecture

### System Architecture

**Recommended Stack:**
- **Frontend:** Svelte (best performance, smallest bundle)
- **Backend:** Node.js + Express + Socket.io
- **Database:** PostgreSQL (persistent) + Redis (active games)
- **Hosting:** AWS/GCP with auto-scaling
- **CDN:** CloudFront for static assets

**Architecture Diagram:**
```
[Clients] → [Load Balancer/Nginx] → [Game Servers 1-N]
                                          ↓
                                    [Redis Pub/Sub]
                                          ↓
                                    [PostgreSQL]
```

### 13.1 High-level


```
[Client (Next.js/TS/Tailwind)]
       |  WebSocket (Supabase Realtime) + HTTPS
       v
[API Layer: Supabase Functions (Edge) / RPC]
       |   (authoritative scoring/validation/time)
       v
[Postgres (Supabase)]
  - users, sessions, matches, moves
  - boards, tiles, letter_scores, dictionaries
  - ratings (Elo/Glicko), invitations, queues
  - analytics events (BigQuery/Snowflake later)
```

**Frontend:** TypeScript, Next.js, Tailwind (per ideation). Keep the board and animations client-side; all **rules, scoring, and clocks** server-authoritative. 

**Backend:** Supabase Postgres + Functions + Realtime channels per match for state fan-out (or a thin Node/Cloudflare Worker if we outgrow Function limits). 

### Real-time & State

* **Match channel:** `match:{id}`.
* **Server tickless model:** state advances only on move events with timestamps; clock math performed server-side using the last server-acknowledged time.
* **Optimistic UI:** client animates swap; server confirmation updates canon state; on mismatch, client snaps to server (rare if validations are pre-checked).

### Data Model (outline)

* `users(id, username, created_at, rating, …)`
* `matches(id, seed, lang, status, created_at, white_id, black_id, time_ms, inc_ms)`
* `match_players(match_id, user_id, seat, time_left_ms, moves_done)`
* `boards(match_id, grid_16x16 char(1)[])` (or compact byte array)
* `letter_scores(lang, letter, value, version)`
* `dictionaries(lang, word, normalized, flags)` (indexed trie/GIN)
* `moves(id, match_id, ply, actor, pos_a, pos_b, found_words[], score_delta, ts)`
* `claims(match_id, word, path, tiles[])` (for replay/coloring)
* `ratings(user_id, rating, rd, last_match_at)`
* `invitations(from_user, to_user, status, expires_at)`
* `queue_entries(user_id, rating_snapshot, enqueued_at)`

### Dictionary & Scoring

* Import the provided Icelandic nouns (singular nominative) for MVP. Store as normalized uppercase with diacritics preserved; create GIN index on `word`. 
* Import letter scoring from the provided file into `letter_scores`. Version to allow future balance patches. 

### Word-find algorithm (per move)

* **Brute force is fine** for 16×16, but optimize:

  * Only scan lines passing through the two swapped tiles (8 rays × 2 origins).
  * For each ray, accumulate contiguous sequences including the swapped tile; check substrings length ≥ 3 that include at least one swapped tile (to ensure “newly formed”).
  * Lookups: O(1) set membership (hash) or trie.
* Complexity: tiny (<1 ms typical) with constrained scans; keep in a Supabase Function (Deno/TS) or a co-located service.

### Board generation with seeding

1. Fill 16×16 using **language frequencies**.
2. Reserve **S seed lines** (random directions/lengths 4–9) for words from dictionary; ensure each can be formed by ≤2 swaps from t=0 state.
3. Validate:

   * At least **M latent words** exist (M=20 default).
   * No more than **R rare-letter clusters** (R=2) to avoid unsolvable corners.
4. Re-roll if constraints fail; cap retries; log metrics for tuning.

### Time control & increments (server)

* Store `last_server_turn_ts`. On move:

  * `consumed = now - last_server_turn_ts`.
  * Deduct from active player's `time_left_ms`.
  * If `time_left_ms < 0`, set `flagged=true` and handle per rules.

### Security & Ops

* Supabase RLS for per-match rows.
* Functions validate user seat, turn, and cooldown (min 300ms between move requests to deter macros).
* Observability: structured logs, traces, per-move timings, and match health dashboard.
* CI/CD: PR checks, seed test suites, canary deploy of functions.

---

### Real-Time Communication

**Socket.io with Redis Adapter:**
```javascript
const io = require('socket.io')(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

io.adapter(createAdapter(pubClient, subClient));
```

**Key Events:**
- Client → Server: `join_queue`, `make_move`, `forfeit`
- Server → Client: `match_found`, `game_state`, `move_validated`, `game_over`

**State Synchronization:** Server-authoritative with client prediction for instant feedback

### Database Schema

**PostgreSQL Tables:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  elo_rating INTEGER DEFAULT 1200,
  games_played INTEGER DEFAULT 0,
  created_at TIMESTAMP
);

CREATE TABLE games (
  id UUID PRIMARY KEY,
  player_white_id UUID REFERENCES users(id),
  player_black_id UUID REFERENCES users(id),
  result VARCHAR(20),
  white_score INTEGER,
  black_score INTEGER,
  time_control VARCHAR(10),
  moves JSONB,
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE elo_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  game_id UUID REFERENCES games(id),
  old_rating INTEGER,
  new_rating INTEGER,
  changed_at TIMESTAMP
);
```

**Redis Data:**
```javascript
// Active game state (expires after completion)
redis.setex(`game:${gameId}`, 3600, JSON.stringify(gameState));

// Matchmaking queue (sorted set by rating)
redis.zadd('queue:ranked:5+3', playerRating, playerId);
```

### Scalability

**Horizontal Scaling:**
- Stateless game servers (state in Redis)
- Sticky sessions (load balancer)
- Redis pub/sub for cross-server coordination
- Auto-scaling on CPU >70% or connections >8k/server

**Scale Targets:**
- Small (β): <1,000 concurrent → 2 servers, ~$100/month
- Medium (launch): 10,000 concurrent → 6 servers, ~$500/month
- Large (success): 50,000 concurrent → 20 servers, ~$3,000/month

### Security

**Anti-Cheat:**
- Server-side validation of all moves
- Rate limiting (1 move/second max)
- Statistical analysis (detect impossible win rates)
- Separate pools for flagged accounts

**Additional Security:**
- TLS/SSL mandatory (wss://)
- JWT tokens (30-day refresh, 1-hour access)
- Rate limiting: 60 req/min per IP
- Input sanitization, parameterized queries
- CORS whitelisting

---
## UX Details & Visual Language

* **Board tiles:** clean sans serif glyphs; avoid excessive tint fill; use outline or corner pips to show claim color; ensure letters remain fully legible. 
* **Feedback:** Floating, short-lived (+800ms) score delta chips near discovered words; consolidated move summary under the clock.
* **Error states:** Clear reasons (e.g., “Swap rejected: would leave <24 movable tiles”).
* **Mobile:** One-handed swap (tap-tap), haptics on claim, safe thumb zones for clocks.

---

## Success Metrics & KPIs

### Success Metrics (MVP → v1)

* **DAU / New user day-0 conversion.**
* **Median queue time (p50 < 10s).**
* **G1 Retention (Day-1 ≥ 25% for organic).**
* **Avg. session length** (target ~6–10 min).
* **Fairness:** win rate by seat (white/black) within 49–51%.
* **Stagnation rate:** matches with <4 total words by turn 6 < 5%.
* **Abandon rate:** resignations/flags before move 4 < 8%.gg

### North Star Metric

**30-Day Retention Rate:** 6.5% target (puzzle game benchmark), 10%+ excellent

### Acquisition Metrics

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| New Registrations | 1,000 | 5,000 | 15,000 |
| DAU | 200 | 1,200 | 4,000 |
| MAU | 800 | 4,000 | 12,000 |

### Engagement Metrics

| Metric | Target | Excellent |
|--------|--------|-----------|
| **Day 1 Retention** | 30% | 40% |
| **Day 7 Retention** | 15% | 20% |
| **Day 30 Retention** | 6.5% | 10% |
| **Session Length** | 15 min | 20 min |
| **Sessions per DAU** | 2.0 | 3.0 |
| **Match Completion** | 85% | 90% |

### Multiplayer Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| Concurrent Users (Peak) | 100 | 50 min |
| Matchmaking Time | <90 sec | <120 sec |
| Games per Day | 400 | 200 min |
| Reconnection Success | 90% | 85% |

### Technical Performance

| Metric | Target | Alert |
|--------|--------|-------|
| Server Uptime | 99.5% | <99% |
| Latency | <100ms | >200ms |
| Word Validation | <50ms | >100ms |
| Page Load (FCP) | <2s | >3s |

### Tracking

**Tools:** Mixpanel (events), New Relic (performance), Sentry (errors)

**Critical Events:**
- `signup_completed`, `tutorial_completed`, `first_match_completed`
- `match_started`, `match_completed`, `match_abandoned`
- `friend_added`, `friend_challenge_sent`


---

## Implementation Roadmap

**MVP (6–8 weeks)**

* Core rules & timers; rated + unrated; direct challenge; bot (very simple); Icelandic nouns dictionary; Icelandic letter scores; analytics; basic anti-cheat; replays; seed reproducibility. 

**v1 (next 6–8 weeks)**

* Improved bot (beam search with heuristic); spectator (delayed); variants (shorter time controls); more dictionaries (EN verbs, EN Scrabble, themed sets); progression cosmetics; A/B on tile-freeze relief.

---

### Phase 0: Foundation (Weeks 1-4)
- Project scaffolding, CI/CD
- Database schema, authentication
- WebSocket infrastructure
- Trie implementation

### Phase 1: MVP Core (Weeks 5-12)
- **Weeks 5-6:** Game engine (grid generation, validation, scoring)
- **Weeks 7-8:** Multiplayer (Socket.io, chess clock, turn management)
- **Weeks 9-10:** Frontend UI (Svelte components, grid rendering)
- **Weeks 11-12:** Matchmaking, game over flow

**Deliverable:** Functional MVP - two players can complete matches

### Phase 2: Beta Testing (Weeks 13-16)
- Internal testing, bug triage
- Closed beta (20-50 users)
- Balance adjustments
- Performance optimization, load testing

**Deliverable:** Beta-ready with known issues resolved

### Phase 3: MVP Launch (Week 17)
- Production deployment
- Marketing push
- Monitor closely (72 hours)

**Success:** 500+ registrations first week, 30%+ Day 1 retention

### Phase 4: Post-Launch (Weeks 18-30)
- **Weeks 18-20:** Social features (friends, chat)
- **Weeks 21-24:** Replay system
- **Weeks 25-27:** Tournament system (Swiss format)
- **Weeks 28-30:** AI practice mode, daily challenges

---
## Test Plan

* **Unit:** scoring math, line scanning, freeze enforcement, clock arithmetic.
* **Property-based:** board generator always yields ≥M latent words and ≥K movable tiles after any legal move.
* **Load:** 1k concurrent matches; Realtime fan-out latency p95 < 150ms.
* **Fairness checks:** first-move advantage within tolerance; dictionary hit rate per language.

## 17) KPIs & Experiments

* **A/B:** freeze safeguard thresholds (K=16, 24, 32); multi-word bonus tail; time control presets (3+2 vs 5+2).
* **Tuning:** letter frequency weights → early discoverability vs. late-game depth.
* **Onboarding:** tutorial length (skippable vs mandatory) and its impact on first-match completion.


---

## Risk Analysis & Mitigation

* **Dead boards / stagnation** → seeding & K-movables safeguard; optional relief power in v1.
* **Dictionary disputes** (Icelandic morphology) → clear policy: nominative singular only for MVP; publish rules in-app; backlog declension-aware expansions.
* **Cheat clients** → server authoritativeness; detect automation patterns.
* **Realtime flakiness** → idempotent move API; graceful reconnection; session resume.


### Critical Risks

#### Risk 1: Insufficient Concurrent Players
**Impact:** High | **Probability:** 70%

**Symptoms:** Matchmaking >2 minutes, player abandonment, death spiral

**Mitigation:**
- Hybrid matchmaking (offer AI after 90 sec)
- Async mode option (turn-based)
- Scheduled "Happy Hours"
- Bot padding (sophisticated, undisclosed)
- Cross-region matching
- Coordinated launch marketing

**Success Metric:** <90 sec average matchmaking

---

#### Risk 2: Frozen Tile Confusion
**Impact:** High | **Probability:** 50%

**Symptoms:** Tutorial abandonment, negative reviews, support tickets

**Mitigation:**
- Forced interactive tutorial
- Progressive introduction (first 3 games without frozen tiles)
- Multiple visual indicators (color, border, icon, pattern)
- In-game tooltips (first 5 matches)
- Undo button (first 10 games)
- A/B test with/without mechanic

**Success Metric:** 70%+ tutorial completion, <10% frozen-tile support tickets

---

#### Risk 3: Poor Mobile Experience
**Impact:** High | **Probability:** 40%

**Symptoms:** Mobile bounce rate, low retention, "can't see tiles" reviews

**Mitigation:**
- Adaptive grid sizing
- Mandatory zoom/pan
- Two-tap pattern (prevent mis-taps)
- 44x44px touch targets
- Portrait-first design
- Test on iPhone SE, budget Android
- Progressive Web App

**Success Metric:** Mobile Day 1 retention within 10% of desktop

---

### Moderate Risks

#### Risk 4: Server Infrastructure Failure
**Impact:** Critical | **Probability:** 10%

**Mitigation:** Multi-AZ deployment, auto-scaling, health checks, database replication, monitoring

**RTO:** <15 minutes

---

#### Risk 5: Dictionary Quality Issues
**Impact:** High | **Probability:** 20%

**Mitigation:** Official Icelandic Scrabble dictionary, community suggestions, quarterly updates, admin panel

**Success Metric:** <5 word complaints per 1,000 games

---

### Low-Impact Risks

**Risk 6: Cheating** → Server-authoritative validation, rate limiting, statistical analysis

**Risk 7: Toxicity** → Chat opt-in only, profanity filter, report/block, temp bans

---

## Testing Strategy

### Test Pyramid
```
60% Unit Tests (Trie, validation, scoring, chess clock)
30% Integration Tests (API endpoints, WebSocket flows, database)
10% E2E Tests (Full game flows, matchmaking, critical paths)
```

### Unit Tests (80% coverage target)

**Critical Units:**
```javascript
// Trie
test('inserts and searches words correctly')
test('handles Icelandic unicode')
test('case insensitive search')

// Word Validator
test('finds horizontal/vertical/diagonal words')
test('respects frozen tile ownership')
test('rejects words <3 letters')

// Scoring
test('calculates base + length + multi-word bonuses')
test('handles edge cases (1 word, 10 words)')

// Chess Clock
test('deducts time correctly')
test('adds increment after move')
test('detects timeout')
```

### Integration Tests

**API Endpoints:**
```javascript
test('POST /auth/register creates user account')
test('POST /matchmaking/queue adds player to queue')
test('WebSocket connection established')
test('Game state updates broadcast to both players')
```

**Database:**
```javascript
test('User registration saves to PostgreSQL')
test('Game completion updates ELO ratings')
test('Active games stored in Redis expire after 1 hour')
```

### E2E Tests (Cypress/Playwright)

**Critical Flows:**
```javascript
test('New user can register, play tutorial, complete first match')
test('Ranked matchmaking finds opponent within 2 minutes')
test('Player can swap tiles and see score update')
test('Game ends correctly after 10 moves per player')
test('Frozen tiles prevent opponent moves')
```

### Load Testing (Artillery.io)

**Scenarios:**
```yaml
- 100 concurrent users
- 50 simultaneous matches
- Sustained for 10 minutes
- Target: <200ms p95 latency
```

### Manual Testing

**Devices:**
- iPhone 15, iPhone SE, iPhone 12
- Samsung Galaxy S24, Pixel 6, budget Android
- Desktop: Chrome, Safari, Firefox, Edge

**Focus Areas:**
- Mobile zoom/pan usability
- Frozen tile visibility (all colorblind modes)
- Matchmaking wait times (off-peak hours)
- Tutorial clarity (5+ non-technical users)

---

## Open Questions & Decisions

### To Resolve Before Development

**Q1: Simultaneous move conflict resolution**  
**Decision:** Implement planning phase model with alternating initiative. Validate in user testing.

**Q2: Starting player selection**  
**Decision:** Randomize who goes first, display "You have initiative this turn" banner.

**Q3: Undo functionality**  
**Decision:** Allow undo within 5 seconds of move submission, max 1 undo per game.

**Q4: Dictionary source**  
**Decision:** Use official Icelandic Scrabble dictionary if available, else compile from Árni Magnússon Institute word list + community validation.

**Q5: Spectator mode in MVP?**  
**Decision:** NO - post-launch feature (Phase 4). Too complex for MVP, limited immediate value.

**Q6: Voice chat?**  
**Decision:** NO - text chat only. Voice requires moderation complexity.

### To A/B Test in Beta

- Time controls: 3+2 vs. 5+3 vs. 10+5
- Match length: 10 moves vs. 15 moves
- Frozen tile introduction: Immediate vs. after 3 practice games
- Matchmaking range: ±100 vs. ±150 initial range
- Grid size: 16x16 vs. 12x12 (for mobile-only variant)

## Build Plan (MVP backlog)

1. **Data & tools:** Import dictionary + letter scores; seed analyzer; board generator.
2. **Realtime core:** Match lifecycle; channels; server move-resolve; clock engine.
3. **Client:** Board UI, selection/drag swap, highlighting, animations, score HUD.
4. **Matchmaking:** Unrated + rated queues; lobby invites.
5. **Persistence:** Replays; analytics events; crash-safe resumes.
6. **QA:** Unit + property tests; soak tests; device matrix; accessibility pass.
7. **Soft launch:** Iceland; collect telemetry; tune K, S, M; adjust letter weights.
8. **v1 enhancements:** Bot+, spectator, variants, more dictionaries.


## Implementation Notes & Pseudocode

### 20.1 Server move-resolve (TS/Deno sketch)

```ts
function resolveMove(matchId, playerId, a, b) {
  const match = loadMatch(matchId);
  assertTurn(match, playerId);
  applyClock(match); // server time math

  const board = loadBoard(matchId);
  if (wouldDropMovablesBelowK(board, a, b, K=24)) throw 'Swap rejected';

  swap(board, a, b);

  const newWords = findNewWords(board, [a,b], dict, minLen=3);
  const claims = wordsToClaims(newWords);
  freezeTiles(board, claims.tiles);

  const delta = scoreMove(newWords, letterScores, lenBonusFn, multiBonusFn);
  persist(board, claims, delta);
  advanceTurn(match, playerId, incrementMs=2000);

  return { delta, newWords, next: match.activeSeat };
}
```

### 20.2 Find words along rays

```ts
function findNewWords(board, swappedCells, dict) {
  const rays = directions8.flatMap(d => swappedCells.map(c => ray(c,d)));
  const candidates = extractContiguousSequences(rays, minLen=3);
  const unique = dedupe(candidates).filter(seq => includesSwapped(seq, swappedCells));
  return unique.filter(seq => dict.has(seq.toString())); // normalized
}
```

---
## Content & Dictionary Policy (MVP)

* **Language:** Icelandic nouns (nominative singular, no articles). Provide in-app examples and rejections for common near-misses (declensions). 
* **Scoring:** Icelandic letter values from supplied file; store versioned. 
* **Theming:** Light/dark boards; subtle player color accents; grid always prioritizes legibility.

## What We Kept vs. Changed (Traceability)

* **Kept:** 16×16, 8 directions, no wrap, 10 moves each, +2s increment, tile freezing, overlapping tinting, lobby + invitations, Supabase/Next.js/Tailwind, Icelandic nouns + Scrabble-style scoring. 
* **Changed/Clarified:**

  * Clocks: only active player’s timer runs; clear turn indicator. 
  * Scoring math: explicit formulas and combo tail. 
  * Generation: language frequency-based, not score-based; add solvability seeding. 
  * Safeguard: minimum movable tiles check to prevent freezes causing soft-locks. 


---
## Open Questions (captured to backlog; not blocking MVP)

* Should flagging end the game immediately (classical chess) or keep “finish your own moves” rule? (We’ll keep ideation’s rule for now and test.) 
* Are non-adjacent swaps intended forever? Consider an “adjacent-only” ranked variant for higher tactical difficulty.
* Do we want ranked mirrors (alternating who starts) in best-of-2?


## Appendices

### Appendix A — References to Ideation

* 16×16 board, random weighted letters, timers, first-move, 10 moves, increments, tile freezing, 8 directions, Icelandic nouns dictionary, Scrabble-like scoring, Next/Tailwind/Supabase stack, lobby & invitations are from the ideation draft and are preserved or clarified here. 

If you want, I can turn this into a Jira-ready epic/issue breakdown with acceptance criteria next.

### Appendix B: Letter Distribution Table

| Letter | Frequency | Point Value | Count (in 256 tiles) |
|--------|-----------|-------------|----------------------|
| A | 10% | 1 | 26 |
| R | 9% | 1 | 23 |
| N | 8% | 1 | 20 |
| I | 8% | 1 | 20 |
| S | 7% | 1 | 18 |
| L | 6% | 2 | 15 |
| T | 6% | 1 | 15 |
| U | 5% | 1 | 13 |
| E | 5% | 1 | 13 |
| D | 4% | 2 | 10 |
| G | 4% | 2 | 10 |
| K | 3% | 3 | 8 |
| M | 3% | 3 | 8 |
| F | 3% | 4 | 8 |
| V | 3% | 4 | 8 |
| H | 2% | 4 | 5 |
| Á | 2% | 4 | 5 |
| Y | 2% | 4 | 5 |
| O | 2% | 3 | 5 |
| B | 1.5% | 6 | 4 |
| P | 1.5% | 6 | 4 |
| Ð | 1.5% | 6 | 4 |
| É | 1% | 7 | 3 |
| Æ | 1% | 7 | 3 |
| Þ | 1% | 8 | 3 |
| Í | 1% | 8 | 3 |
| Ó | 1% | 8 | 3 |
| Ú | 0.5% | 9 | 1 |
| Ý | 0.5% | 9 | 1 |
| Ö | 0.5% | 10 | 1 |

**Total: 256 tiles**

### Appendix C: Competitive Comparison Matrix

| Feature | Wottle | Words With Friends | Scrabble GO | Chess.com |
|---------|--------|-------------------|-------------|-----------|
| **Gameplay** | Real-time, simultaneous | Async, turn-based | Async + timed modes | Real-time |
| **Grid Size** | 16x16 | 15x15 | 15x15 | 8x8 |
| **Session Length** | 12-15 min | Days/weeks | Days or 3 min | 3-60 min |
| **Unique Mechanic** | Frozen tiles | - | Duels mode | Chess tactics |
| **Time Control** | Chess clock | Days per turn | Days or Rush | Various |
| **Language Focus** | Icelandic (MVP) | English | English | Universal |
| **Social Features** | Friends, chat | Strong social | Moderate | Strong |
| **Monetization** | Freemium (planned) | Ads + $12.99/mo | Ads + $6.49/mo | Freemium |
| **Target Audience** | Competitive, 18-34 | Casual, 25-45 | Mixed | Competitive, all ages |

**Key Differentiators:**
1. Real-time gameplay with chess clocks (unique in word games)
2. Territory control via frozen tiles (spatial strategy)
3. Icelandic language focus (underserved market)
4. Simultaneous move planning (strategic depth)

### Appendix D: Glossary

**Chess Clock:** Time control system where each player has independent time bank that counts down during their turn

**ELO Rating:** Numerical rating system that calculates relative skill levels (invented by Arpad Elo for chess)

**Fischer Increment:** Time control where X seconds are added after each move (e.g., 5+3 = 5 minutes + 3 seconds per move)

**Frozen Tile:** Tile used in validated word that becomes permanently claimed by the player, blocking opponent usage

**NFC Normalization:** Unicode composed form normalization (ensures consistent character representation)

**Planning Phase:** Period where both players submit moves privately before simultaneous resolution

**Trie:** Tree data structure optimized for string storage and prefix-based searching

**WebSocket:** Protocol providing full-duplex communication over TCP for real-time data transfer

---

## Conclusion & Next Steps

Wottle represents an innovative fusion of traditional word games with real-time strategy and territory control mechanics. The unique frozen tile system and chess clock timing differentiate it in a market dominated by asynchronous play, targeting competitive gamers and Icelandic language enthusiasts.

**Critical Success Factors:**
1. **Fair simultaneous move resolution** via planning phase model
2. **Intuitive frozen tile visualization** with multi-modal feedback
3. **Sub-100ms server response times** for smooth real-time play
4. **Minimum 100 concurrent users** for viable matchmaking
5. **30%+ Day 1 retention** through excellent onboarding

**Immediate Next Steps:**
1. **Stakeholder review** of PRD (1 week)
2. **Technical spike** on Trie performance with 18K words (3 days)
3. **Design mockups** for frozen tile states (1 week)
4. **User research** with 10 target users on concept (2 weeks)
5. **Development kick-off** after validation (Week 5)

**Go/No-Go Criteria:**
- ✅ Positive user research (8/10 would play)
- ✅ Technical validation (Trie performs <50ms)
- ✅ Founding team commitment (4-6 months)
- ✅ Initial user pool identified (200+ beta testers)

This PRD provides comprehensive guidance for building Wottle MVP. Success requires disciplined execution of the phased roadmap, continuous user testing, and data-driven iteration based on engagement metrics. The planning phase approach to simultaneous moves and progressive onboarding for frozen tiles are critical innovations that mitigate the highest-risk design elements.

**Approval Required From:**
- Product Lead
- Engineering Lead  
- Design Lead
- Marketing Lead

**Document Version:** 1.0  
**Last Updated:** 2025-10-18  
**Next Review:** Post-beta testing (Week 16)