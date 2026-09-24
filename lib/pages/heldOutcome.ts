import type { Outcome } from "@/lib/types/standing";

/** What became of the viewer's challenge, held 4s on the row and in the slot (spec 070 US3.4). */
export interface HeldOutcome {
  inviteId: string;
  playerId: string;
  name: string;
  outcome: Outcome;
}
