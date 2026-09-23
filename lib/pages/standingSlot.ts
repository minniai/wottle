import type { MatchmakingState } from "@/lib/room/useMatchmaking";
import type { IncomingCall, MatchFact, OutgoingChallenge, StandingFacts, SwitchPending } from "@/lib/types/standing";

import type { HeldOutcome } from "./heldOutcome";

/**
 * The one standing state the line slot shows (spec 070 FR-009, US4.2), by
 * precedence: a call, your match, a lobby switch waiting for confirmation,
 * your challenge (and its outcome, held 4s), your search, a table-missed
 * notice, then nothing. Derived per render, never stored.
 */
export type SlotState =
  | { kind: "call"; call: IncomingCall; more: number; searching: boolean }
  | { kind: "match"; match: MatchFact }
  | { kind: "switch"; pending: SwitchPending }
  | { kind: "sent"; outgoing: OutgoingChallenge | null; held: HeldOutcome | null }
  | { kind: "search"; search: MatchmakingState }
  | { kind: "notice"; notice: "table_missed" }
  | { kind: "empty" };

/** Search states that stand in the slot; `found`, `cancelled` and `error` do not. */
const STANDING_SEARCH = new Set<MatchmakingState["kind"]>(["searching", "paused", "stillSearching", "stopped", "cooldown"]);

export interface SlotInputs {
  facts: StandingFacts | null;
  held: HeldOutcome | null;
  search: MatchmakingState | null;
}

export function standingSlot({ facts, held, search }: SlotInputs): SlotState {
  const searching = Boolean(search && (search.kind === "searching" || search.kind === "stillSearching" || search.kind === "paused"));
  if (facts && facts.incoming.length > 0) return { kind: "call", call: facts.incoming[0], more: facts.incoming.length - 1, searching };
  if (facts?.match) return { kind: "match", match: facts.match };
  if (facts?.switchPending) return { kind: "switch", pending: facts.switchPending };
  if (held) return { kind: "sent", outgoing: facts?.outgoing ?? null, held };
  if (facts?.outgoing?.status === "pending") return { kind: "sent", outgoing: facts.outgoing, held: null };
  if (search && STANDING_SEARCH.has(search.kind)) return { kind: "search", search };
  if (facts?.notice) return { kind: "notice", notice: facts.notice };
  return { kind: "empty" };
}
