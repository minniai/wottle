/**
 * Spec 069 (T004): the table. Every match begins with both players sitting
 * down; the second seat writes the board and sets the start; a table that
 * does not fill, or that someone leaves, is void. Live local Supabase; skips
 * without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { blankBoard, connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
const LEAD_MS = 4_500;
const CLOCK_MS = 300_000;

describe.skipIf(!db)("the table (spec 069)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());
  const client = () => db!.client;

  const create = (a: string, b: string, origin = "queue", pressedBy: string[] = []) =>
    f.rpc("create_match_between", { p_a: a, p_b: b, p_language: "is", p_origin: origin, p_ref: null, p_pressed_by: pressedBy });
  const seat = (match: string, player: string) =>
    f.rpc("seat_player", { p_match: match, p_player: player, p_board: blankBoard(), p_lead_ms: LEAD_MS, p_clock_ms: CLOCK_MS });
  const voidTable = (match: string, reason: "not_seated" | "left", by: string | null) =>
    f.rpc("void_table", { p_match: match, p_reason: reason, p_by: by });
  const row = async (match: string) =>
    (await client().from("matches").select("*").eq("id", match).single()).data as Record<string, unknown>;
  const playerRow = async (id: string) =>
    (await client().from("players").select("status, queue_language, queued_at, search_paused, table_missed_at").eq("id", id).single()).data as Record<string, unknown>;
  const attend = (id: string, over: { visible?: boolean; inputAgoMs?: number; reportedAgoMs?: number } = {}) =>
    client()
      .from("players")
      .update({
        attention_visible: over.visible ?? true,
        attention_input_at: new Date(Date.now() - (over.inputAgoMs ?? 1_000)).toISOString(),
        attention_at: new Date(Date.now() - (over.reportedAgoMs ?? 500)).toISOString(),
      })
      .eq("id", id);
  const pastDeadline = (match: string) =>
    client().from("matches").update({ table_deadline_at: new Date(Date.now() - 1_000).toISOString() }).eq("id", match);
  const searching = async (id: string, queuedAgoMs: number) =>
    client().from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date(Date.now() - queuedAgoMs).toISOString(), last_seen_at: new Date().toISOString() }).eq("id", id);

  describe("create_match_between sets the table", () => {
    it("gives the table 20s and seats nobody without a press or attention", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const result = await create(a, b);
      expect(result).toMatchObject({ status: "created", seats: { a: false, b: false } });
      const m = await row(result.match_id as string);
      expect(m.state).toBe("pending");
      expect(m.board).toBeNull();
      expect(m.player_a_seated_at).toBeNull();
      const left = Date.parse(m.table_deadline_at as string) - Date.parse(m.created_at as string);
      expect(left).toBeGreaterThanOrEqual(19_000);
      expect(left).toBeLessThanOrEqual(21_000);
    });

    it("seats the player whose press created the match", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const result = await create(a, b, "challenge", [b]);
      expect(result.seats).toEqual({ a: false, b: true });
    });

    it("seats a player whose visible tab had input in the last 30s, and no other", async () => {
      const [fresh, hidden, idle, stale] = await f.players_(["Fresh", "Hidden", "Idle", "Stale"]);
      await attend(fresh);
      await attend(hidden, { visible: false });
      await attend(idle, { inputAgoMs: 31_000 });
      await attend(stale, { reportedAgoMs: 11_000 });
      expect((await create(fresh, hidden)).seats).toEqual({ a: true, b: false });
      expect((await create(idle, stale)).seats).toEqual({ a: false, b: false });
    });

    it("completes a table full at creation through start_table_if_seated", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const created = await create(a, b, "crossed_challenge", [a, b]);
      expect(created.seats).toEqual({ a: true, b: true });
      const started = await f.rpc("start_table_if_seated", { p_match: created.match_id, p_board: blankBoard(), p_lead_ms: LEAD_MS, p_clock_ms: CLOCK_MS });
      expect(started.status).toBe("started");
      expect((await row(created.match_id as string)).state).toBe("in_progress");
    });
  });

  describe("seat_player", () => {
    it("seats the first player and waits", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const match = (await create(a, b)).match_id as string;
      expect((await seat(match, a)).status).toBe("seated");
      const m = await row(match);
      expect(m.player_a_seated_at).not.toBeNull();
      expect(m.state).toBe("pending");
      expect(m.board).toBeNull();
      // Idempotent.
      expect((await seat(match, a)).status).toBe("seated");
    });

    it("the second seat writes the board and sets the start 4.5s ahead and the deadline 5:00 after it", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const match = (await create(a, b)).match_id as string;
      await seat(match, a);
      const result = await seat(match, b);
      expect(result.status).toBe("started");
      const m = await row(match);
      expect(m.state).toBe("in_progress");
      expect(m.board).toEqual(blankBoard());
      const lead = Date.parse(m.started_at as string) - Date.parse(result.serverNow as string);
      expect(lead).toBeGreaterThan(4_000);
      expect(lead).toBeLessThanOrEqual(4_600);
      expect(Date.parse(m.deadline_at as string) - Date.parse(m.started_at as string)).toBe(CLOCK_MS);
      expect((await seat(match, b)).status).toBe("started");
    });

    it("refuses a stranger, a late seat, and a void table", async () => {
      const [a, b, c] = await f.players_(["Anna", "Kari", "Embla"]);
      const match = (await create(a, b)).match_id as string;
      expect((await seat(match, c)).status).toBe("not_found");
      await pastDeadline(match);
      expect((await seat(match, a)).status).toBe("late");
      await voidTable(match, "not_seated", null);
      expect((await seat(match, a)).status).toBe("void");
    });
  });

  describe("void_table", () => {
    it("refuses a not-seated void before the deadline or with both seated", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const match = (await create(a, b)).match_id as string;
      expect((await voidTable(match, "not_seated", null)).status).toBe("not_due");
    });

    it("voids a queue table: nothing rated, the seated player requeued with their place, the absent one stopped", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      await searching(a, 60_000);
      await searching(b, 30_000);
      const queuedAt = (await playerRow(a)).queued_at as string;
      const match = (await f.rpc("pair_from_queue", { p_self: a, p_opponent: b, p_language: "is" })).match_id as string;
      await seat(match, a);
      await pastDeadline(match);
      const result = await voidTable(match, "not_seated", null);
      expect(result).toMatchObject({ status: "void", reason: "not_seated", voidedBy: b });

      const m = await row(match);
      expect(m).toMatchObject({ state: "completed", ended_reason: "void", void_reason: "not_seated", voided_by: b, winner_id: null });
      expect(m.completed_at).not.toBeNull();
      const { count } = await client().from("match_ratings").select("id", { count: "exact", head: true }).eq("match_id", match);
      expect(count).toBe(0);

      expect(await playerRow(a)).toMatchObject({ status: "matchmaking", queue_language: "is", search_paused: false, table_missed_at: null });
      expect(Date.parse((await playerRow(a)).queued_at as string)).toBe(Date.parse(queuedAt));
      const absent = await playerRow(b);
      expect(absent).toMatchObject({ status: "available", queue_language: null, queued_at: null });
      expect(absent.table_missed_at).not.toBeNull();
    });

    it("names nobody when neither sat, and stops both", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const match = (await create(a, b)).match_id as string;
      await pastDeadline(match);
      expect((await voidTable(match, "not_seated", null)).voidedBy).toBeNull();
      expect((await playerRow(a)).status).toBe("available");
      expect((await playerRow(b)).status).toBe("available");
    });

    it("a leave voids a pending table and records the leaver; a challenge table requeues nobody", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const match = (await create(a, b, "challenge", [b])).match_id as string;
      const result = await voidTable(match, "left", b);
      expect(result).toMatchObject({ status: "void", reason: "left", voidedBy: b });
      expect((await playerRow(a)).status).toBe("available");
      expect((await playerRow(b))).toMatchObject({ status: "available", table_missed_at: null });
    });

    it("a leave during the count voids a started match; after go it is refused", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      const match = (await create(a, b, "crossed_challenge", [a, b])).match_id as string;
      await f.rpc("start_table_if_seated", { p_match: match, p_board: blankBoard(), p_lead_ms: LEAD_MS, p_clock_ms: CLOCK_MS });
      expect((await voidTable(match, "left", a)).status).toBe("void");

      const [c, d] = await f.players_(["Embla", "Jonas"]);
      const live = (await create(c, d, "crossed_challenge", [c, d])).match_id as string;
      await f.rpc("start_table_if_seated", { p_match: live, p_board: blankBoard(), p_lead_ms: 0, p_clock_ms: CLOCK_MS });
      expect((await voidTable(live, "left", c)).status).toBe("not_pending");
      expect((await row(live)).state).toBe("in_progress");
    });

    it("refuses a leave by a stranger", async () => {
      const [a, b, c] = await f.players_(["Anna", "Kari", "Embla"]);
      const match = (await create(a, b)).match_id as string;
      expect((await voidTable(match, "left", c)).status).toBe("not_pending");
    });
  });

  it("find_due_tables returns pending tables past their deadline only", async () => {
    const [a, b, c, d] = await f.players_(["Anna", "Kari", "Embla", "Jonas"]);
    const due = (await create(a, b)).match_id as string;
    const fresh = (await create(c, d)).match_id as string;
    await pastDeadline(due);
    const { data } = await client().rpc("find_due_tables");
    const ids = (data as Array<{ match_id: string } | string>).map((r) => (typeof r === "string" ? r : r.match_id));
    expect(ids).toContain(due);
    expect(ids).not.toContain(fresh);
  });

  describe("table_leave_cooldown_until", () => {
    const leaveAt = async (a: string, b: string, agoMs: number) => {
      const match = await f.match(a, b, "completed");
      await client()
        .from("matches")
        .update({ ended_reason: "void", void_reason: "left", voided_by: a, completed_at: new Date(Date.now() - agoMs).toISOString(), player_a_seated_at: new Date().toISOString(), player_b_seated_at: new Date().toISOString() })
        .eq("id", match);
    };
    const until = async (p: string) => (await client().rpc("table_leave_cooldown_until", { p_player: p })).data as string | null;

    it("is null with no leave or one leave", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      expect(await until(a)).toBeNull();
      await leaveAt(a, b, 60_000);
      expect(await until(a)).toBeNull();
    });

    it("runs 5 minutes from the second of two leaves within 10 minutes", async () => {
      const [a, b] = await f.players_(["Anna", "Kari"]);
      await leaveAt(a, b, 8 * 60_000);
      await leaveAt(a, b, 60_000);
      const end = Date.parse((await until(a)) as string);
      expect(end - Date.now()).toBeGreaterThan(3.9 * 60_000);
      expect(end - Date.now()).toBeLessThanOrEqual(4 * 60_000 + 2_000);
      expect(await until(b)).toBeNull();
    });

    it("is null for two leaves 11 minutes apart, and once it has run out", async () => {
      const [a, b, c, d] = await f.players_(["Anna", "Kari", "Embla", "Jonas"]);
      await leaveAt(a, b, 12 * 60_000);
      await leaveAt(a, b, 60_000);
      expect(await until(a)).toBeNull();
      await leaveAt(c, d, 9 * 60_000);
      await leaveAt(c, d, 6 * 60_000);
      expect(await until(c)).toBeNull();
    });
  });

  describe("pair_from_queue skips a ghost", () => {
    it("refuses a paused or stale candidate", async () => {
      const [a, b, c] = await f.players_(["Anna", "Kari", "Embla"]);
      await searching(a, 10_000);
      await searching(b, 20_000);
      await searching(c, 30_000);
      await client().from("players").update({ search_paused: true }).eq("id", b);
      await client().from("players").update({ last_seen_at: new Date(Date.now() - 12_000).toISOString() }).eq("id", c);
      expect((await f.rpc("pair_from_queue", { p_self: a, p_opponent: b, p_language: "is" })).status).toBe("not_searching");
      expect((await f.rpc("pair_from_queue", { p_self: a, p_opponent: c, p_language: "is" })).status).toBe("not_searching");
    });
  });
});
