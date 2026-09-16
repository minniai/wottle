-- Spec 047 FR-005 (review S5, 16 September 2026): compare-and-set for
-- matches.frozen_tiles.
--
-- app/actions/match/publishRoundSummary.ts has called this function since
-- spec 042 (FR-027), but no migration ever created it, so every call failed
-- with "function not found" and the code fell back to a plain UPDATE. That
-- fallback wrote `baseline ∪ this round` unconditionally: any writer holding a
-- stale baseline (a late instant-scoring pass, a stuck-round recovery) erased
-- earlier rounds' freezes, the letters became swappable again, and the bands
-- for those rounds no longer spelled their words.
--
-- The UPDATE succeeds only while the stored map still equals the caller's
-- baseline (jsonb equality is structural, so key order is irrelevant). Returns
-- the number of rows written: 1 on success, 0 when the baseline is stale. The
-- caller reloads and retries once; it never writes blindly.
--
-- security definer with an empty search_path, executable by service_role only:
-- the browser's anon role must not be able to move a freeze.

create or replace function public.update_frozen_tiles_if_unchanged(
  p_match_id uuid,
  p_new_frozen_tiles jsonb,
  p_previous_frozen_tiles jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  update public.matches
     set frozen_tiles = p_new_frozen_tiles,
         updated_at = now()
   where id = p_match_id
     and coalesce(frozen_tiles, '{}'::jsonb) = coalesce(p_previous_frozen_tiles, '{}'::jsonb);
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.update_frozen_tiles_if_unchanged(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_frozen_tiles_if_unchanged(uuid, jsonb, jsonb) to service_role;

comment on function public.update_frozen_tiles_if_unchanged(uuid, jsonb, jsonb) is
  'Compare-and-set for matches.frozen_tiles (spec 042 FR-027, created in spec 047). Returns rows written: 1, or 0 when the baseline is stale.';
