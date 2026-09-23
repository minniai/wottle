import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enterPlayer, NameTakenError, resolveClaim } from "@/lib/auth/claim";

function clientReturning(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { client: { rpc } as never, rpc };
}

const ROW = { id: "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f", username: "birna", display_name: "Birna" };
const HASH = "a".repeat(64);

describe("claim (spec 067)", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("should enter a player through enter_player and return who they are", async () => {
    const { client, rpc } = clientReturning({ status: "entered", player: ROW });
    await expect(enterPlayer(client, { username: "birna", displayName: "Birna", claimHash: HASH })).resolves.toEqual({
      id: ROW.id,
      username: "birna",
      displayName: "Birna",
    });
    expect(rpc).toHaveBeenCalledWith("enter_player", { p_username: "birna", p_display_name: "Birna", p_claim_hash: HASH });
  });

  it("should throw NameTakenError when another browser holds the name, and log it", async () => {
    const { client } = clientReturning({ status: "name_taken" });
    await expect(enterPlayer(client, { username: "birna", displayName: "Birna", claimHash: HASH })).rejects.toBeInstanceOf(NameTakenError);
    expect(vi.mocked(console.warn).mock.calls.some(([line]) => String(line).includes("auth.claim.name_taken"))).toBe(true);
  });

  it("should resolve a key to its player, or to null when it claims nothing", async () => {
    await expect(resolveClaim(clientReturning({ status: "entered", player: ROW }).client, HASH)).resolves.toMatchObject({ id: ROW.id });
    await expect(resolveClaim(clientReturning({ status: "unknown" }).client, HASH)).resolves.toBeNull();
  });

  it("should throw when the database call fails or replies nonsense", async () => {
    await expect(resolveClaim(clientReturning(null, { message: "down" }).client, HASH)).rejects.toThrow(/resolve_claim: down/);
    await expect(enterPlayer(clientReturning({ status: "?" }).client, { username: "b", displayName: "B", claimHash: HASH })).rejects.toThrow(/enter_player/);
  });
});
