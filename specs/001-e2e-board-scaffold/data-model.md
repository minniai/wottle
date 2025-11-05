# Data Model: MVP E2E Board & Swaps

 This document defines the minimal schema to support a 16×16 board render and a server-authoritative swap, with seed/reset workflows in local Supabase.

## Entities

- Board
  - id: uuid (PK)
  - grid: jsonb (16×16 letters as nested arrays or a flat 256-char array)
  - created_at: timestamptz (default now())
  - updated_at: timestamptz (default now(), updated on write)

- Move
  - id: uuid (PK)
  - board_id: uuid (FK → boards.id)
  - from_x: smallint (0–15)
  - from_y: smallint (0–15)
  - to_x: smallint (0–15)
  - to_y: smallint (0–15)
  - result: text ("accepted" | "rejected")
  - error: text (nullable; reason when rejected)
  - applied_at: timestamptz (default now())

 > Notes
 >
 >- MVP does not include dictionary/word checking or scoring.
 >- Future: normalize to a `tiles` table if needed; add immutability flags and scoring metadata.

## DDL (Supabase/PostgreSQL 15+)

 ```sql
 -- Boards table
 create table if not exists public.boards (
   id uuid primary key default gen_random_uuid(),
   grid jsonb not null,
   created_at timestamptz not null default now(),
   updated_at timestamptz not null default now()
 );
 
 create or replace function public.set_boards_updated_at()
 returns trigger language plpgsql as $$
 begin
   new.updated_at := now();
   return new;
 end; $$;
 
 create trigger boards_set_updated_at
 before update on public.boards
 for each row execute procedure public.set_boards_updated_at();
 
 -- Moves audit log
 create table if not exists public.moves (
   id uuid primary key default gen_random_uuid(),
   board_id uuid not null references public.boards(id) on delete cascade,
   from_x smallint not null check (from_x between 0 and 15),
   from_y smallint not null check (from_y between 0 and 15),
   to_x smallint not null check (to_x between 0 and 15),
   to_y smallint not null check (to_y between 0 and 15),
   result text not null check (result in ('accepted','rejected')),
   error text null,
   applied_at timestamptz not null default now()
 );
 
 create index if not exists moves_board_id_idx on public.moves(board_id);
 ```

## RLS Policies (MVP)

- Enable RLS on both tables; allow full access only to service_role for mutations.
- Client reads constrained to anon role for `boards` (read-only) if needed; otherwise route reads through server.

 ```sql
 alter table public.boards enable row level security;
 alter table public.moves enable row level security;
 
 -- service role: full access
 create policy if not exists service_all_boards on public.boards
   for all using (true) with check (true);
 create policy if not exists service_all_moves on public.moves
   for all using (true) with check (true);
 
 -- anon: read-only boards (optional; can be omitted if only server reads)
 create policy if not exists anon_select_boards on public.boards
   for select to anon using (true);
 ```

## Seed/Reset (Outline)

- Seed: insert a single `boards` row with a deterministic 16×16 grid (e.g., from `src/wordlist` letters or simple pattern).
- Reset: truncate `moves`; restore `boards.grid` to baseline.
- Provide scripts under `scripts/supabase/` and SQL under `supabase/migrations/`.

## Types (shared)

- `BoardGrid`: `string[16][16]` or `string[]` length 256 with `[x,y]` mapping helper.
- `MoveRequest`: `{ from: { x: number; y: number }; to: { x: number; y: number } }`.
- `MoveResult`: `{ status: 'accepted' | 'rejected'; grid: BoardGrid; error?: string }`.
