# Data Model: 060-locales

## Locale (code, `lib/i18n/locales.ts`)

| Field | Type | is | en | Rule |
| --- | --- | --- | --- | --- |
| `id` | `Locale` (`"is" \| "en"`) | `is` | `en` | union grows per language |
| `segment` | string | `""` | `"en"` | empty only for `DEFAULT_LOCALE` |
| `htmlLang` | BCP 47 tag | `is` | `en` | future dk → `da` |
| `language` | `Language` | `is` | `en` | game language for matches started here |
| `wordmark` | string | `orðusta` | `wottle` | lowercase (design §8) |
| `switchTo` | `Locale` | `en` | `is` | target of the ledger-foot link |

## LanguagePack (code, `lib/game-engine/languagePack.ts`)

| Field | Type | Source |
| --- | --- | --- |
| `language` | `Language` | — |
| `letterValues` | `Record<string, number>` | `letter-values/letter_scoring_values_{lang}.ts` |
| `letterWeights` | `Record<string, number>` | `boardGenerator.ts` (`ICELANDIC_…`, `ENGLISH_…`) |
| `alphabet` | `readonly string[]` | keys of `letterWeights` |
| `upperLocale` | string | `is` / `en` |

Dictionary stays in `dictionary.ts` keyed by `Language` (unchanged config).

## Database (additive)

### Migration `20260922001_match_language.sql` (P3)

```sql
alter table public.matches
  add column language text not null default 'is' check (language in ('is','en'));
alter table public.match_invitations
  add column language text not null default 'is' check (language in ('is','en'));
alter table public.lobby_presence
  add column language text not null default 'is' check (language in ('is','en'));
alter table public.players
  add column queue_language text check (queue_language in ('is','en'));
create index if not exists idx_players_queue_language
  on public.players (queue_language, last_seen_at) where status = 'matchmaking';
-- claim_next_move: recreated with `'language', m.language` in its match object.
```

Invariants:
- `matches.language` is written by `bootstrapMatchRecord` only, never updated.
- `players.queue_language` is non-null iff `status = 'matchmaking'` (set together, cleared together).
- A rematch row's language = its `rematch_of` row's language.

### Migration `20260922002_ratings_by_language.sql` (P4)

```sql
create table public.player_ratings (
  player_id uuid not null references public.players(id) on delete cascade,
  language text not null check (language in ('is','en')),
  elo_rating integer not null default 1200 check (elo_rating >= 100),
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, language),
  check (games_played = wins + losses + draws)
);
insert into public.player_ratings (player_id, language, elo_rating, games_played, wins, losses, draws)
  select id, 'is', elo_rating, games_played, wins, losses, draws from public.players;
alter table public.match_ratings add column language text not null default 'is'
  check (language in ('is','en'));
update public.match_ratings r set language = m.language from public.matches m where m.id = r.match_id;
create index idx_match_ratings_player_language_created
  on public.match_ratings (player_id, language, created_at desc);
-- RLS: select all; insert/update/delete false (service role only), as match_ratings.
```

Invariants:
- After backfill, `player_ratings(p,'is')` equals `players(p)` rating fields for every p (SC-006).
- A settlement touches only rows with `language = matches.language`.
- Missing row ⇒ reader returns `{ elo_rating: 1200, games_played: 0, … }`.

## Types

- `MatchState.language: Language` (Zod: `z.enum(LANGUAGES)`).
- `ClaimMatch.language: Language`.
- `LobbyPresence.language: Language`; `InvitationRecord.language: Language`.
- `ActionError = { code: ErrorCode; message: string }` for messages shown to players.
