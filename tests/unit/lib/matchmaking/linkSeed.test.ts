import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/linkService", () => ({ readLink: vi.fn(), acceptLink: vi.fn(), createLink: vi.fn() }));

import { readLinkSeed } from "@/lib/matchmaking/linkSeed";
import { acceptLink, createLink, readLink } from "@/lib/matchmaking/linkService";

const TOKEN = "Xq7Vt2pLm9KcR4sWn8BjYd3HfA6gZe1uQo5iNw0bTyE";
const VIEW = { valid: true, senderId: "hekla", senderName: "Hekla", senderHandle: "hekla", senderRating: 1250, language: "en" as const, expiresAt: new Date(Date.now() + 500_000).toISOString() };

/** Spec 072 T043 (research R6): the lobby's `?invite` becomes the link's call, or the sender's own link. */
describe("readLinkSeed", () => {
  beforeEach(() => {
    vi.mocked(readLink).mockReset().mockResolvedValue(VIEW);
  });

  it("makes someone else's valid link a call", async () => {
    expect(await readLinkSeed(TOKEN, "birna")).toEqual({ call: { token: TOKEN, view: VIEW }, own: null });
  });

  it("makes the sender's own link their own", async () => {
    expect(await readLinkSeed(TOKEN, "hekla")).toEqual({ call: null, own: { token: TOKEN, view: VIEW } });
  });

  it("drops a missing, malformed or invalid link", async () => {
    expect(await readLinkSeed(undefined, "birna")).toEqual({ call: null, own: null });
    expect(await readLinkSeed("nope", "birna")).toEqual({ call: null, own: null });
    vi.mocked(readLink).mockResolvedValue({ ...VIEW, valid: false });
    expect(await readLinkSeed(TOKEN, "birna")).toEqual({ call: null, own: null });
  });

  it("only reads", async () => {
    await readLinkSeed(TOKEN, "birna");
    expect(acceptLink).not.toHaveBeenCalled();
    expect(createLink).not.toHaveBeenCalled();
  });
});
