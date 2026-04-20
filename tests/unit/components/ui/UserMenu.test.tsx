import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
});
