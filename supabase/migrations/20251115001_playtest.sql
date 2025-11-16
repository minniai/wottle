-- Playtest schema additions for two-player milestone
create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  display_name text not null,
  avatar_url text,
  status text not null check (status in ('available','matchmaking','in_match','offline')),
  last_seen_at timestamptz not null default now(),
  elo_rating integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lobby_presence (
  player_id uuid primary key references public.players(id) on delete cascade,
  connection_id uuid not null,
  mode text not null check (mode in ('auto','direct_invite')),
  invite_token uuid,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists lobby_presence_expires_at_idx
  on public.lobby_presence (expires_at);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  board_seed uuid not null,
  round_limit smallint not null default 10 check (round_limit between 1 and 20),
  state text not null check (state in ('pending','in_progress','completed','abandoned')),
  current_round smallint not null default 1,
  player_a_id uuid not null references public.players(id),
  player_b_id uuid not null references public.players(id),
  player_a_timer_ms integer not null default 300000,
  player_b_timer_ms integer not null default 300000,
  winner_id uuid references public.players(id),
  ended_reason text check (ended_reason in ('round_limit','timeout','disconnect','forfeit','draw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_player_a_idx on public.matches (player_a_id);
create index if not exists matches_player_b_idx on public.matches (player_b_id);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  round_number smallint not null,
  state text not null check (state in ('collecting','resolving','completed')),
  board_snapshot_before jsonb not null,
  board_snapshot_after jsonb,
  resolution_started_at timestamptz,
  completed_at timestamptz,
  unique (match_id, round_number)
);

create table if not exists public.move_submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  from_x smallint not null check (from_x between 0 and 9),
  from_y smallint not null check (from_y between 0 and 9),
  to_x smallint not null check (to_x between 0 and 9),
  to_y smallint not null check (to_y between 0 and 9),
  submitted_at timestamptz not null default now(),
  status text not null check (status in ('pending','accepted','rejected_invalid','ignored_same_move','timeout')),
  rejection_reason text,
  unique (round_id, player_id)
);

create table if not exists public.match_invitations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.players(id) on delete cascade,
  recipient_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('pending','accepted','declined','expired')),
  match_id uuid references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.word_score_entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  word text not null,
  length smallint not null,
  letters_points smallint not null,
  bonus_points smallint not null default 0,
  total_points smallint not null,
  tiles jsonb not null
);

create table if not exists public.scoreboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  round_number smallint not null,
  player_a_score integer not null,
  player_b_score integer not null,
  player_a_delta integer not null,
  player_b_delta integer not null,
  generated_at timestamptz not null default now(),
  unique (match_id, round_number)
);

create table if not exists public.match_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists match_logs_match_id_idx on public.match_logs (match_id);

