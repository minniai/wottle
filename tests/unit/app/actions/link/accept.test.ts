import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ current: null as { player: { id: string } } | null }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn(async () => session.current) }));
vi.mock("@/lib/matchmaking/linkService", () => ({ readLink: vi.fn(), acceptLink: vi.fn() }));
vi.mock("@/lib/auth/signIn", () => ({ signInWithName: vi.fn(), signInAsReturning: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limiting/middleware")>("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn() };
});

import { acceptLinkAction } from "@/app/actions/link/accept";
import { signInAsReturning, signInWithName } from "@/lib/auth/signIn";
import { acceptLink, readLink } from "@/lib/matchmaking/linkService";
import { assertWithinRateLimit, RateLimitExceededError } from "@/lib/rate-limiting/middleware";
import type { LinkView } from "@/lib/types/link";

const TOKEN = "Xq7Vt2pLm9KcR4sWn8BjYd3HfA6gZe1uQo5iNw0bTyE";
const SENDER = "00000000-0000-4000-8000-000000000002";
const MATCH = "00000000-0000-4000-8000-000000000301";
const VIEW: LinkView = { valid: true, senderId: SENDER, senderName: "Kári", senderHandle: "kári", senderRating: 1265, language: "en", expiresAt: new Date(Date.now() + 500_000).toISOString() };
const player = (id: string) => ({ status: "success" as const, player: { id, username: "x", displayName: "X", status: "available" as const, lastSeenAt: "", eloRating: 1200 } });

/** Spec 072 T033: accept ▸ from the invite door and from the slot (R5). */
describe("acceptLinkAction", () => {
  beforeEach(() => {
    session.current = null;
    vi.mocked(readLink).mockReset().mockResolvedValue(VIEW);
    vi.mocked(acceptLink).mockReset().mockResolvedValue({ status: "created", matchId: MATCH, senderId: SENDER });
    vi.mocked(signInWithName).mockReset().mockResolvedValue(player("new-player"));
    vi.mocked(signInAsReturning).mockReset().mockResolvedValue(player("returning"));
    vi.mocked(assertWithinRateLimit).mockReset();
  });

  it("reads a malformed token as expired without a query", async () => {
    expect(await acceptLinkAction({ token: "nope", mode: "session" })).toEqual({ status: "expired" });
    expect(readLink).not.toHaveBeenCalled();
  });

  it("does not sign anyone in for a link that is not valid", async () => {
    vi.mocked(readLink).mockResolvedValue({ ...VIEW, valid: false });
    expect(await acceptLinkAction({ token: TOKEN, mode: "name", name: "embla" })).toEqual({ status: "expired" });
    vi.mocked(readLink).mockResolvedValue(null);
    expect(await acceptLinkAction({ token: TOKEN, mode: "name", name: "embla" })).toEqual({ status: "expired" });
    expect(signInWithName).not.toHaveBeenCalled();
  });

  it("signs a new visitor in with the name, in the link's language, then accepts", async () => {
    expect(await acceptLinkAction({ token: TOKEN, mode: "name", name: "embla" })).toEqual({ status: "created", matchId: MATCH, language: "en" });
    expect(signInWithName).toHaveBeenCalledWith("embla", "en");
    expect(acceptLink).toHaveBeenCalledWith(expect.any(Buffer), "new-player", SENDER);
  });

  it("leaves the link unused when the name cannot sign in", async () => {
    vi.mocked(signInWithName).mockResolvedValue({ status: "error", code: "name_taken" });
    expect(await acceptLinkAction({ token: TOKEN, mode: "name", name: "birna" })).toEqual({ status: "sign_in_failed", code: "name_taken" });
    expect(acceptLink).not.toHaveBeenCalled();
  });

  it("signs a returning browser in with nothing typed", async () => {
    await acceptLinkAction({ token: TOKEN, mode: "returning" });
    expect(signInAsReturning).toHaveBeenCalledWith("en");
    expect(acceptLink).toHaveBeenCalledWith(expect.any(Buffer), "returning", SENDER);
  });

  it("needs a session from the slot", async () => {
    expect(await acceptLinkAction({ token: TOKEN, mode: "session" })).toEqual({ status: "unauthenticated" });
    session.current = { player: { id: "birna" } };
    expect((await acceptLinkAction({ token: TOKEN, mode: "session" })).status).toBe("created");
  });

  it.each([["busy"], ["own"], ["expired"]] as const)("passes %s through", async (status) => {
    session.current = { player: { id: "birna" } };
    vi.mocked(acceptLink).mockResolvedValue({ status });
    expect(await acceptLinkAction({ token: TOKEN, mode: "session" })).toEqual({ status });
  });

  it("limits accepts per player", async () => {
    session.current = { player: { id: "birna" } };
    vi.mocked(assertWithinRateLimit).mockImplementation(() => {
      throw new RateLimitExceededError("link:accept", 30, "slow down");
    });
    expect(await acceptLinkAction({ token: TOKEN, mode: "session" })).toEqual({ status: "sign_in_failed", code: "rate_limited" });
    expect(vi.mocked(assertWithinRateLimit).mock.calls[0][0]).toMatchObject({ identifier: "birna", scope: "link:accept", limit: 10 });
  });
});
