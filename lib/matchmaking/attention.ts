import { z } from "zod";

/**
 * A tab's attention (spec 069 R5): whether it is visible and how long since
 * its last input. The server seats a player at creation when the report is
 * fresh, visible, and the input is within 30s. Stage 4's presence heartbeat
 * will write the same columns.
 */
export interface Attention {
  visible: boolean;
  inputAgoMs: number;
}

/** An input older than this says the same as none: nothing recent. */
const MAX_INPUT_AGO_MS = 600_000;

const querySchema = z.object({
  visible: z.enum(["0", "1"]),
  inputAgoMs: z.coerce.number().int().nonnegative(),
});

export function attentionFromQuery(params: URLSearchParams): Attention | null {
  const parsed = querySchema.safeParse({ visible: params.get("visible"), inputAgoMs: params.get("inputAgoMs") });
  return parsed.success ? { visible: parsed.data.visible === "1", inputAgoMs: parsed.data.inputAgoMs } : null;
}

export function attentionQuery(attention: Attention): string {
  return `visible=${attention.visible ? 1 : 0}&inputAgoMs=${Math.round(attention.inputAgoMs)}`;
}

type PlayersClient = { from: (table: "players") => { update: (row: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }> } } };

export async function recordAttention(client: PlayersClient, playerId: string, attention: Attention): Promise<void> {
  const now = Date.now();
  const ago = Math.min(MAX_INPUT_AGO_MS, Math.max(0, attention.inputAgoMs));
  const { error } = await client
    .from("players")
    .update({ attention_visible: attention.visible, attention_input_at: new Date(now - ago).toISOString(), attention_at: new Date(now).toISOString() })
    .eq("id", playerId);
  if (error) console.warn(JSON.stringify({ event: "attention.record_failed", playerId, error: error.message }));
}
