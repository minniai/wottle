-- Rematch & Post-Game Loop (016)
-- Adds rematch_requests table and matches.rematch_of column

-- rematch_requests: one per completed match (UNIQUE on match_id)
CREATE TABLE rematch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES players(id),
  responder_id uuid NOT NULL REFERENCES players(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  new_match_id uuid REFERENCES matches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT one_request_per_match UNIQUE (match_id)
);

-- Index for looking up requests by match
CREATE INDEX idx_rematch_requests_match_id ON rematch_requests(match_id);

-- matches.rematch_of: links a rematch to the match it was created from
ALTER TABLE matches ADD COLUMN rematch_of uuid REFERENCES matches(id);

-- Partial index for non-null rematch_of (series chain walking)
CREATE INDEX idx_matches_rematch_of ON matches(rematch_of) WHERE rematch_of IS NOT NULL;

-- RLS: rematch_requests readable by participants
ALTER TABLE rematch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own rematch requests"
  ON rematch_requests
  FOR SELECT
  USING (
    requester_id = auth.uid() OR responder_id = auth.uid()
  );
