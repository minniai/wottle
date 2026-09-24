import "server-only";

import { createHmac } from "node:crypto";

import { requireSessionSecret } from "@/lib/auth/sessionSecret";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { Language } from "@/lib/types/game-config";

/**
 * Payload-free pokes (spec 070 FR-034, research R6). A poke says only that
 * something about a player, or a lobby, changed; the tab re-reads the facts
 * from an authenticated route and never navigates on anything it carries.
 * A player's topic is an HMAC of their id, so another player cannot listen
 * on it. Delivery is best-effort: the fallback poll covers a lost poke.
 */
export type PlayerPokeKind = "challenge" | "outcome" | "table" | "seat" | "rematch" | "match" | "link";

const TOPIC_HEX = 32;

export function topicFor(playerId: string): string {
  const mac = createHmac("sha256", requireSessionSecret()).update(`player:${playerId}`).digest("hex");
  return `player:${mac.slice(0, TOPIC_HEX)}`;
}

async function send(topic: string, event: string, payload: Record<string, number>): Promise<void> {
  // A poke is a hint to re-read; it never fails the act that sent it.
  try {
    const supabase = getServiceRoleClient();
    const channel = supabase.channel(topic);
    try {
      const result = await channel.httpSend(event, payload);
      if (!result.success) logFailure(topic, event, `status ${result.status}`);
    } finally {
      void supabase.removeChannel(channel);
    }
  } catch (error) {
    logFailure(topic, event, error instanceof Error ? error.message : String(error));
  }
}

function logFailure(topic: string, event: string, reason: string): void {
  console.error(JSON.stringify({ event: "poke.failed", topic: topic.split(":")[0], kind: event, reason }));
}

export async function pokePlayer(playerId: string, kind: PlayerPokeKind): Promise<void> {
  await send(topicFor(playerId), kind, {});
}

export async function pokePlayers(playerIds: readonly string[], kind: PlayerPokeKind): Promise<void> {
  await Promise.all([...new Set(playerIds)].map((id) => pokePlayer(id, kind)));
}

export async function pokeLobby(language: Language, opts: { recheckInMs?: number } = {}): Promise<void> {
  await send(`lobby:${language}`, "presence", opts.recheckInMs ? { recheckInMs: opts.recheckInMs } : {});
}
