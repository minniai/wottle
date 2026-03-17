# Feature Specification: Elo Rating & Player Stats

**Feature Branch**: `017-elo-rating-player-stats`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Elo Rating & Player Stats — after match completion, calculate and update Elo ratings for both players using standard Elo formula (K=32 for new players <20 games, K=16 for established). Display ratings in the lobby next to usernames, show rating change (+/-) on the FinalSummary screen after each game, and provide a simple player profile view showing games played, wins, losses, win rate, current rating, and rating trend (last 5 games). Add elo_rating (default 1200) and games_played columns to the players table. All games are rated for now (no ranked/casual toggle). No matchmaking algorithm changes — just display Elo difference when viewing opponents in lobby. No leaderboards or rating history charts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rating Updates After Match Completion (Priority: P1)

After a match ends, the system automatically calculates Elo rating changes for both players and updates their ratings. The winner gains points and the loser loses points, with the magnitude depending on the rating gap between players. Both players see their rating change displayed on the final summary screen.

**Why this priority**: Without server-side rating calculation, no other rating feature works. This is the foundation that all display features depend on.

**Independent Test**: Can be fully tested by completing a match between two players with known starting ratings and verifying both players' ratings are updated correctly in the database and displayed on the final summary screen.

**Acceptance Scenarios**:

1. **Given** two players with ratings 1200 and 1200 complete a match, **When** Player A wins, **Then** Player A's rating increases and Player B's rating decreases by the same amount, and the final summary screen shows the rating change (e.g., "+16" for the winner, "-16" for the loser).
2. **Given** a higher-rated player (1400) beats a lower-rated player (1100), **When** the match completes, **Then** the winner gains fewer points than if the ratings were equal (expected outcome), reflecting that the upset was unlikely.
3. **Given** a lower-rated player (1100) beats a higher-rated player (1400), **When** the match completes, **Then** the winner gains more points than if the ratings were equal (upset bonus), reflecting the surprising result.
4. **Given** a new player with fewer than 20 completed games, **When** they complete a match, **Then** their rating change uses K-factor 32 (larger swings for faster calibration).
5. **Given** an established player with 20 or more completed games, **When** they complete a match, **Then** their rating change uses K-factor 16 (smaller, more stable adjustments).
6. **Given** a match that ends in a draw (equal scores and equal frozen tiles), **When** ratings are calculated, **Then** both players' ratings adjust toward convergence (higher-rated player loses a small amount, lower-rated player gains a small amount).
7. **Given** a match that ends by resignation, **When** ratings are calculated, **Then** the resigning player is treated as the loser and ratings update normally.

---

### User Story 2 - Ratings Displayed in Lobby (Priority: P1)

When a player views the lobby, they see each online player's Elo rating displayed next to their username. When considering an opponent, the player can see the Elo difference to gauge the challenge level.

**Why this priority**: The lobby is where players choose opponents. Showing ratings here is essential for informed matchmaking decisions and is the most visible place ratings appear.

**Independent Test**: Can be tested by logging in with a rated player and verifying all lobby entries show ratings, and that the Elo difference is visible when viewing another player.

**Acceptance Scenarios**:

1. **Given** a player is on the lobby screen, **When** the lobby list loads, **Then** each player entry displays their current Elo rating next to their username.
2. **Given** a new player who has never completed a match, **When** they appear in the lobby, **Then** their rating displays as "1200" (the default starting rating).
3. **Given** two players in the lobby with ratings 1350 and 1180, **When** a player views another player's lobby entry, **Then** the Elo difference is shown (e.g., "+170" or "-170" relative to the viewer).
4. **Given** a player's rating changes (match just completed), **When** they return to the lobby, **Then** their updated rating is reflected in real-time for all lobby participants.

---

### User Story 3 - Player Profile View (Priority: P2)

A player can view a simple profile for any player (themselves or others) showing career statistics: games played, wins, losses, win rate, current rating, and a rating trend showing the direction of their last 5 games.

**Why this priority**: Profile stats add depth and retention — players can track their improvement over time. However, it's a read-only display that doesn't affect core gameplay, making it lower priority than rating calculation and lobby display.

**Independent Test**: Can be tested by completing several matches with a player and verifying the profile view accurately reflects their game history, win/loss record, and rating trend.

**Acceptance Scenarios**:

1. **Given** a player clicks on a username (their own or another player's) in the lobby or on the final summary screen, **When** the profile view opens, **Then** it displays: current Elo rating, games played, wins, losses, draws, win rate percentage, and rating trend for the last 5 games.
2. **Given** a player has completed 7 games (4 wins, 3 losses), **When** their profile is viewed, **Then** it shows: Games: 7, Wins: 4, Losses: 3, Win Rate: 57%.
3. **Given** a player has completed 3 games (fewer than 5), **When** their profile is viewed, **Then** the rating trend shows only the 3 available data points (no placeholder entries for missing games).
4. **Given** a new player with 0 completed games, **When** their profile is viewed, **Then** it shows: Rating: 1200, Games: 0, Wins: 0, Losses: 0, Win Rate: —, and no trend data.
5. **Given** a player has completed 10 games with ratings [1200, 1216, 1232, 1220, 1245, 1260, 1248, 1270, 1285, 1300], **When** their profile is viewed, **Then** the trend shows the last 5 values [1248, 1270, 1285, 1300] with an upward direction indicator.

---

### User Story 4 - Rating Change on Final Summary (Priority: P2)

After a match completes, the final summary screen shows both players' rating changes prominently — the points gained or lost — alongside the existing score summary and series information.

**Why this priority**: This is the moment players care most about their rating. Showing the change at match end reinforces the competitive loop. It depends on US1 (calculation) being in place.

**Independent Test**: Can be tested by completing a match and verifying the final summary screen displays the correct rating change for both players.

**Acceptance Scenarios**:

1. **Given** a match has just completed, **When** the final summary screen loads, **Then** both players see their own rating change (e.g., "+16") and their opponent's rating change (e.g., "-16").
2. **Given** the winner's rating increased by 24 points, **When** the final summary is displayed, **Then** the rating change is shown in green with a "+" prefix (e.g., "+24").
3. **Given** the loser's rating decreased by 24 points, **When** the final summary is displayed, **Then** the rating change is shown in red with a "-" prefix (e.g., "-24").
4. **Given** a draw where both ratings changed by small amounts, **When** the final summary is displayed, **Then** each player's change is shown with appropriate color and sign.

---

### Edge Cases

- What happens if the rating calculation fails (e.g., database error during update)? The match result is still recorded; rating update is retried in the background. Players see "Rating update pending" instead of a number on the final summary.
- What happens if a player's rating would drop below 100? Ratings are floored at 100 — no player can go below this minimum.
- What happens if a match ends by abandonment (player disconnects permanently)? The disconnecting player is treated as the loser for rating purposes, same as resignation.
- What happens if the same two players complete many games in a row via rematch? Each game updates ratings independently — no special handling for consecutive games between the same opponents.
- What happens if a player has exactly 20 games completed? They use K-factor 16 (the threshold is "fewer than 20 games" for K=32).
- What happens if both players are new (K=32) vs. one new and one established? Each player's K-factor is determined independently based on their own games played count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate Elo rating changes for both players when a match completes (by score result, resignation, or time expiration).
- **FR-002**: System MUST use K-factor 32 for players with fewer than 20 completed games and K-factor 16 for players with 20 or more completed games.
- **FR-003**: System MUST use the standard Elo expected score formula: E = 1 / (1 + 10^((opponent_rating - player_rating) / 400)).
- **FR-004**: System MUST update both players' ratings atomically after match completion (both update or neither updates).
- **FR-005**: System MUST floor ratings at a minimum of 100 — no player's rating can drop below this value.
- **FR-006**: System MUST set the default rating for new players to 1200.
- **FR-007**: System MUST track games played, wins, losses, and draws for each player. Games played equals wins + losses + draws. Win rate is calculated as wins / (wins + losses), excluding draws from the denominator.
- **FR-008**: System MUST store the rating change (delta) for each player per match so it can be displayed on the final summary without recalculation.
- **FR-009**: System MUST display each player's current Elo rating next to their username in the lobby list.
- **FR-010**: System MUST display the Elo difference between the viewing player and each other player in the lobby.
- **FR-011**: System MUST display both players' rating changes on the final summary screen after match completion, with green/positive styling for gains and red/negative styling for losses.
- **FR-012**: System MUST provide a player profile view accessible by clicking a username in the lobby or on the final summary screen, showing: current rating, games played, wins, losses, draws, win rate, and rating trend (last 5 games).
- **FR-013**: System MUST treat draws as 0.5 result (not 1.0 win or 0.0 loss) in the Elo formula.
- **FR-014**: System MUST treat resignation and abandonment as a loss (0.0) for the resigning/abandoning player.
- **FR-015**: System MUST update lobby ratings in real-time when a player's rating changes (after completing a match).
- **FR-016**: Rating calculation MUST run server-side — clients cannot influence the calculation.
- **FR-017**: The rating trend in the profile view MUST show the direction of the player's last 5 rating changes (up, down, or stable per game).
- **FR-018**: System MUST increment games_played and update win/loss/draw counts atomically alongside rating updates.

### Key Entities

- **Player Rating**: A player's competitive strength indicator. Starts at 1200, adjusts after each completed match. Has a minimum floor of 100. K-factor varies by experience level (games played).
- **Match Rating Result**: The rating outcome for a specific completed match. Stores both players' rating before the match, rating after, and the delta. Linked to the match record.
- **Player Stats**: Aggregate career statistics for a player: total games played, wins, losses, draws, and derived win rate (wins / (wins + losses), excluding draws). Updated atomically with rating changes.
- **Rating Trend**: The last 5 rating values for a player, used to display direction of recent performance. Derived from the most recent 5 match rating results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Rating updates are applied within 2 seconds of match completion — both players see their rating change on the final summary without a separate page load.
- **SC-002**: Rating calculations are mathematically correct for all standard Elo scenarios: equal ratings, large rating gaps (300+), upsets, draws, and K-factor transitions.
- **SC-003**: Player profile statistics (games, wins, losses, win rate) are accurate to within 0 errors across a series of 10 consecutive matches.
- **SC-004**: Lobby rating display updates within 3 seconds of a player's rating changing, without requiring a page refresh.
- **SC-005**: The rating trend on the profile view correctly reflects the last 5 games' rating changes, including direction indicators.
- **SC-006**: All rating operations are atomic — there are no scenarios where one player's rating updates but the other's does not.

## Clarifications

### Session 2026-03-15
- Q: Should there be a ranked/casual toggle? → A: No — all games are rated for MVP. Casual mode can be added later.
- Q: Should matchmaking use Elo for pairing? → A: No — matchmaking is unchanged. Elo is display-only for now.
- Q: Should there be leaderboards? → A: No — out of scope. Only individual profile stats.
- Q: Where is the profile view accessed from? → A: Clicking a username in the lobby opens the profile. No separate profile page/route needed — it can be an inline panel or modal.
- Q: Should rating history be charted? → A: No — only the last 5 games trend direction is shown, not a full chart.
- Q: How are draws tracked in player stats? → A: Draws are tracked separately with a dedicated count. games_played = wins + losses + draws. Win rate = wins / (wins + losses), excluding draws from the denominator.
- Q: Where can the player profile be accessed from? → A: Both the lobby and the final summary screen — clicking any username in either context opens the profile view.

## Assumptions

- The existing `elo_rating` column on the `players` table can be used directly (already present in schema, currently nullable).
- The existing `PlayerIdentity` type already includes an optional `eloRating` field that can be populated.
- Match completion logic (in roundEngine or match state machine) provides a clear hook point for triggering rating calculation.
- The lobby's real-time presence channel already broadcasts player data that can include ratings.
- The profile view will be a lightweight UI element (modal or slide-out panel) rather than a full page route, keeping implementation small.

## Scope Boundaries

### In Scope
- Elo rating calculation engine (standard formula with variable K-factor)
- Database schema changes (games_played, wins, losses columns; rating delta storage per match)
- Rating display in lobby (per-player rating + Elo difference from viewer)
- Rating change display on final summary screen
- Player profile view with career stats and 5-game rating trend
- Atomic rating + stats updates on match completion
- Rating floor enforcement (minimum 100)

### Out of Scope
- Ranked vs. casual mode toggle
- Elo-based matchmaking algorithm changes
- Leaderboards or global rankings
- Full rating history charts or graphs
- Achievements or milestones based on rating
- Rating decay for inactive players
- Provisional rating badges or labels (e.g., "Bronze", "Silver")
- Separate profile page with URL routing
