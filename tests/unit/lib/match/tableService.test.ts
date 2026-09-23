import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Mock } from "vitest";

import { leaveTable, seatPlayer, startTableIfSeated, voidDueTable } from "@/lib/match/tableService";
import { TABLE_LEAD_MS } from "@/lib/constants/table";

const ROW = { id: "m1", board_seed: "seed-1", language: "en" };

function deps(replies: Record<string, unknown>): { client: never; publish: Mock; rpc: Mock } {
  const rpc = vi.fn(async (fn: string) => ({ data: replies[fn], error: null }));
  const single = vi.fn(async () => ({ data: ROW, error: null }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: single }) }) }));
  const publish = vi.fn(async () => {});
  return { client: { rpc, from } as never, publish, rpc };
}

const logs = () => (console.info as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => JSON.parse(c[0] as string));

describe("the table service (spec 069 T008)", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("seats with the match's starting board, the 4.5s lead and the clock, and publishes", async () => {
    const d = deps({ seat_player: { status: "seated" } });
    await expect(seatPlayer(d, "m1", "p1")).resolves.toEqual({ status: "seated" });
    const [fn, args] = d.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("seat_player");
    expect(args).toMatchObject({ p_match: "m1", p_player: "p1", p_lead_ms: TABLE_LEAD_MS, p_clock_ms: 300_000 });
    expect(args.p_board).toHaveLength(10);
    expect(d.publish).toHaveBeenCalledWith("m1");
    expect(logs()).toContainEqual(expect.objectContaining({ event: "table.seated", matchId: "m1", playerId: "p1" }));
  });

  it("reports the start and logs it", async () => {
    const d = deps({ seat_player: { status: "started", startedAt: "2026-09-23T12:00:04.500Z", deadlineAt: "2026-09-23T12:05:04.500Z", serverNow: "2026-09-23T12:00:00.000Z" } });
    await expect(seatPlayer(d, "m1", "p2")).resolves.toMatchObject({ status: "started", startedAt: "2026-09-23T12:00:04.500Z" });
    expect(logs()).toContainEqual(expect.objectContaining({ event: "table.started", matchId: "m1" }));
  });

  it("turns a late seat into the void of a due table", async () => {
    const d = deps({ seat_player: { status: "late" }, void_table: { status: "void", reason: "not_seated", voidedBy: "p2" } });
    await expect(seatPlayer(d, "m1", "p1")).resolves.toEqual({ status: "void" });
    expect(d.rpc).toHaveBeenCalledWith("void_table", { p_match: "m1", p_reason: "not_seated", p_by: null });
    expect(logs()).toContainEqual(expect.objectContaining({ event: "table.void", reason: "not_seated", voidedBy: "p2" }));
  });

  it("leaves: a void recorded against the leaver, published", async () => {
    const d = deps({ void_table: { status: "void", reason: "left", voidedBy: "p1" } });
    await expect(leaveTable(d, "m1", "p1")).resolves.toEqual({ status: "void" });
    expect(d.rpc).toHaveBeenCalledWith("void_table", { p_match: "m1", p_reason: "left", p_by: "p1" });
    expect(d.publish).toHaveBeenCalledWith("m1");
  });

  it("a leave after go is refused", async () => {
    const d = deps({ void_table: { status: "not_pending" } });
    await expect(leaveTable(d, "m1", "p1")).resolves.toEqual({ status: "not_pending" });
    expect(d.publish).not.toHaveBeenCalled();
  });

  it("voids a due table, and does nothing to one not due", async () => {
    const due = deps({ void_table: { status: "void", reason: "not_seated", voidedBy: null } });
    await expect(voidDueTable(due, "m1")).resolves.toEqual({ status: "void" });
    const early = deps({ void_table: { status: "not_due" } });
    await expect(voidDueTable(early, "m1")).resolves.toEqual({ status: "not_due" });
  });

  it("starts a table that was full at creation", async () => {
    const d = deps({ start_table_if_seated: { status: "started", startedAt: "a", deadlineAt: "b", serverNow: "c" } });
    await expect(startTableIfSeated(d, "m1")).resolves.toMatchObject({ status: "started" });
    expect(d.rpc).toHaveBeenCalledWith("start_table_if_seated", expect.objectContaining({ p_match: "m1", p_lead_ms: TABLE_LEAD_MS }));
  });

  it("works without a publisher (the loader's lazy path)", async () => {
    const d = deps({ void_table: { status: "void", reason: "not_seated", voidedBy: null } });
    await expect(voidDueTable({ client: d.client }, "m1")).resolves.toEqual({ status: "void" });
  });

  it("throws on an unexpected reply", async () => {
    const d = deps({ seat_player: { status: "nonsense" } });
    await expect(seatPlayer(d, "m1", "p1")).rejects.toThrow(/seat_player/);
  });
});
