import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ current: { player: { id: "birna" } } as { player: { id: string } } | null }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn(async () => session.current) }));
vi.mock("@/lib/matchmaking/linkService", () => ({ createLink: vi.fn(), cancelLink: vi.fn() }));
vi.mock("@/lib/http/requestOrigin", () => ({ requestOrigin: vi.fn(async () => "https://wottle.test") }));
vi.mock("@/lib/rate-limiting/middleware", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limiting/middleware")>("@/lib/rate-limiting/middleware");
  return { ...actual, assertWithinRateLimit: vi.fn() };
});

import { cancelLinkAction } from "@/app/actions/link/cancel";
import { createLinkAction } from "@/app/actions/link/create";
import { cancelLink, createLink } from "@/lib/matchmaking/linkService";
import { assertWithinRateLimit, RateLimitExceededError } from "@/lib/rate-limiting/middleware";

const LINK_ID = "00000000-0000-4000-8000-000000000501";

/** Spec 072 T022: invite a friend ▸ and cancel link ▸. */
describe("createLinkAction", () => {
  beforeEach(() => {
    session.current = { player: { id: "birna" } };
    vi.mocked(createLink).mockReset();
    vi.mocked(assertWithinRateLimit).mockReset();
  });

  it("needs a session", async () => {
    session.current = null;
    expect(await createLinkAction()).toEqual({ status: "unauthenticated" });
    expect(createLink).not.toHaveBeenCalled();
  });

  it("returns the link's URL in the sender's lobby language, and never stores the token", async () => {
    vi.mocked(createLink).mockResolvedValue({ status: "created", linkId: LINK_ID, expiresAt: "2026-09-24T12:10:00Z", language: "en" });
    const made = await createLinkAction();
    expect(made).toMatchObject({ status: "created", linkId: LINK_ID, expiresAt: "2026-09-24T12:10:00Z" });
    const url = (made as { url: string }).url;
    expect(url).toMatch(/^https:\/\/wottle\.test\/en\/c\/[A-Za-z0-9_-]{43}$/);
    const hash = vi.mocked(createLink).mock.calls[0][1] as Buffer;
    expect(hash).toHaveLength(32);
    expect(hash.toString("hex")).not.toContain(url.slice(-43));
  });

  it("serves an Icelandic link at the bare path", async () => {
    vi.mocked(createLink).mockResolvedValue({ status: "created", linkId: LINK_ID, expiresAt: "x", language: "is" });
    expect(((await createLinkAction()) as { url: string }).url).toMatch(/^https:\/\/wottle\.test\/c\/[A-Za-z0-9_-]{43}$/);
  });

  it.each([
    [{ status: "busy_sender" as const }, { status: "busy_sender" }],
    [{ status: "rate_limited" as const }, { status: "rate_limited" }],
    [{ status: "cooldown" as const, until: "2026-09-24T12:05:00Z" }, { status: "cooldown", until: "2026-09-24T12:05:00Z" }],
    [{ status: "invalid" as const }, { status: "error" }],
  ])("maps the refusal %o", async (reply, expected) => {
    vi.mocked(createLink).mockResolvedValue(reply);
    expect(await createLinkAction()).toEqual(expected);
  });

  it("is rate limited per player", async () => {
    vi.mocked(assertWithinRateLimit).mockImplementation(() => {
      throw new RateLimitExceededError("link:create", 30, "slow down");
    });
    expect(await createLinkAction()).toEqual({ status: "rate_limited" });
    expect(vi.mocked(assertWithinRateLimit).mock.calls[0][0]).toMatchObject({ identifier: "birna", scope: "link:create", limit: 6 });
  });
});

describe("cancelLinkAction", () => {
  beforeEach(() => {
    session.current = { player: { id: "birna" } };
    vi.mocked(cancelLink).mockReset();
  });

  it("cancels the viewer's own link", async () => {
    vi.mocked(cancelLink).mockResolvedValue({ status: "cancelled" });
    expect(await cancelLinkAction({ linkId: LINK_ID })).toEqual({ status: "cancelled" });
    expect(cancelLink).toHaveBeenCalledWith("birna", LINK_ID);
  });

  it("refuses a malformed id and a missing session", async () => {
    expect(await cancelLinkAction({ linkId: "nope" })).toEqual({ status: "error" });
    session.current = null;
    expect(await cancelLinkAction({ linkId: LINK_ID })).toEqual({ status: "unauthenticated" });
  });
});
