import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/match/m1/summary",
}));

vi.mock("@/app/actions/auth/logout", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("@/lib/preferences/useSensoryPreferences", () => ({
  useSensoryPreferences: () => ({
    preferences: { soundEnabled: true, hapticsEnabled: true },
    setSoundEnabled: vi.fn(),
    setHapticsEnabled: vi.fn(),
  }),
}));

import { UserMenu } from "@/components/ui/UserMenu";
import type { LobbySession } from "@/lib/matchmaking/profile";
import { useSelfColorStore } from "@/lib/match/selfColorStore";

const session: LobbySession = {
  token: "t-1",
  issuedAt: 0,
  player: {
    id: "p-kongo",
    username: "kongo",
    displayName: "Kongó",
    avatarUrl: null,
    status: "in_match",
    lastSeenAt: new Date(0).toISOString(),
  },
};

afterEach(() => {
  useSelfColorStore.getState().clearSelfColor();
});

describe("UserMenu avatar color (O-72)", () => {
  test("uses the identity gradient when no match self-color is set", () => {
    render(<UserMenu session={session} />);
    expect(screen.getByRole("img").style.background).toContain("linear-gradient");
  });

  test("uses the current player's match slot color when set", () => {
    useSelfColorStore.getState().setSelfColor("var(--p2)");
    render(<UserMenu session={session} />);
    const background = screen.getByRole("img").style.background;
    expect(background).toContain("var(--p2)");
    expect(background).not.toContain("linear-gradient");
  });
});
