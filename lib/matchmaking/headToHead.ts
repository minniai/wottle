import "server-only";

import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { HeadToHead, LobbyLanguage } from "@/lib/types/standing";

const rowSchema = z.object({ opponent_id: z.string().uuid(), wins: z.number(), losses: z.number(), draws: z.number() });

/** The viewer's record against everyone they have played in this language (FR-038a): one query per lobby view. */
export async function headToHead(viewerId: string, language: LobbyLanguage): Promise<Map<string, HeadToHead>> {
  const { data, error } = await getServiceRoleClient().rpc("head_to_head", { p_viewer: viewerId, p_language: language });
  if (error) throw new Error(`head_to_head: ${error.message}`);
  return new Map(z.array(rowSchema).parse(data ?? []).map((r) => [r.opponent_id, { wins: r.wins, losses: r.losses, draws: r.draws }]));
}
