import "server-only";

import { randomUUID } from "node:crypto";

import { bootstrapMatchRecord } from "@/lib/matchmaking/service";
import type { Language } from "@/lib/types/game-config";

type AnyClient = Parameters<typeof bootstrapMatchRecord>[0];

/** A rematch is played in the language of the match it follows (spec 060 FR-013). */
export async function createRematchMatch(
  client: AnyClient,
  input: { matchId: string; playerAId: string; playerBId: string },
): Promise<string> {
  const { data } = await client.from("matches").select("language").eq("id", input.matchId).maybeSingle();
  const language = ((data as { language?: Language } | null)?.language ?? "is") as Language;
  return bootstrapMatchRecord(client, {
    boardSeed: randomUUID(),
    playerAId: input.playerAId,
    playerBId: input.playerBId,
    rematchOf: input.matchId,
    language,
  });
}
