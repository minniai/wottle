import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const httpSend = vi.fn();
const removeChannel = vi.fn();
const channel = vi.fn(() => ({ httpSend }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({ channel, removeChannel })) }));

import { pokeLobby, pokePlayer, topicFor } from "@/lib/realtime/pokes";

const ID = "5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11";

describe("pokes (spec 070 R6, FR-034)", () => {
  beforeEach(() => {
    process.env.WOTTLE_SESSION_SECRET = Buffer.alloc(32, 7).toString("base64");
    httpSend.mockReset().mockResolvedValue({ success: true });
    channel.mockClear();
    removeChannel.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names a player's topic by an HMAC of their id, stable and unguessable", () => {
    const topic = topicFor(ID);
    expect(topic).toMatch(/^player:[0-9a-f]{32}$/);
    expect(topicFor(ID)).toBe(topic);
    expect(topic).not.toContain(ID.slice(0, 8));
    process.env.WOTTLE_SESSION_SECRET = Buffer.alloc(32, 9).toString("base64");
    expect(topicFor(ID)).not.toBe(topic);
  });

  it("pokes a player with the kind as the event and nothing else", async () => {
    await pokePlayer(ID, "challenge");
    expect(channel).toHaveBeenCalledWith(topicFor(ID));
    expect(httpSend).toHaveBeenCalledWith("challenge", {});
  });

  it("pokes a lobby by its language, carrying only a recheck time when given one", async () => {
    await pokeLobby("en");
    expect(channel).toHaveBeenLastCalledWith("lobby:en");
    expect(httpSend).toHaveBeenLastCalledWith("presence", {});
    await pokeLobby("is", { recheckInMs: 8_500 });
    expect(httpSend).toHaveBeenLastCalledWith("presence", { recheckInMs: 8_500 });
  });

  it("logs a failed publish and never throws: the fallback poll covers it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    httpSend.mockRejectedValueOnce(new Error("socket"));
    await expect(pokePlayer(ID, "outcome")).resolves.toBeUndefined();
    httpSend.mockResolvedValueOnce({ success: false, status: 500, error: "nope" });
    await expect(pokeLobby("is")).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0][0])).toContain("poke.failed");
  });
});
