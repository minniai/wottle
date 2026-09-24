import type { TestDb } from "./harness";

/** Spec 070: players with a fresh tab in a lobby, for the challenge and presence tests. */
export class ChallengeFixtures {
  readonly players: string[] = [];
  constructor(private readonly db: TestDb) {}

  async players_(names: string[], lobby: "is" | "en" = "is"): Promise<string[]> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data, error } = await this.db.client
      .from("players")
      .insert(names.map((n) => ({ username: `t070c-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available", lobby_language: lobby })))
      .select("id, display_name");
    if (error || !data) throw new Error(`players.insert: ${error?.message}`);
    const ids = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
    this.players.push(...ids);
    for (const id of ids) await this.beat(id);
    return ids;
  }

  /** A visible tab with input just now; `hiddenFor` hides every tab that long. */
  async beat(player: string, opts: { hiddenForMs?: number; staleMs?: number } = {}): Promise<void> {
    const tab = crypto.randomUUID();
    const { error } = await this.db.client.rpc("beat_tab", { p_player: player, p_tab: tab, p_visible: !opts.hiddenForMs, p_input_ago_ms: 1_000, p_page: "lobby" });
    if (error) throw new Error(`beat_tab: ${error.message}`);
    if (opts.hiddenForMs) await this.db.client.from("presence_tabs").update({ hidden_since: new Date(Date.now() - opts.hiddenForMs).toISOString() }).eq("player_id", player);
    if (opts.staleMs) await this.db.client.from("presence_tabs").update({ beat_at: new Date(Date.now() - opts.staleMs).toISOString() }).eq("player_id", player);
  }

  async send(sender: string, recipient: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.db.client.rpc("send_challenge", { p_sender: sender, p_recipient: recipient });
    if (error) throw new Error(`send_challenge: ${error.message}`);
    return data as Record<string, unknown>;
  }

  async invite(id: string): Promise<Record<string, unknown>> {
    const { data } = await this.db.client.from("match_invitations").select("*").eq("id", id).single();
    return data as Record<string, unknown>;
  }

  async dropAll(): Promise<void> {
    const list = this.players.join(",");
    if (!list) return;
    const { data } = await this.db.client.from("matches").select("id").or(`player_a_id.in.(${list}),player_b_id.in.(${list})`);
    const ids = (data ?? []).map((r) => r.id as string);
    await this.db.client.from("match_invitations").delete().or(`sender_id.in.(${list}),recipient_id.in.(${list})`);
    if (ids.length) await this.db.client.from("matches").delete().in("id", ids);
    await this.db.client.from("presence_tabs").delete().in("player_id", this.players);
    await this.db.client.from("players").delete().in("id", this.players);
    this.players.length = 0;
  }
}
