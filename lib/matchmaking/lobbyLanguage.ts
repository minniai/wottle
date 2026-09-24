import "server-only";

import { z } from "zod";

import { pokeLobby, pokePlayers } from "@/lib/realtime/pokes";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LobbyLanguage, SwitchPending } from "@/lib/types/standing";

/**
 * One lobby language per player (spec 070 US7, research R4). Entering a lobby
 * switches at once with nothing out; with a search or a challenge out the
 * page asks first, and confirming cancels them (clarification Q1).
 */
const enterReplySchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["same", "switched", "invalid"]) }),
  z.object({ status: z.literal("needs_confirm"), pending: z.array(z.enum(["search", "outgoing", "incoming", "link"])), from: z.enum(["is", "en"]) }),
]);

export type EnterLobbyResult = { status: "same" | "switched" } | { status: "needs_confirm"; pending: SwitchPending };

export async function enterLobby(playerId: string, language: LobbyLanguage): Promise<EnterLobbyResult> {
  const { data, error } = await getServiceRoleClient().rpc("enter_lobby", { p_player: playerId, p_language: language });
  if (error) throw new Error(`enter_lobby: ${error.message}`);
  const reply = enterReplySchema.parse(data);
  if (reply.status === "needs_confirm") return { status: "needs_confirm", pending: { to: language, from: reply.from, pending: reply.pending } };
  if (reply.status === "switched") await pokeLobby(language);
  return { status: reply.status === "invalid" ? "same" : reply.status };
}

const confirmReplySchema = z.object({ status: z.literal("switched"), counterparts: z.array(z.string().uuid()) });

export async function confirmLobbySwitch(playerId: string, language: LobbyLanguage): Promise<void> {
  const { data, error } = await getServiceRoleClient().rpc("confirm_lobby_switch", { p_player: playerId, p_language: language });
  if (error) throw new Error(`confirm_lobby_switch: ${error.message}`);
  const reply = confirmReplySchema.parse(data);
  console.log(JSON.stringify({ event: "lobby.switch", playerId, to: language, cancelled: reply.counterparts.length }));
  await Promise.all([pokePlayers(reply.counterparts, "outcome"), pokeLobby("is"), pokeLobby("en")]);
}
