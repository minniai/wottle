/**
 * Spec 072 (T064, T073, T080): the profile routes. Your own profile needs a
 * session; another player's is readable by anyone; your own handle goes to
 * `/profile`; an unknown handle is a 404.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/profile/readProfile", () => ({ readProfile: vi.fn(), playerIdForHandle: vi.fn() }));

import OwnProfilePage from "@/app/[locale]/(pages)/(framed)/profile/page";
import PublicProfilePage from "@/app/[locale]/(pages)/(framed)/profile/[handle]/page";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { playerIdForHandle, readProfile } from "@/lib/profile/readProfile";

const SESSION = { issuedAt: Date.now(), expiresAt: Date.now() + 3_600_000, player: { id: "p1", username: "ari", displayName: "Ari", status: "available" as const, lastSeenAt: "", eloRating: 1200 } };
const VIEW = { playerId: "p2", handle: "kári" } as never;

describe("/profile", () => {
  beforeEach(() => {
    vi.mocked(readProfile).mockReset();
  });

  test("sends a visitor who is not signed in to the door, and back here after", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(OwnProfilePage({ params: { locale: "en" } })).rejects.toThrow("NEXT_REDIRECT:/en?next=%2Fen%2Fprofile");
  });

  test("reads the signed-in player's own profile in the page's language", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(SESSION as never);
    vi.mocked(readProfile).mockResolvedValueOnce(VIEW);
    expect(await OwnProfilePage({ params: { locale: "en" } })).toBeTruthy();
    expect(readProfile).toHaveBeenCalledWith("p1", "en", { kind: "own" });
  });
});

describe("/profile/[handle]", () => {
  beforeEach(() => {
    vi.mocked(readProfile).mockReset().mockResolvedValue(VIEW);
    vi.mocked(playerIdForHandle).mockReset();
  });

  test("is a 404 for an unknown handle", async () => {
    vi.mocked(playerIdForHandle).mockResolvedValueOnce(null);
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(PublicProfilePage({ params: Promise.resolve({ handle: "ghost", locale: "en" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("sends the viewer's own handle to /profile", async () => {
    vi.mocked(playerIdForHandle).mockResolvedValueOnce("p1");
    vi.mocked(readLobbySession).mockResolvedValueOnce(SESSION as never);
    await expect(PublicProfilePage({ params: Promise.resolve({ handle: "ari", locale: "en" }) })).rejects.toThrow("NEXT_REDIRECT:/en/profile");
  });

  test("reads another player's profile for a signed-in viewer, and for a visitor", async () => {
    vi.mocked(playerIdForHandle).mockResolvedValue("p2");
    vi.mocked(readLobbySession).mockResolvedValueOnce(SESSION as never);
    expect(await PublicProfilePage({ params: Promise.resolve({ handle: "k%C3%A1ri", locale: "en" }) })).toBeTruthy();
    expect(readProfile).toHaveBeenLastCalledWith("p2", "en", { kind: "public", viewerId: "p1" });
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    expect(await PublicProfilePage({ params: Promise.resolve({ handle: "kári", locale: "is" }) })).toBeTruthy();
    expect(readProfile).toHaveBeenLastCalledWith("p2", "is", { kind: "public", viewerId: null });
  });
});
