-- Spec 060 US4: a rating for each language. A player's Icelandic rating is the
-- one they have today; every other language starts at 1200 on first play.
-- `players.elo_rating`, `games_played`, `wins`, `losses`, `draws` stop being
-- written; they stay until a follow-up migration drops them.

create table if not exists public.player_ratings (
  player_id uuid not null references public.players(id) on delete cascade,
  language text not null constraint player_ratings_language_check check (language in ('is', 'en')),
  elo_rating integer not null default 1200 constraint player_ratings_elo_floor check (elo_rating >= 100),
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, language),
  constraint player_ratings_games_consistency check (games_played = wins + losses + draws)
);

comment on table public.player_ratings is
  'Spec 060: one Elo rating and record per player per game language. A missing row reads as 1200 and no games.';

create index if not exists idx_player_ratings_language_rating
  on public.player_ratings (language, elo_rating desc);

-- Backfill: today's ratings are Icelandic ratings (SC-006).
insert into public.player_ratings (player_id, language, elo_rating, games_played, wins, losses, draws)
select id, 'is', elo_rating, games_played, wins, losses, draws
  from public.players
on conflict (player_id, language) do nothing;

alter table public.player_ratings enable row level security;

create policy "player_ratings_select_all" on public.player_ratings for select using (true);
create policy "player_ratings_insert_service" on public.player_ratings for insert with check (false);
create policy "player_ratings_update_service" on public.player_ratings for update using (false);
create policy "player_ratings_delete_service" on public.player_ratings for delete using (false);

-- Each rating change records the language it applies to.
alter table public.match_ratings
  add column if not exists language text not null default 'is'
  constraint match_ratings_language_check check (language in ('is', 'en'));

update public.match_ratings r
   set language = m.language
  from public.matches m
 where m.id = r.match_id
   and r.language is distinct from m.language;

create index if not exists idx_match_ratings_player_language_created
  on public.match_ratings (player_id, language, created_at desc);
