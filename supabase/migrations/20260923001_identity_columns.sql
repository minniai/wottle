-- Spec 067: identity, and one commitment at a time. Additive.
-- The columns and statuses the claim (players) and the one way to make a match
-- (matches, challenges, rematch requests) stand on. The functions follow in
-- 20260923002 (match creation), 20260923003 (claim) and 20260923004 (sign-out).

-- A name belongs to the browser whose device key hashes to claim_hash. One key
-- may claim several names; the latest last_entered_at is the one it renews as.
alter table public.players
  add column if not exists claim_hash text,
  add column if not exists claimed_at timestamptz,
  add column if not exists last_entered_at timestamptz;

create index if not exists players_claim_hash_idx
  on public.players (claim_hash, last_entered_at desc)
  where claim_hash is not null;

comment on column public.players.claim_hash is
  'Spec 067: hex SHA-256 of the device key that owns this name. Null = unclaimed. Written by enter_player only.';

-- How a match came about, and what caused it (an invite, a rematch request, later a link).
alter table public.matches
  add column if not exists origin text
    constraint matches_origin_check
    check (origin in ('queue', 'challenge', 'crossed_challenge', 'rematch', 'crossed_rematch', 'link')),
  add column if not exists origin_ref uuid;

comment on column public.matches.origin is
  'Spec 067: written only by create_match_between. Null for matches created before it.';

-- A challenge or rematch request can now be withdrawn by its sender's other
-- commitment, or superseded when its recipient is booked elsewhere.
alter table public.match_invitations drop constraint if exists match_invitations_status_check;
alter table public.match_invitations add constraint match_invitations_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired', 'withdrawn', 'superseded'));

alter table public.rematch_requests drop constraint if exists rematch_requests_status_check;
alter table public.rematch_requests add constraint rematch_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired', 'withdrawn', 'superseded'));

-- Sending a challenge used to mark the sender 'matchmaking' with no queue
-- language. Sending no longer writes the sender's status, so free the ones it
-- stranded: otherwise nobody can challenge them and the queue never pairs them.
update public.players
  set status = 'available'
  where status = 'matchmaking' and queue_language is null;
