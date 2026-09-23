import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dev/room",
}));

import { RoomFixture } from "@/app/[locale]/dev/room/RoomFixture";
import { ROOM_PHASES } from "@/app/[locale]/dev/room/fixtures";

// The rules fixture is a server-rendered page outside the room/store.
const IN_ROOM_PHASES = ROOM_PHASES.filter((phase) => phase !== "rules");

/**
 * Spec 047 amendment P2, spec 050: every phase renders from literals alone.
 * The visual suite screenshots each one; this keeps a broken phase from
 * reaching it.
 */
describe("RoomFixture", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Spec 049 US2, amended 2026-09-21: LEK (you, M3) crosses GILT (opp, M1) at
  // (7,6). The L stays Kári's colour — he froze it first — but LEK's band
  // shades the whole word, the L included.
  it("the crossing letter is the opponent's; settled, LEK's band covers the whole word", () => {
    render(<RoomFixture phase="idle" />);
    const l = screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === "7" && c.getAttribute("data-y") === "6")!;
    expect(l).toHaveAttribute("data-seat", "opp");
    expect(l).not.toHaveAttribute("data-state", "shared");
    const bands = screen.getAllByTestId("field-band");
    expect(bands.find((b) => b.getAttribute("data-word") === "LEK")).toHaveAttribute("data-cells", "7,6;8,6;9,6");
    expect(bands.find((b) => b.getAttribute("data-word") === "GILT")).toHaveAttribute("data-cells", "7,4;7,5;7,6;7,7");
  });

  // axe landmark-one-main (Vercel accessibility review): every room state is one main landmark.
  it.each(IN_ROOM_PHASES)("the %s phase has exactly one main landmark", (phase) => {
    render(<RoomFixture phase={phase} />);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it.each(IN_ROOM_PHASES)("renders the %s phase", (phase) => {
    render(<RoomFixture phase={phase} />);
    if (phase === "profile") expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    else expect(screen.getByTestId("field")).toBeInTheDocument();
  });

  it("each move beat carries its live line (spec 050 contracts/move-state.md)", () => {
    const lineOf = (phase: (typeof IN_ROOM_PHASES)[number]) => {
      const { unmount } = render(<RoomFixture phase={phase} />);
      const text = screen.getByTestId("ledger-live-row").textContent;
      unmount();
      return text;
    };
    expect(lineOf("idle")).toBe("move 4 · your movepick a letter");
    expect(lineOf("picking")).toBe("move 4 · your movepicking · T (1) · tap a second letter");
    expect(lineOf("illegal")).toBe("move 4 · your movefrozen · Kári M1 · pick another");
    expect(lineOf("scoring")).toBe("move 4 · scoring");
    expect(lineOf("scored")).toBe("move 4 scoredyou +13 · move 5 opens");
    expect(lineOf("rejected")).toBe("move 5 · your movefrozen · Kári froze it · pick another");
    expect(lineOf("done-waiting")).toBe("10 of 10 playedKári · 8 of 10 · 0:48 left");
    expect(lineOf("time-up")).toBe("time · scoring");
  });

  it("scored holds move 4 as the tinted row and keeps move 5 future; your move frames the field and names the counts", () => {
    const { unmount } = render(<RoomFixture phase="scored" />);
    expect(screen.getByTestId("ledger-row-4")).toHaveAttribute("data-status", "settled");
    // Kári has six moves, so row 5 already holds his fifth; it is not your live row.
    expect(screen.getByTestId("ledger-row-5")).not.toHaveAttribute("data-status", "live");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    unmount();
    render(<RoomFixture phase="idle" />);
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("move 4 of 10");
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("6 of 10 · playing");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("3:12");
  });

  it("scoring locks the field; opp-reveal keeps your pick; low-clock is heavy", () => {
    const cell = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

    const scoring = render(<RoomFixture phase="scoring" />);
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-turn");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("move 4 of 10 · scoring");
    scoring.unmount();

    const opp = render(<RoomFixture phase="opp-reveal" />);
    expect(cell(0, 9)).toHaveAttribute("data-state", "picked");
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("6 of 10 · scoring");
    expect(screen.getAllByTestId("field-band").find((b) => b.getAttribute("data-word") === "LEG")).toHaveClass("field__band--live");
    opp.unmount();

    render(<RoomFixture phase="low-clock" />);
    expect(screen.getByTestId("scoreboard-clock")).toHaveAttribute("data-phase", "underMinute");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("0:48");
  });

  it("last-seconds: the clock row names the seconds left, in weight only (spec 068: nothing flashes)", () => {
    render(<RoomFixture phase="last-seconds" />);
    const clock = screen.getByTestId("scoreboard-clock");
    expect(clock).toHaveAttribute("data-phase", "lastSeconds");
    expect(clock).toHaveTextContent("last 12s");
    expect(clock).toHaveAttribute("aria-label", "last 12s, ≈2s a move, 0:12 left");
    expect(document.querySelector(".ledger__clock-invert")).toBeNull();
  });

  it("end-early: the slip offers to end the match once you have ten and the opponent is gone", () => {
    render(<RoomFixture phase="end-early" />);
    expect(screen.getByTestId("slip")).toHaveAttribute("data-kind", "endEarly");
    expect(screen.getByTestId("slip")).toHaveTextContent("Kári is gone");
    expect(screen.getByTestId("slip-end-early")).toBeInTheDocument();
  });

  it("final: on the grid the scoreboard carries the totals, so the ledger ends level with the field (spec 068)", () => {
    const final = render(<RoomFixture phase="final" />);
    expect(screen.queryByTestId("ledger-totals")).toBeNull();
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("134");
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("88");
    final.unmount();

    render(<RoomFixture phase="idle" />);
    expect(screen.queryByTestId("ledger-totals")).toBeNull();
  });
});

describe("RoomFixture: the scoreboard's states (spec 068)", () => {
  it("starting: the clock row loads over the count and both rows read `ready`", () => {
    render(<RoomFixture phase="starting" />);
    expect(screen.getByTestId("scoreboard-clock")).toHaveAttribute("data-phase", "starting");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("starts in 2");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("5:00");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("ready");
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("ready");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
  });

  it("final: the clock holds what was left and the rows carry the rating lines", () => {
    render(<RoomFixture phase="final" />);
    expect(screen.getByTestId("scoreboard-clock")).toHaveAttribute("data-phase", "over");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("match over");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("4:52 of 5:00");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("0:08");
  });

  it("end-early: past the window the opponent's row counts how long they have been gone", () => {
    render(<RoomFixture phase="end-early" />);
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("8 of 10 · gone for 2:04");
    expect(screen.getByTestId("scoreboard-row-opp")).not.toHaveTextContent("0:00 left");
  });
});

describe("RoomFixture: the whole move (spec 068 Phase B)", () => {
  it("missed: the held beat says no word, and only the number is crimson", () => {
    render(<RoomFixture phase="missed" />);
    const live = screen.getByTestId("ledger-live-row");
    expect(live).toHaveTextContent("move 4 · no word");
    expect(live.querySelector(".points-lost")).toHaveTextContent("−5");
  });

  it("stakes: under a minute your move prices the moves left", () => {
    render(<RoomFixture phase="stakes" />);
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("move 8 · your move");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("3 moves left · −15if unplayed");
  });

  it("pick-cleared: the notice is the live row's second line", () => {
    render(<RoomFixture phase="pick-cleared" />);
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("pick cleared · Kári moved that letter");
  });

  it("last-moved: each player's last swap carries a tick in their colour", () => {
    render(<RoomFixture phase="last-moved" />);
    const ticked = screen.getAllByTestId("field-cell").filter((c) => c.hasAttribute("data-last-move"));
    expect(ticked.map((c) => c.getAttribute("data-last-move"))).toEqual(["you", "you", "opp", "opp"]);
  });
});

describe("RoomFixture: absence (spec 068 US8)", () => {
  it("gone: Kári gone for 2:04, the offer on line 2, you done", () => {
    render(<RoomFixture phase="gone" />);
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("8 of 10 · gone for 2:04");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("10 of 10 · done");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("Kári is gone · end the match ▸");
    expect(screen.queryByTestId("slip")).toBeNull();
  });

  it("offline: your row and line 2 say so", () => {
    render(<RoomFixture phase="offline" />);
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("offline · reconnecting");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("offline · reconnecting");
  });
});
