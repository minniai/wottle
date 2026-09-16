import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dev/room",
}));

import { RoomFixture } from "@/app/dev/room/RoomFixture";
import { ROOM_PHASES } from "@/app/dev/room/fixtures";

/**
 * Spec 047 amendment P2: every phase renders from literals alone. The visual
 * suite screenshots each one; this keeps a broken phase from reaching it.
 */
describe("RoomFixture", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(ROOM_PHASES)("renders the %s phase", (phase) => {
    render(<RoomFixture phase={phase} />);
    if (phase === "profile") expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    else expect(screen.getByTestId("field")).toBeInTheDocument();
  });

  it("idle reads pick a letter; picking, previewed, played and illegal each carry their live line", () => {
    const lineOf = (phase: (typeof ROOM_PHASES)[number]) => {
      const { unmount } = render(<RoomFixture phase={phase} />);
      const text = screen.getByTestId("ledger-live-row").textContent;
      unmount();
      return text;
    };
    expect(lineOf("idle")).toBe("pick a letter");
    expect(lineOf("picking")).toBe("picking · T (1)tap a second letter");
    expect(lineOf("previewed")).toBe("10 · taktap again to play · esc cancels");
    expect(lineOf("played")).toBe("played ●");
    expect(lineOf("illegal")).toBe("frozen · Kári R2 · pick another");
  });

  it("previewed exchanges the two letters; played and opp-played pin in their seat; low-clock runs low", () => {
    const cell = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

    const previewed = render(<RoomFixture phase="previewed" />);
    expect(cell(0, 0)).toHaveAttribute("data-state", "previewed");
    expect(cell(0, 0)).toHaveTextContent(/^T/);
    expect(cell(0, 9)).toHaveTextContent(/^Þ/);
    previewed.unmount();

    const played = render(<RoomFixture phase="played" />);
    expect(cell(3, 5)).toHaveAttribute("data-state", "pinned");
    expect(cell(3, 5)).toHaveAttribute("data-seat", "you");
    expect(screen.getByTestId("player-bar-bottom").querySelector("[data-testid=player-bar-clock]")).toHaveAttribute("data-running", "false");
    played.unmount();

    const opp = render(<RoomFixture phase="opp-played" />);
    expect(cell(1, 1)).toHaveAttribute("data-state", "pinned");
    expect(cell(1, 1)).toHaveAttribute("data-seat", "opp");
    expect(screen.getByTestId("player-bar-bottom").querySelector("[data-testid=player-bar-clock]")).toHaveAttribute("data-running", "true");
    opp.unmount();

    render(<RoomFixture phase="low-clock" />);
    expect(screen.getByTestId("player-bar-bottom").querySelector(".player-bar__lane--low")).not.toBeNull();
  });
});
