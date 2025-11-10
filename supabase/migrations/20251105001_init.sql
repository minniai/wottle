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

create or replace function public.board_grid_is_square(grid jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  row_count integer;
  column_count integer;
  idx integer;
begin
  if grid is null then
    return false;
  end if;

  if jsonb_typeof(grid) <> 'array' then
    return false;
  end if;

  row_count := jsonb_array_length(grid);

  if row_count <= 0 then
    return false;
  end if;

  for idx in 0 .. row_count - 1 loop
    if jsonb_typeof(grid->idx) <> 'array' then
      return false;
    end if;

    column_count := jsonb_array_length(grid->idx);
    if column_count <> row_count then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.boards
  drop constraint if exists boards_grid_is_square;

alter table public.boards
  add constraint boards_grid_is_square check (public.board_grid_is_square(grid));

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

create or replace function public.board_max_index(board uuid)
returns smallint
language plpgsql
stable
as $$
declare
  max_index integer;
begin
  select jsonb_array_length(grid) - 1
    into max_index
  from public.boards
  where id = board;

  if max_index is null then
    raise exception 'Board % not found when computing max index', board;
  end if;

  if max_index < 0 then
    raise exception 'Board % has invalid grid dimensions', board;
  end if;

  return max_index::smallint;
end;
$$;

create or replace function public.board_coordinate_in_bounds(board uuid, coordinate smallint)
returns boolean
language sql
stable
as $$
  select coordinate between 0 and public.board_max_index(board);
$$;

-- Moves table ------------------------------------------------------------
create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  from_x smallint not null check (public.board_coordinate_in_bounds(board_id, from_x)),
  from_y smallint not null check (public.board_coordinate_in_bounds(board_id, from_y)),
  to_x smallint not null check (public.board_coordinate_in_bounds(board_id, to_x)),
  to_y smallint not null check (public.board_coordinate_in_bounds(board_id, to_y)),
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
