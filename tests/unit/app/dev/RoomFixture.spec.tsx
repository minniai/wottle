import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dev/room",
}));

import { RoomFixture } from "@/app/dev/room/RoomFixture";
import { ROOM_PHASES } from "@/app/dev/room/fixtures";

// The rules fixture is a server-rendered page outside the room/store.
const IN_ROOM_PHASES = ROOM_PHASES.filter((phase) => phase !== "rules");

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

  // Spec 049 US2: LEK (you, R3) crosses GILT (opp, R2) at (7,6). The L is
  // Kári's — he froze it first — so LEK's band covers only (8,6) and (9,6).
  it("the crossing letter is the opponent's in reveal; settled, LEK's band covers the two letters it froze", () => {
    const reveal = render(<RoomFixture phase="reveal" />);
    const l = screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === "7" && c.getAttribute("data-y") === "6")!;
    expect(l).toHaveAttribute("data-seat", "opp");
    expect(l).not.toHaveAttribute("data-state", "shared");
    reveal.unmount();
    render(<RoomFixture phase="settle" />);
    const bands = screen.getAllByTestId("field-band");
    expect(bands.find((b) => b.getAttribute("data-word") === "LEK")).toHaveAttribute("data-cells", "8,6;9,6");
    expect(bands.find((b) => b.getAttribute("data-word") === "GILT")).toHaveAttribute("data-cells", "7,4;7,5;7,6;7,7");
  });

  it.each(IN_ROOM_PHASES)("renders the %s phase", (phase) => {
    render(<RoomFixture phase={phase} />);
    if (phase === "profile") expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    else expect(screen.getByTestId("field")).toBeInTheDocument();
  });

  it("idle reads pick a letter; picking, previewed, played and illegal each carry their live line", () => {
    const lineOf = (phase: (typeof IN_ROOM_PHASES)[number]) => {
      const { unmount } = render(<RoomFixture phase={phase} />);
      const text = screen.getByTestId("ledger-live-row").textContent;
      unmount();
      return text;
    };
    // Spec 048 US2: line 1 is the round's beat, line 2 the field's instruction.
    expect(lineOf("idle")).toBe("round 4 · your movepick a letter");
    expect(lineOf("picking")).toBe("round 4 · your movepicking · T (1) · tap a second letter");
    expect(lineOf("previewed")).toBe("round 4 · your move10 · tak · tap again to play · esc cancels");
    expect(lineOf("played")).toBe("played · waiting for KáriKári is thinking · their clock runs");
    expect(lineOf("illegal")).toBe("round 4 · your movefrozen · Kári R2 · pick another");
    expect(lineOf("reveal")).toBe("resolving round 3both played · scoring");
    expect(lineOf("settle")).toContain("round 3 scoredyou +9 · Kári +0 · round 4 opens in 1");
  });

  it("settle holds round 3 as the tinted row and keeps round 4 future; your move frames the field", () => {
    const { unmount } = render(<RoomFixture phase="settle" />);
    expect(screen.getByTestId("ledger-row-3")).toHaveAttribute("data-status", "settled");
    expect(screen.getByTestId("ledger-row-4")).toHaveAttribute("data-status", "future");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    unmount();
    render(<RoomFixture phase="idle" />);
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("your move");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("thinking");
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
