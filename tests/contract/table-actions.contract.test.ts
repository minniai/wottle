/**
 * Spec 069 T018, T037: sitting down and leaving the table. Both take a session,
 * a valid match id and the `matchmaking:table` rate limit; the database decides.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({ tag: "client" })) }));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn() }));
vi.mock("@/lib/match/tableService", () => ({ seatPlayer: vi.fn(), leaveTable: vi.fn() }));

import { leaveTableAction } from "@/app/actions/match/leaveTable";
import { seatAction } from "@/app/actions/match/seat";
import { leaveTable, seatPlayer } from "@/lib/match/tableService";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { resetRateLimitStoreForTests } from "@/lib/rate-limiting/middleware";

const MATCH = "00000000-0000-0000-0000-000000000069";
const SESSION = { issuedAt: Date.now(), expiresAt: Date.now() + 60_000, player: { id: "p1", username: "birna", displayName: "Birna" } };

describe("seatAction (spec 069 T018)", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    vi.mocked(seatPlayer).mockReset();
  });

  it("seats the session's player and publishes through the table service", async () => {
    vi.mocked(seatPlayer).mockResolvedValue({ status: "seated" });
    await expect(seatAction(MATCH)).resolves.toEqual({ status: "seated" });
    expect(seatPlayer).toHaveBeenCalledWith(expect.objectContaining({ client: { tag: "client" }, publish: expect.any(Function) }), MATCH, "p1");
  });

  it("passes the start and the void through", async () => {
    vi.mocked(seatPlayer).mockResolvedValue({ status: "started", startedAt: "a", deadlineAt: "b", serverNow: "c" });
    await expect(seatAction(MATCH)).resolves.toEqual({ status: "started" });
    vi.mocked(seatPlayer).mockResolvedValue({ status: "void" });
    await expect(seatAction(MATCH)).resolves.toEqual({ status: "void" });
  });

  it("refuses without a session, and a malformed id", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    await expect(seatAction(MATCH)).resolves.toEqual({ status: "unauthenticated" });
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    await expect(seatAction("nope")).resolves.toEqual({ status: "invalid" });
    expect(seatPlayer).not.toHaveBeenCalled();
  });

  it("is rate limited at 20 a minute", async () => {
    vi.mocked(seatPlayer).mockResolvedValue({ status: "seated" });
    for (let i = 0; i < 20; i += 1) await seatAction(MATCH);
    await expect(seatAction(MATCH)).resolves.toMatchObject({ status: "rate_limited" });
  });
});

describe("leaveTableAction (spec 069 T037)", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
    vi.mocked(readLobbySession).mockResolvedValue(SESSION as never);
    vi.mocked(leaveTable).mockReset();
  });

  it("voids the table against the leaver", async () => {
    vi.mocked(leaveTable).mockResolvedValue({ status: "void" });
    await expect(leaveTableAction(MATCH)).resolves.toEqual({ status: "void" });
    expect(leaveTable).toHaveBeenCalledWith(expect.objectContaining({ publish: expect.any(Function) }), MATCH, "p1");
  });

  it("after go a leave is refused and changes nothing", async () => {
    vi.mocked(leaveTable).mockResolvedValue({ status: "not_pending" });
    await expect(leaveTableAction(MATCH)).resolves.toEqual({ status: "not_pending" });
  });

  it("shares the table's rate limit", async () => {
    vi.mocked(leaveTable).mockResolvedValue({ status: "not_pending" });
    for (let i = 0; i < 20; i += 1) await leaveTableAction(MATCH);
    await expect(leaveTableAction(MATCH)).resolves.toMatchObject({ status: "rate_limited" });
  });
});
