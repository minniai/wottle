import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ "accept-language": "en-GB,en;q=0.9" })) }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn(), viewerInLanguage: vi.fn(async (p: unknown) => p) }));
vi.mock("@/lib/auth/returningPlayer", () => ({ readReturningPlayer: vi.fn(async () => null) }));
const overview = { counts: { here: 3, searching: 0, playersInMatch: 0, matchesOn: 1, other: { language: "en", here: 2 } }, here: [], more: 0 };
vi.mock("@/lib/lobby/overview", () => ({ publicOverview: vi.fn(async () => overview) }));

import HomePage from "@/app/[locale]/(pages)/page";
import { DoorPage } from "@/components/page/door/DoorPage";
import { readLobbySession } from "@/lib/matchmaking/profile";

const params = (locale: string) => Promise.resolve({ locale });

/**
 * `/` and `/en` are one URL each (spec 070 FR-001): the door signed out, the
 * lobby signed in. The door carries only a validated `?next=` (§7.5 inv. 12).
 */
describe("the home page", () => {
  test("signed out, it is the door, with the overview and a validated next", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    const element = await HomePage({ params: params("is"), searchParams: Promise.resolve({ next: "/rules" }) });
    expect(element.type).toBe(DoorPage);
    expect(element.props).toMatchObject({ overview, returning: null, next: "/rules", preferOther: true });
  });

  test("drops a next that leaves the site", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    const element = await HomePage({ params: params("en"), searchParams: Promise.resolve({ next: "//evil.example" }) });
    expect(element.props).toMatchObject({ next: null, preferOther: false });
  });

  test("signed in, it is never the door", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({ expiresAt: 0, issuedAt: 0, player: { id: "abc", username: "ari", displayName: "Ari" } } as never);
    const element = await HomePage({ params: params("is"), searchParams: Promise.resolve({}) });
    expect(element.type).not.toBe(DoorPage);
  });
});
