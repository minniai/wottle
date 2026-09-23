/**
 * Spec 067: players, challenges and rematch requests for the match-creation
 * functions' tests. Every row is tracked and dropped by `dropAll`.
 */
import type { TestDb } from "./harness";

export type Rpc = Record<string, unknown> & { status: string };

export class Fixtures {
  private players: string[] = [];

  constructor(private readonly db: TestDb) {}

  async players_(names: string[], status: "available" | "matchmaking" = "available", queueLanguage: "is" | "en" | null = null): Promise<string[]> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const rows = names.map((n) => ({
      username: `t067-${n.toLowerCase()}-${suffix}`,
      display_name: n,
      status,
      queue_language: status === "matchmaking" ? queueLanguage ?? "is" : null,
    }));
    const { data, error } = await this.db.client.from("players").insert(rows).select("id, display_name");
    if (error || !data) throw new Error(`players.insert: ${error?.message}`);
    const ids = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
    this.players.push(...ids);
    await this.db.client.from("lobby_presence").insert(
      ids.map((id) => ({ player_id: id, connection_id: crypto.randomUUID(), mode: "direct_invite", expires_at: new Date(Date.now() + 300_000).toISOString() })),
    );
    return ids;
  }

  async invite(senderId: string, recipientId: string, options: { ageMs?: number; language?: "is" | "en" } = {}): Promise<string> {
    const { data, error } = await this.db.client
      .from("match_invitations")
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        status: "pending",
        language: options.language ?? "is",
        created_at: new Date(Date.now() - (options.ageMs ?? 0)).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`match_invitations.insert: ${error?.message}`);
    return data.id as string;
  }

  /** A match between two players, in the given state; completed ones can be rematched. */
  async match(a: string, b: string, state: "pending" | "in_progress" | "completed", language: "is" | "en" = "is"): Promise<string> {
    const { data, error } = await this.db.client
      .from("matches")
      .insert({ board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state, language })
      .select("id")
      .single();
    if (error || !data) throw new Error(`matches.insert: ${error?.message}`);
    return data.id as string;
  }

  async rematchRequest(matchId: string, requesterId: string, responderId: string, ageMs = 0): Promise<string> {
    const { data, error } = await this.db.client
      .from("rematch_requests")
      .insert({ match_id: matchId, requester_id: requesterId, responder_id: responderId, status: "pending", created_at: new Date(Date.now() - ageMs).toISOString() })
      .select("id")
      .single();
    if (error || !data) throw new Error(`rematch_requests.insert: ${error?.message}`);
    return data.id as string;
  }

  async rpc(name: string, args: Record<string, unknown>): Promise<Rpc> {
    const { data, error } = await this.db.client.rpc(name, args);
    if (error) throw new Error(`${name}: ${error.message}`);
    return data as Rpc;
  }

  async statusOf(table: "match_invitations" | "rematch_requests", id: string): Promise<string> {
    const { data } = await this.db.client.from(table).select("status").eq("id", id).single();
    return data?.status as string;
  }

  async player(id: string): Promise<{ status: string; queue_language: string | null }> {
    const { data } = await this.db.client.from("players").select("status, queue_language").eq("id", id).single();
    return data as { status: string; queue_language: string | null };
  }

  async liveMatchesOf(id: string): Promise<number> {
    const { count } = await this.db.client
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(`player_a_id.eq.${id},player_b_id.eq.${id}`)
      .in("state", ["pending", "in_progress"]);
    return count ?? 0;
  }

  async dropAll(): Promise<void> {
    if (!this.players.length) return;
    const ids = this.players;
    const or = `player_a_id.in.(${ids.join(",")}),player_b_id.in.(${ids.join(",")})`;
    const { data: matches } = await this.db.client.from("matches").select("id").or(or);
    const matchIds = (matches ?? []).map((m) => m.id as string);
    await this.db.client.from("match_invitations").delete().in("sender_id", ids);
    if (matchIds.length) {
      await this.db.client.from("rematch_requests").delete().in("match_id", matchIds);
      await this.db.client.from("matches").update({ rematch_of: null }).in("id", matchIds);
      await this.db.client.from("matches").delete().in("id", matchIds);
    }
    await this.db.client.from("players").delete().in("id", ids);
    this.players = [];
  }
}
