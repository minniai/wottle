# Research: 060-locales

## R1. Locale routing in Next.js 16

- **Decision**:
  - Put every page under `app/[locale]`, with `app/[locale]/layout.tsx` as the root layout.
  - Add a root `proxy.ts`, which is the Next 16 name for middleware; the behaviour is unchanged. Its rules:
    - `/is` or `/is/*` gets a 308 redirect to the path without the prefix.
    - A path whose first segment is a registered non-default locale passes through.
    - Everything else is rewritten to `/is{path}`.
    - The matcher excludes `/api`, `/_next`, and files with an extension.
  - `generateStaticParams` returns every locale, and `dynamicParams = false` makes unknown segments 404.
- **Rationale**:
  - This is the pattern in Next's bundled i18n guide (`node_modules/next/dist/docs/01-app/02-guides/internationalization.md`), adapted so the default locale has no prefix.
  - The rewrite keeps the address bar clean while the router still sees a `locale` param.
- **Alternatives considered**:
  - Duplicate route trees (`app/en/...` alongside `app/...`). This doubles every page.
  - Next's `i18n` config. It is not supported in the App Router.
  - A cookie or `Accept-Language` negotiation. This is out of scope because the address is the only authority.
- **Pitfall**: `/xx/lobby` under the rewrite becomes `/is/xx/lobby`. That 404s because no such route exists, which is what the spec's edge case requires.

## R2. How the room shell survives

- **Decision**: `app/[locale]/(room)/layout.tsx` keeps the single persistent `RoomShell`. Moving between `/lobby`, `/matchmaking` and `/match/x` within one locale keeps the same layout instance. Switching locale changes the `[locale]` segment and remounts, which is only offered from lobby and final (FR-025).
- **Rationale**: This preserves spec 044 R5 ("never remount the field") within a locale.

## R3. String catalogue

- **Decision**:
  - Keep one typed object per locale: `copyEn` holds today's `copy.ts` exports as properties, and `type Copy = typeof copyEn` widened to string and function signatures. `copyIs` must `satisfies Copy`.
  - Functions stay functions, so each locale owns word order and plurals. Icelandic plurals use `new Intl.PluralRules("is")`, whose categories are one/other; one covers numbers ending in 1 except 11.
  - Server components use `getCopy(locale)`. Client components use `useCopy()` from `LocaleProvider`, which is mounted by the `[locale]` layout.
  - The pure `lib/room` functions receive `copy` as an argument.
- **Rationale**:
  - No dependency is needed, and a missing key is a compile error.
  - The ICU-free functions already exist; 43 of the exports take parameters.
- **Alternatives considered**:
  - next-intl or ICU messages. These add a dependency and a runtime parser for about 250 strings.
  - JSON dictionaries. These lose the function-typed parameters.

## R4. Server messages

- **Decision**: Actions and routes whose message reaches the UI return `{ code: ErrorCode, message }`. The client renders `copy.errors[code]`, and `message` stays English for logs and tests. This applies to login, queue, invite, rematch, preview, claim-win, resign and move refusal, where it is shown.
- **Rationale**: Actions stay locale-free, so they need no locale plumbing into server-only code.

## R5. The game language on the server

- **Decision**:
  - `matches.language` is the only authority.
  - `claim_next_move` returns it in its match object.
  - `resolveClaim` calls `getLanguagePack(match.language)` and `loadDictionary(match.language)`.
  - `previewSwap` selects it with the match.
  - `stateLoader` passes the pack's weights to `generateBoard` and warms the dictionary.
  - `MatchState.language` carries it to the client for tile values and uppercasing.
- **Rationale**:
  - The client never chooses a match's language (Principle I).
  - Every existing row defaults to `is`, which gives FR-017.

## R6. English board frequencies

- **Decision**:
  - `ENGLISH_LETTER_WEIGHTS` uses the 26 letters with standard Scrabble-bag counts (E12 A9 I9 O8 N6 R6 T6 L4 S4 U4 D4 G3 B2 C2 M2 P2 F2 H2 V2 W2 Y2 K1 J1 X1 Q1 Z1). These are already the basis of `letter_scoring_values_en`.
  - The generator's "each letter once" pass is kept: 26 ≤ 100.
- **Alternatives considered**: Corpus letter frequencies. Rejected because Scrabble counts are tuned for word games and match the letter values.

## R7. The English dictionary

- **Decision**:
  - Ship `data/wordlists/word_list_en.txt` (79,339 lines).
  - Add a curation test asserting it is lowercase, a–z only, has no entries under 3 letters that could score, and has at least 10k entries.
  - Add `outputFileTracingIncludes: { "/**": ["data/wordlists/word_list_{is,en}.txt", …exclusions] }` if the deploy trace does not already include it. Verify with `pnpm build` and `.next` trace inspection.
- **Risk**: The list is thin. It can be swapped for a larger one later as data (the spec's assumptions).

## R8. Partitioned matchmaking

- **Decision**:
  - The queue uses `players.queue_language`, which is set with `status='matchmaking'` and cleared when the player leaves the queue. `fetchQueueCandidates` and the conditional claim both filter on it.
  - The lobby uses `lobby_presence.language`. The presence snapshot, count and invite recipient checks filter on it.
  - The Realtime presence channel name becomes `lobby-presence:{language}`.
  - Invites store `match_invitations.language` = the sender's lobby language. Acceptance creates the match in that language.
- **Rationale**:
  - One column per existing table and no new queue table.
  - The claim's `.eq(queue_language)` closes the race where a player switches language between fetch and claim.
- **Alternatives considered**: A queue table keyed by language. It would replace a working mechanism for no gain.

## R9. Ratings for each language

- **Decision**:
  - New table `player_ratings(player_id, language, elo_rating, games_played, wins, losses, draws, updated_at)` with primary key `(player_id, language)` and the same checks as `players`.
  - The backfill copies every `players` row as `language='is'`.
  - `match_ratings.language` defaults to `'is'` and is backfilled from its match.
  - `persistRatingChanges` reads and upserts `player_ratings` for the match's language. A missing row is 1200/0 (`DEFAULT_RATING`).
  - Every reader (lobby presence rating, top players, profile, match overview, `getMatchRatings`, `stateLoader` rating lines) takes a language. Peak and the chart are already derived from `match_ratings` history, which is now filtered by language.
- **Rationale**: FR-021–024. `players.elo_rating` stops being written; dropping it is a follow-up.
- **Alternatives considered**: A JSONB of ratings on `players`. Rejected because it can't carry per-language check constraints or be indexed for leaderboards.

## R10. Visual baselines

- **Decision**:
  - `room-fixtures.spec.ts` targets `/en/dev/room`. Snapshot names are unchanged, so today's PNGs apply.
  - A second describe block renders `/dev/room` (Icelandic) for lobby, idle, reveal, final, landing-slip, over-slip and rules at the three viewports, with new baselines.
- **Rationale**: SC-002 proves the en rendering is untouched, and SC-001 is covered by the is set.

## R11. Uppercasing and validation of letters

- **Decision**:
  - `pack.upperLocale` replaces `toLocaleUpperCase("is")` in `wordIntegrity`, `bandGeometry` and `matchIntegrity`.
  - `BoardGrid` and preview schemas validate against `ALL_LETTERS`, the union of registered pack alphabets. For is and en, that is today's Icelandic set, which already contains A–Z.
  - English uppercasing of a–z is identical under either locale, so there is no behaviour change for is.
