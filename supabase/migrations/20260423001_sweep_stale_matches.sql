-- Stale "in match" cleanup (issue #180).
-- Adds 'abandoned' to matches.ended_reason, ships the SQL fn used by
-- the /api/cron/sweep-stale-matches route, and (where pg_cron is
-- available) schedules the sweep every 30 seconds via pg_net.
-- pg_cron + pg_net are Supabase Cloud features; the schedule block is
-- guarded so local Supabase (no pg_cron) does not break migrations.

-- 1. Extend matches.ended_reason CHECK to allow 'abandoned'.
alter table public.matches
  drop constraint if exists matches_ended_reason_check;

alter table public.matches
  add constraint matches_ended_reason_check
  check (
    ended_reason is null
    or ended_reason in (
      'round_limit',
      'timeout',
      'disconnect',
      'forfeit',
      'draw',
      'abandoned'
    )
  );

-- 2. find_orphaned_matches() — returns ids of in_progress matches where
--    neither player has a live lobby_presence row.
create or replace function public.find_orphaned_matches()
returns setof uuid
language sql
stable
as $$
  select m.id
  from public.matches m
  where m.state = 'in_progress'
    and not exists (
      select 1
      from public.lobby_presence lp
      where lp.player_id in (m.player_a_id, m.player_b_id)
        and lp.expires_at > now()
    );
$$;

comment on function public.find_orphaned_matches() is
  'Issue #180: matches stuck in_progress with no live presence for either player. Consumed by /api/cron/sweep-stale-matches.';

-- 3. Schedule the sweep — guarded so local environments without
--    pg_cron/pg_net do not fail. Production Supabase Cloud has both.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  -- Unschedule any prior version (idempotent re-runs).
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'sweep-stale-matches';

  perform cron.schedule(
    'sweep-stale-matches',
    '*/30 * * * * *',
    $cron$
      select net.http_post(
        url := current_setting('app.app_url', true) || '/api/cron/sweep-stale-matches',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
exception
  when undefined_file then
    raise notice 'pg_cron/pg_net unavailable in this environment; skipping schedule. Function find_orphaned_matches() is still available for direct invocation.';
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;
