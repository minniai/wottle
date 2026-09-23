import "server-only";

/**
 * What the table left behind for a player (spec 069): the cooldown after two
 * leaves, and, once, the notice that they did not sit down.
 */
export interface TableStatus {
  cooldownUntil: string | null;
  notice: "table_missed" | null;
}

type AnyClient = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export async function readCooldownUntil(client: AnyClient, playerId: string): Promise<string | null> {
  const { data, error } = await client.rpc("table_leave_cooldown_until", { p_player: playerId });
  if (error) throw new Error(`table_leave_cooldown_until: ${error.message}`);
  return (data as string | null) ?? null;
}

/** Read the missed-table mark and clear it: the notice is said once (FR-017). */
async function takeMissedNotice(client: AnyClient, playerId: string): Promise<TableStatus["notice"]> {
  const { data } = await client.from("players").update({ table_missed_at: null }).eq("id", playerId).not("table_missed_at", "is", null).select("id");
  return Array.isArray(data) && data.length > 0 ? "table_missed" : null;
}

export async function readTableStatus(client: AnyClient, playerId: string): Promise<TableStatus> {
  const [cooldownUntil, notice] = await Promise.all([readCooldownUntil(client, playerId), takeMissedNotice(client, playerId)]);
  return { cooldownUntil, notice };
}
