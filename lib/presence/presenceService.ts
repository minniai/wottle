import "server-only";

import { z } from "zod";

import { pokeLobby } from "@/lib/realtime/pokes";
import { HEARTBEAT_HIDDEN_MS, HEARTBEAT_VISIBLE_MS, LEAVING_RECHECK_MS } from "@/lib/presence/constants";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { lobbyLanguageSchema, presencePageSchema, presenceStateSchema, type LobbyLanguage, type PresencePage, type PresenceState } from "@/lib/types/standing";

/**
 * Presence per tab (spec 070 US6, research R1). The only TypeScript caller of
 * `beat_tab`, `leave_tab`, `beat_match_from_page`, `player_presence` and `lobby_counts`. The database
 * decides every state; this module parses and logs.
 */

export const beatInputSchema = z.object({
  tabId: z.string().uuid(),
  visible: z.boolean(),
  inputAgoMs: z.number().int().min(0).max(86_400_000).nullable(),
  page: presencePageSchema,
});
export type BeatInput = z.infer<typeof beatInputSchema>;

const beatRowSchema = z.object({ transition: z.boolean(), language: lobbyLanguageSchema });

export interface BeatResult {
  transition: boolean;
  language: LobbyLanguage;
}

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

export async function beat(playerId: string, input: BeatInput): Promise<BeatResult> {
  const { data, error } = await getServiceRoleClient().rpc("beat_tab", {
    p_player: playerId,
    p_tab: input.tabId,
    p_visible: input.visible,
    p_input_ago_ms: input.inputAgoMs,
    p_page: input.page,
  });
  if (error) throw new Error(`beat_tab: ${error.message}`);
  const row = beatRowSchema.parse((data as unknown[])[0]);
  if (input.page !== "match") await keepMatchBeat(playerId, input.visible);
  if (row.transition) {
    log("presence.transition", { playerId, visible: input.visible });
    await pokeLobby(row.language);
  }
  return row;
}

/** A player in a live match on another page has stepped out, not gone (spec 070 US8). */
async function keepMatchBeat(playerId: string, visible: boolean): Promise<void> {
  const { error } = await getServiceRoleClient().rpc("beat_match_from_page", {
    p_player: playerId,
    p_cadence_ms: visible ? HEARTBEAT_VISIBLE_MS : HEARTBEAT_HIDDEN_MS,
  });
  if (error) log("presence.match_beat.failed", { playerId, error: error.message });
}

export async function leave(playerId: string, tabId: string): Promise<void> {
  const client = getServiceRoleClient();
  const { error } = await client.rpc("leave_tab", { p_player: playerId, p_tab: tabId });
  if (error) throw new Error(`leave_tab: ${error.message}`);
  const { data } = await client.from("players").select("lobby_language").eq("id", playerId).maybeSingle();
  const language = lobbyLanguageSchema.safeParse(data?.lobby_language ?? "is");
  await pokeLobby(language.success ? language.data : "is", { recheckInMs: LEAVING_RECHECK_MS });
}

const presenceRowSchema = z.object({
  player_id: z.string().uuid(),
  state: presenceStateSchema,
  moves_played: z.number().int().nullable(),
  queued: z.boolean(),
});

export interface PresenceRow {
  playerId: string;
  state: PresenceState;
  movesPlayed: number | null;
}

export async function playerPresence(language: LobbyLanguage): Promise<PresenceRow[]> {
  const { data, error } = await getServiceRoleClient().rpc("player_presence", { p_language: language });
  if (error) throw new Error(`player_presence: ${error.message}`);
  return z.array(presenceRowSchema).parse(data).map((r) => ({ playerId: r.player_id, state: r.state, movesPlayed: r.moves_played }));
}

const countsRowSchema = z.object({ here: z.number(), searching: z.number(), players_in_match: z.number(), matches_on: z.number() });

export interface LobbyNumbers {
  here: number;
  searching: number;
  playersInMatch: number;
  matchesOn: number;
}

export async function lobbyNumbers(language: LobbyLanguage): Promise<LobbyNumbers> {
  const { data, error } = await getServiceRoleClient().rpc("lobby_counts", { p_language: language });
  if (error) throw new Error(`lobby_counts: ${error.message}`);
  const row = countsRowSchema.parse((data as unknown[])[0]);
  return { here: row.here, searching: row.searching, playersInMatch: row.players_in_match, matchesOn: row.matches_on };
}

export type { PresencePage };
