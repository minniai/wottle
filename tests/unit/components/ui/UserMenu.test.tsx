import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/lobby",
}));
vi.mock("@/app/actions/auth/logout", () => ({
  logoutAction: vi
    .fn()
    .mockResolvedValue({ status: "signed-out", resignedMatchId: null }),
}));
vi.mock("@/lib/matchmaking/presenceStore", () => ({
  useLobbyPresenceStore: { getState: () => ({ disconnect: vi.fn() }) },
}));

const setSoundEnabled = vi.fn();
const setHapticsEnabled = vi.fn();
const sensoryState = {
  preferences: { soundEnabled: true, hapticsEnabled: false },
  setSoundEnabled,
  setHapticsEnabled,
};
vi.mock("@/lib/preferences/useSensoryPreferences", () => ({
  useSensoryPreferences: () => sensoryState,
}));

import { UserMenu } from "@/components/ui/UserMenu";
import { logoutAction } from "@/app/actions/auth/logout";

const session = {
  token: "t",
  issuedAt: 0,
  player: {
    id: "player-1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available" as const,
    lastSeenAt: "",
    eloRating: null,
  },
};

describe("<UserMenu>", () => {
  beforeEach(() => {
    setSoundEnabled.mockClear();
    setHapticsEnabled.mockClear();
    sensoryState.preferences = { soundEnabled: true, hapticsEnabled: false };
  });

  it("renders the chip as an expandable button with the displayName", () => {
    render(<UserMenu session={session} />);
    const chip = screen.getByRole("button", { name: /ari/i });
    expect(chip).toHaveAttribute("aria-haspopup", "menu");
    expect(chip).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the menu on chip click and sets aria-expanded", () => {
    render(<UserMenu session={session} />);
    const chip = screen.getByRole("button", { name: /ari/i });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Signed in as Ari")).toBeInTheDocument();
  });

  it("closes the menu on Escape and returns focus to the chip", () => {
    render(<UserMenu session={session} />);
    const chip = screen.getByRole("button", { name: /ari/i });
    fireEvent.click(chip);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(chip);
  });

  it("calls logoutAction without the resign flag for an available user", async () => {
    render(<UserMenu session={session} />);
    fireEvent.click(screen.getByRole("button", { name: /ari/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(logoutAction).toHaveBeenCalledWith({}));
  });

  it("opens the confirm dialog for an in_match player and defers the server call", () => {
    vi.mocked(logoutAction).mockClear();
    const inMatchSession = {
      ...session,
      player: { ...session.player, status: "in_match" as const },
    };
    render(<UserMenu session={inMatchSession} />);
    fireEvent.click(screen.getByRole("button", { name: /ari/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));

    expect(screen.getByText("Sign out now?")).toBeInTheDocument();
    expect(logoutAction).not.toHaveBeenCalled();
  });

  it("calls logoutAction with resignActiveMatch=true after confirming", async () => {
    vi.mocked(logoutAction).mockClear();
    const inMatchSession = {
      ...session,
      player: { ...session.player, status: "in_match" as const },
    };
    render(<UserMenu session={inMatchSession} />);
    fireEvent.click(screen.getByRole("button", { name: /ari/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /sign out & forfeit/i }),
    );

    await waitFor(() =>
      expect(logoutAction).toHaveBeenCalledWith({ resignActiveMatch: true }),
    );
  });

  it("renders sound + haptics toggles reflecting current preferences", () => {
    render(<UserMenu session={session} />);
    fireEvent.click(screen.getByRole("button", { name: /ari/i }));

    const sound = screen.getByRole("menuitemcheckbox", {
      name: /sound effects/i,
    });
    const haptics = screen.getByRole("menuitemcheckbox", {
      name: /haptic feedback/i,
    });
    expect(sound).toHaveAttribute("aria-checked", "true");
    expect(haptics).toHaveAttribute("aria-checked", "false");
  });

  it("toggles sound effects off when clicked while enabled", () => {
    render(<UserMenu session={session} />);
    fireEvent.click(screen.getByRole("button", { name: /ari/i }));
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", { name: /sound effects/i }),
    );
    expect(setSoundEnabled).toHaveBeenCalledWith(false);
  });

  it("toggles haptic feedback on when clicked while disabled", () => {
    render(<UserMenu session={session} />);
    fireEvent.click(screen.getByRole("button", { name: /ari/i }));
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", { name: /haptic feedback/i }),
    );
    expect(setHapticsEnabled).toHaveBeenCalledWith(true);
  });
});
