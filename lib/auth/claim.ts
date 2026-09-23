import "server-only";

import { z } from "zod";

import type { SessionPlayer } from "@/lib/matchmaking/profile";

/** The name belongs to another browser's device key (spec 067 FR-005). */
export class NameTakenError extends Error {
  constructor(username: string) {
    super(`The name ${username} is taken.`);
    this.name = "NameTakenError";
  }
}

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

const playerSchema = z.object({ id: z.string().uuid(), username: z.string(), display_name: z.string() });
const replySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("entered"), player: playerSchema }),
  z.object({ status: z.literal("name_taken") }),
  z.object({ status: z.literal("unknown") }),
]);

/** Claims the name for this browser's key, or lets that key back in; throws NameTakenError otherwise. */
export async function enterPlayer(
  client: RpcClient,
  input: { username: string; displayName: string; claimHash: string },
): Promise<SessionPlayer> {
  const reply = await call(client, "enter_player", { p_username: input.username, p_display_name: input.displayName, p_claim_hash: input.claimHash });
  if (reply.status !== "entered") {
    console.warn(JSON.stringify({ event: "auth.claim.name_taken", username: input.username }));
    throw new NameTakenError(input.username);
  }
  console.info(JSON.stringify({ event: "auth.claim.entered", playerId: reply.player.id }));
  return toSessionPlayer(reply.player);
}

/** The player this key entered as most recently, or null when it claims no name. */
export async function resolveClaim(client: RpcClient, claimHash: string): Promise<SessionPlayer | null> {
  const reply = await call(client, "resolve_claim", { p_claim_hash: claimHash });
  return reply.status === "entered" ? toSessionPlayer(reply.player) : null;
}

async function call(client: RpcClient, fn: string, args: Record<string, unknown>): Promise<z.infer<typeof replySchema>> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  const parsed = replySchema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn}: unexpected reply ${JSON.stringify(data)}`);
  return parsed.data;
}

function toSessionPlayer(row: z.infer<typeof playerSchema>): SessionPlayer {
  return { id: row.id, username: row.username, displayName: row.display_name };
}
