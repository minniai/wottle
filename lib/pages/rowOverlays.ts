import type { Copy } from "@/lib/i18n/copy/types";
import { formatClock } from "@/lib/room/clock";
import type { StandingFacts } from "@/lib/types/standing";

import type { HeldOutcome } from "./heldOutcome";

export interface RowOverlay {
  status?: string;
  action?: "none" | { againUntilMs: number } | { error: string };
}

/**
 * What the viewer's standing writes on the lobby's rows (B3–B5, B8): the one
 * challenged reads `sent · 0:52`, a held outcome shows for its 4s, a declined
 * pair counts its cooldown down, a caller reads `challenges you`, and while
 * the viewer's match runs no row offers a challenge. Only the row carries it.
 */
export function rowOverlays(facts: StandingFacts | null, held: HeldOutcome | null, nowMs: number, copy: Copy): Map<string, RowOverlay> {
  const map = new Map<string, RowOverlay>();
  if (!facts) return map;
  for (const c of facts.cooldowns) map.set(c.playerId, { action: { againUntilMs: Date.parse(c.until) } });
  const out = facts.outgoing;
  if (out?.status === "pending") map.set(out.to.playerId, { status: copy.pages.rowSent(formatClock(Math.max(0, Date.parse(out.expiresAt) - nowMs))), action: "none" });
  if (held) map.set(held.playerId, { ...map.get(held.playerId), status: copy.pages.OUTCOMES[held.outcome] });
  for (const call of facts.incoming) map.set(call.from.playerId, { status: copy.CHALLENGES_YOU, action: "none" });
  return map;
}

/** While the viewer's match runs, or they sit at a table, nobody can be challenged from the lobby (B8). */
export function challengesClosed(facts: StandingFacts | null): boolean {
  return Boolean(facts?.match && facts.match.kind !== "over");
}
