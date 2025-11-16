# Data Model: Two-Player Playtest

This document defines the relational schema required to support lobby presence, matchmaking, round orchestration, scoring summaries, and audit logs for the two-player playtest milestone.

## Entities

- **PlayerIdentity**
  - `id` (uuid, PK)
  - `username` (text, unique, lowercased)
  - `display_name` (text)
  - `avatar_url` (text, optional)
  - `status` (enum: `available`, `matchmaking`, `in_match`, `offline`)
  - `last_seen_at` (timestamptz)
  - `elo_rating` (int, nullable — tracked only if ranked playtests enabled later)

- **LobbyPresence** (ephemeral rows describing real-time availability)
  - `player_id` (uuid, PK/FK → players.id)
  - `connection_id` (uuid) — Supabase Realtime ref
  - `mode` (enum: `auto`, `direct_invite`)
  - `invite_token` (uuid, nullable) — active outbound invite
  - `expires_at` (timestamptz) — presence timeout for cleanup

- **MatchInvitation**
  - `id` (uuid, PK)
  - `sender_id`, `recipient_id` (uuid, FK → players.id)
  - `status` (enum: `pending`, `accepted`, `declined`, `expired`)
  - `created_at`, `responded_at` (timestamptz)
  - `match_id` (uuid, nullable) — populated when accepted

- **Match**
  - `id` (uuid, PK)
  - `board_seed` (uuid)
  - `round_limit` (smallint, default 10)
  - `state` (enum: `pending`, `in_progress`, `completed`, `abandoned`)
  - `current_round` (smallint)
  - `player_a_id`, `player_b_id` (uuid FKs)
  - `player_a_timer_ms`, `player_b_timer_ms` (int) — remaining time
  - `winner_id` (uuid, nullable when draw)
  - `ended_reason` (enum: `round_limit`, `timeout`, `disconnect`, `forfeit`)
  - timestamps (`created_at`, `updated_at`)

- **Round**
  - `id` (uuid, PK)
  - `match_id` (uuid FK)
  - `round_number` (smallint, unique within match)
  - `state` (enum: `collecting`, `resolving`, `completed`)
  - `board_snapshot_before` (jsonb 10×10)
  - `board_snapshot_after` (jsonb 10×10)
  - `resolution_started_at`, `completed_at` (timestamptz)

- **MoveSubmission**
  - `id` (uuid, PK)
  - `round_id` (uuid FK)
  - `player_id` (uuid FK)
  - `from_x`, `from_y`, `to_x`, `to_y` (smallint 0–9)
  - `submitted_at` (timestamptz)
  - `status` (enum: `pending`, `accepted`, `rejected_invalid`, `ignored_same_move`, `timeout`)
  - `rejection_reason` (text, nullable)

- **WordScoreEntry**
  - `id` (uuid, PK)
  - `match_id` (uuid FK)
  - `round_id` (uuid FK)
  - `player_id` (uuid FK)
  - `word` (text)
  - `length` (smallint)
  - `letters_points` (smallint)
  - `bonus_points` (smallint)
  - `total_points` (smallint)
  - `tiles` (jsonb array of coordinate pairs)

- **ScoreboardSnapshot** (materialized view / table for quick retrieval)
  - `id` (uuid, PK)
  - `match_id` (uuid FK)
  - `round_number` (smallint)
  - `player_a_score`, `player_b_score` (int)
  - `player_a_delta`, `player_b_delta` (int)
  - `generated_at` (timestamptz)

- **MatchLog** (append-only audit trail)
  - `id` (uuid, PK)
  - `match_id` (uuid FK)
  - `event_type` (text enum: `login`, `invite_sent`, `invite_response`, `round_started`, `round_completed`, `disconnect`, `timeout`, `summary_published`)
  - `payload` (jsonb) — structured event details
  - `created_at` (timestamptz)

## DDL Outline (Supabase/PostgreSQL 15+)

```sql
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  display_name text not null,
  avatar_url text,
  status text not null check (status in ('available','matchmaking','in_match','offline')),
  last_seen_at timestamptz not null default now(),
  elo_rating integer,
  created_at timestamptz not null default now()
);

create table if not exists lobby_presence (
  player_id uuid primary key references players(id) on delete cascade,
  connection_id uuid not null,
  mode text not null check (mode in ('auto','direct_invite')),
  invite_token uuid,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists match_invitations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references players(id) on delete cascade,
  recipient_id uuid not null references players(id) on delete cascade,
  status text not null check (status in ('pending','accepted','declined','expired')),
  match_id uuid references matches(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  board_seed uuid not null,
  round_limit smallint not null default 10 check (round_limit between 1 and 20),
  state text not null check (state in ('pending','in_progress','completed','abandoned')),
  current_round smallint not null default 1,
  player_a_id uuid not null references players(id),
  player_b_id uuid not null references players(id),
  player_a_timer_ms integer not null default 300000,
  player_b_timer_ms integer not null default 300000,
  winner_id uuid references players(id),
  ended_reason text check (ended_reason in ('round_limit','timeout','disconnect','forfeit','draw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  round_number smallint not null,
  state text not null check (state in ('collecting','resolving','completed')),
  board_snapshot_before jsonb not null,
  board_snapshot_after jsonb,
  resolution_started_at timestamptz,
  completed_at timestamptz,
  unique (match_id, round_number)
);

create table if not exists move_submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  from_x smallint not null check (from_x between 0 and 9),
  from_y smallint not null check (from_y between 0 and 9),
  to_x smallint not null check (to_x between 0 and 9),
  to_y smallint not null check (to_y between 0 and 9),
  submitted_at timestamptz not null default now(),
  status text not null check (status in ('pending','accepted','rejected_invalid','ignored_same_move','timeout')),
  rejection_reason text,
  unique (round_id, player_id)
);

create table if not exists word_score_entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  word text not null,
  length smallint not null,
  letters_points smallint not null,
  bonus_points smallint not null default 0,
  total_points smallint not null,
  tiles jsonb not null
);

create table if not exists scoreboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  round_number smallint not null,
  player_a_score integer not null,
  player_b_score integer not null,
  player_a_delta integer not null,
  player_b_delta integer not null,
  generated_at timestamptz not null default now(),
  unique (match_id, round_number)
);

create table if not exists match_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
```

## Relationships & Notes

- `matches` references exactly two players; enforcement handled via check constraint plus trigger preventing duplicates.
- `rounds` cascade-delete when a match is purged; however, logs remain for audit.
- `move_submissions.status` transitions: `pending` → (`accepted` | `rejected_invalid` | `ignored_same_move` | `timeout`).
- `scoreboard_snapshots` can be a materialized view fed by `word_score_entries` or maintained by trigger when word scores insert.
- `match_logs` support observability goals by mirroring every state transition and will backfill analytics dashboards.
- RLS: players can only access their own records plus matches they participate in; observers (admin role) may read all for QA.
