"use server";

import "server-only";

import { z } from "zod";

import { cancelLink } from "@/lib/matchmaking/linkService";
import { readLobbySession } from "@/lib/matchmaking/profile";

const inputSchema = z.object({ linkId: z.string().uuid() });

export type CancelLinkActionResult = { status: "cancelled" | "not_pending" | "unauthenticated" | "error" };

/**
 * `cancel link ▸` (spec 072 FR-007): the link stops working at once.
 *
 * @param input `{ linkId }`, the viewer's own link.
 * @returns `cancelled`; `not_pending` when it was not the viewer's pending link.
 */
export async function cancelLinkAction(input: z.input<typeof inputSchema>): Promise<CancelLinkActionResult> {
  const session = await readLobbySession();
  if (!session) return { status: "unauthenticated" };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };
  try {
    return await cancelLink(session.player.id, parsed.data.linkId);
  } catch (error) {
    console.error(JSON.stringify({ event: "link.cancel.failed", error: error instanceof Error ? error.message : String(error) }));
    return { status: "error" };
  }
}
