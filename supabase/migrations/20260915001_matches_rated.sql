-- Spec 045 decision 1 (15 September 2026): directory challenges are unranked.
--
-- Choosing your own opponent should not move a rating, so a match now carries
-- whether it counts. Additive with a `true` default, so every existing row and
-- every queue match keeps exactly today's behaviour and no backfill is needed.
--
-- Written once at creation (lib/matchmaking/service.ts bootstrapMatchRecord) and
-- never changed; read by completeMatch before the Elo step and by loadMatchState
-- for the ledger's caption.

alter table public.matches
  add column if not exists rated boolean not null default true;

comment on column public.matches.rated is
  'False for directory challenges: no rating change, captions read unranked. Set at creation, never updated.';
