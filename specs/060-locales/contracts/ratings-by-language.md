# Contract: ratings by language

- `readRating(client, playerId, language): RatingRecord` — row or `DEFAULT_RATING_RECORD`.
- `persistRatingChanges(client, { matchId, language, … })` — reads both players' `player_ratings` for `language`, computes Elo as today, upserts both rows, inserts `match_ratings` with `language`. Idempotent on `uq_match_ratings_match_player` as today.
- Readers taking `language`: `getMatchRatings(matchId)` (language from the match), `getPlayerProfile(handle, language)`, `getTopPlayers(language)`, `getMatchOverview`, lobby presence rows (join `player_ratings` on the presence language), `stateLoader` rating lines.
- Profile under a locale shows that language's rating, peak (from filtered history), chart, record and recent matches (`matches.language = language`).
- Tests: unit Elo persistence with language; integration: backfill equality (SC-006), an en match settles only en rows.
