/**
 * Spec 070 T034: the beacons a closing tab sends. `navigator.sendBeacon` cannot
 * set headers, so the body arrives as text/plain JSON; without a session, 401.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ current: null as null | { player: { id: string } } }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn(async () => session.current) }));
const leave = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/presence/presenceService", () => ({ leave }));

import { POST as presenceLeave } from "@/app/api/presence/leave/route";

const TAB = "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f";
const beacon = (body: string) => new Request("http://localhost/api/presence/leave", { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body });

describe("POST /api/presence/leave (beacon)", () => {
  beforeEach(() => {
    session.current = null;
    leave.mockClear();
  });

  it("is 401 without a session and touches nothing", async () => {
    const res = await presenceLeave(beacon(JSON.stringify({ tabId: TAB })));
    expect(res.status).toBe(401);
    expect(leave).not.toHaveBeenCalled();
  });

  it("accepts a text/plain JSON body and marks the tab leaving", async () => {
    session.current = { player: { id: "p1" } };
    const res = await presenceLeave(beacon(JSON.stringify({ tabId: TAB })));
    expect(res.status).toBe(204);
    expect(leave).toHaveBeenCalledWith("p1", TAB);
  });

  it("is 400 for a body that is not a tab", async () => {
    session.current = { player: { id: "p1" } };
    expect((await presenceLeave(beacon("nope"))).status).toBe(400);
    expect((await presenceLeave(beacon(JSON.stringify({ tabId: "x" })))).status).toBe(400);
  });
});
