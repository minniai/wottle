-- Migration: initialize boards and moves schema for Wottle MVP
-- Generated for Phase 2 foundational tasks (T011, T011a)

-- Extensions --------------------------------------------------------------
create extension if not exists pgcrypto;

-- Boards table -----------------------------------------------------------
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  board_id text not null unique default 'primary-board',
  grid jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boards_singleton check (board_id = 'primary-board')
);

create or replace function public.set_boards_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
before update on public.boards
for each row execute procedure public.set_boards_updated_at();

-- Moves table ------------------------------------------------------------
create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  from_x smallint not null check (from_x between 0 and 15),
  from_y smallint not null check (from_y between 0 and 15),
  to_x smallint not null check (to_x between 0 and 15),
  to_y smallint not null check (to_y between 0 and 15),
  result text not null check (result in ('accepted', 'rejected')),
  error text,
  applied_at timestamptz not null default now()
);

create index if not exists moves_board_id_idx on public.moves(board_id);

-- Row Level Security -----------------------------------------------------
alter table public.boards enable row level security;
alter table public.moves enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'boards' and policyname = 'service_all_boards'
  ) then
    execute $ddl$
      create policy service_all_boards on public.boards
        for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
    $ddl$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'moves' and policyname = 'service_all_moves'
  ) then
    execute $ddl$
      create policy service_all_moves on public.moves
        for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
    $ddl$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'boards' and policyname = 'anon_read_boards'
  ) then
    execute $ddl$
      create policy anon_read_boards on public.boards
        for select using (auth.role() = 'anon');
    $ddl$;
  end if;
end
$$;

-- Helper view to ensure singleton
create or replace view public.board_singleton as
select * from public.boards limit 1;
