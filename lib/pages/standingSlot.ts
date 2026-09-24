import type { MatchmakingState } from "@/lib/room/useMatchmaking";
import type { LinkCall, OutgoingLink } from "@/lib/types/link";
import type { IncomingCall, MatchFact, OutgoingChallenge, StandingFacts, SwitchPending } from "@/lib/types/standing";

import type { HeldOutcome } from "./heldOutcome";

/**
 * The one standing state the line slot shows (spec 070 FR-009, US4.2), by
 * precedence: a call (a challenge, then a link opened here), your match, a
 * lobby switch waiting for confirmation, your challenge (and its outcome, held
 * 4s), your link (spec 072), your search, a table-missed
 * notice, then nothing. Derived per render, never stored.
 */
export type SlotState =
  | { kind: "call"; call: IncomingCall; more: number; searching: boolean }
  /** Spec 072: a link opened by this signed-in player, held by their tab (research R6). */
  | { kind: "linkCall"; call: LinkCall; more: number }
  | { kind: "match"; match: MatchFact }
  | { kind: "switch"; pending: SwitchPending }
  | { kind: "sent"; outgoing: OutgoingChallenge | null; held: HeldOutcome | null }
  /** Spec 072: the viewer's link out, its held outcome, or their own link opened. */
  | { kind: "link"; link: OutgoingLink | null; held: LinkHeld | null; own: LinkCall | null }
  | { kind: "search"; search: MatchmakingState }
  | { kind: "notice"; notice: "table_missed" }
  | { kind: "empty" };

/** Search states that stand in the slot; `found`, `cancelled` and `error` do not. */
const STANDING_SEARCH = new Set<MatchmakingState["kind"]>(["searching", "paused", "stillSearching", "stopped", "cooldown"]);

/** A link's outcome, held 4s; a used link takes the viewer to the table instead. */
export type LinkHeld = "cancelled" | "expired";

export interface LinkInputs {
  call?: LinkCall | null;
  own?: LinkCall | null;
  held?: LinkHeld | null;
}

export interface SlotInputs {
  facts: StandingFacts | null;
  held: HeldOutcome | null;
  search: MatchmakingState | null;
  link?: LinkInputs;
}

const live = (call: LinkCall | null | undefined, nowMs: number): LinkCall | null =>
  call && Date.parse(call.view.expiresAt) > nowMs ? call : null;

function linkState(facts: StandingFacts | null, link: LinkInputs, nowMs: number): SlotState | null {
  const pending = facts?.link?.status === "pending" && Date.parse(facts.link.expiresAt) > nowMs ? facts.link : null;
  if (link.held) return { kind: "link", link: facts?.link ?? null, held: link.held, own: null };
  // The sender's own link, opened (T64): it is their one pending link, so it names that link.
  const own = live(link.own, nowMs);
  if (pending || own) return { kind: "link", link: pending, held: null, own };
  return null;
}

export function standingSlot({ facts, held, search, link = {} }: SlotInputs, nowMs = Date.now()): SlotState {
  const searching = Boolean(search && (search.kind === "searching" || search.kind === "stillSearching" || search.kind === "paused"));
  const linkCall = live(link.call, nowMs);
  const calls = (facts?.incoming.length ?? 0) + (linkCall ? 1 : 0);
  if (facts && facts.incoming.length > 0) return { kind: "call", call: facts.incoming[0], more: calls - 1, searching };
  if (linkCall) return { kind: "linkCall", call: linkCall, more: 0 };
  if (facts?.match) return { kind: "match", match: facts.match };
  if (facts?.switchPending) return { kind: "switch", pending: facts.switchPending };
  if (held) return { kind: "sent", outgoing: facts?.outgoing ?? null, held };
  if (facts?.outgoing?.status === "pending") return { kind: "sent", outgoing: facts.outgoing, held: null };
  const standingLink = linkState(facts, link, nowMs);
  if (standingLink) return standingLink;
  if (search && STANDING_SEARCH.has(search.kind)) return { kind: "search", search };
  if (facts?.notice) return { kind: "notice", notice: facts.notice };
  return { kind: "empty" };
}
