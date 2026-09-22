import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlayerBar } from "@/components/room/PlayerBar";

/** Design system §5.3, spec 050: no clock in a bar; the lane is ten segments, the moves left (2026-09-21). */
describe("PlayerBar", () => {
  it("playing: seat square, name, sub-line, total; the lane is the moves played", () => {
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="1191 · opponent" sublineSuffix="6 of 10 · playing" movesPlayed={6} score={170} />);
    expect(screen.getByTestId("player-bar-name")).toHaveTextContent("Kári");
    expect(screen.getByTestId("player-bar-subline")).toHaveTextContent("1191 · opponent · 6 of 10 · playing");
    expect(screen.getByTestId("player-bar-score")).toHaveTextContent("170");
    expect(screen.queryByTestId("player-bar-clock")).toBeNull();
    const lane = screen.getByTestId("player-bar-lane");
    expect(lane).toHaveAttribute("role", "progressbar");
    expect(lane).toHaveAttribute("aria-label", "opponent's moves");
    expect(lane).toHaveAttribute("aria-valuemax", "10");
    expect(lane).toHaveAttribute("aria-valuenow", "4");
    expect(lane).toHaveAttribute("aria-valuetext", "4 of 10 moves left");
    const segments = lane.querySelectorAll(".player-bar__segment");
    expect(segments).toHaveLength(10);
    expect([...segments].map((s) => s.getAttribute("data-state"))).toEqual([...Array(4).fill("left"), ...Array(6).fill("spent")]);
  });

  it("your bar names its lane; the suffix takes the seat tone while the move is yours", () => {
    render(<PlayerBar seat="you" position="bottom" state="playing" name="Birna" subline="1204 · you" sublineSuffix="move 4 of 10" sublineTone="seat" movesPlayed={3} score={127} />);
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-label", "your moves");
    expect(screen.getByTestId("player-bar-turn")).toHaveAttribute("data-tone", "seat");
    expect(screen.getByTestId("player-bar-turn")).toHaveTextContent("move 4 of 10");
  });

  it("a move in flight keeps its segment, drawn as scoring until it resolves", () => {
    render(<PlayerBar seat="you" position="bottom" state="playing" name="Birna" subline="1204 · you" movesPlayed={3} moveInFlight score={53} />);
    const lane = screen.getByTestId("player-bar-lane");
    expect(lane).toHaveAttribute("aria-valuenow", "7");
    const states = [...lane.querySelectorAll(".player-bar__segment")].map((s) => s.getAttribute("data-state"));
    expect(states).toEqual([...Array(6).fill("left"), "scoring", ...Array(3).fill("spent")]);
  });

  it("disconnected: the moves left stay, outlined rather than filled", () => {
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="reconnecting · 0:42 left" movesPlayed={6} score={5} disconnected />);
    const lane = screen.getByTestId("player-bar-lane");
    expect(lane).toHaveClass("player-bar__lane--disconnected");
    expect(lane).toHaveAttribute("data-mode", "disconnected");
    expect(lane.querySelectorAll('.player-bar__segment[data-state="left"]')).toHaveLength(4);
  });

  it("empty seat: the lane is empty and the action slot renders", () => {
    render(<PlayerBar seat="opp" position="top" state="empty" subline="about 0:10 to find one" action={<button>find an opponent ▸</button>} />);
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("data-mode", "empty");
    expect(screen.getByTestId("player-bar-lane").querySelectorAll(".player-bar__segment")).toHaveLength(0);
    expect(screen.getByTestId("player-bar-action")).toHaveTextContent("find an opponent ▸");
    expect(screen.queryByTestId("player-bar-score")).toBeNull();
  });

  it("searching: the lane travels", () => {
    render(<PlayerBar seat="opp" position="top" state="searching" name="Finding an opponent" subline="searching · 0:07 · cancel ▸" />);
    expect(screen.getByTestId("player-bar-lane")).toHaveClass("player-bar__lane--searching");
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-valuetext", "searching");
  });

  it("final: the total stays; the sub-line carries the rating line", () => {
    render(<PlayerBar seat="you" position="bottom" state="final" name="Birna" subline="1204 → 1216 · +12 · wins" movesPlayed={10} score={134} />);
    expect(screen.getByTestId("player-bar-score")).toHaveTextContent("134");
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByTestId("player-bar-lane").querySelectorAll('.player-bar__segment[data-state="spent"]')).toHaveLength(10);
  });

  it("a negative total takes a real minus sign (rules §5.6)", () => {
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="1191 · opponent" movesPlayed={4} score={-12} />);
    expect(screen.getByTestId("player-bar-score")).toHaveTextContent("−12");
  });

  it("a profile link on the name: same tab by default, a new tab when asked", () => {
    const { unmount } = render(<PlayerBar seat="opp" position="top" state="final" name="Kári" subline="1191 · opponent" profileHref="/profile/kari" score={10} />);
    const link = screen.getByRole("link", { name: "Kári" });
    expect(link).toHaveAttribute("href", "/profile/kari");
    expect(link).not.toHaveAttribute("target");
    expect(link).toHaveAttribute("data-testid", "player-bar-name");
    unmount();
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="1191 · opponent" profileHref="/profile/kari" profileInNewTab score={10} />);
    const tab = screen.getByRole("link", { name: "Kári, profile opens in a new tab" });
    expect(tab).toHaveAttribute("target", "_blank");
    expect(tab).toHaveAttribute("rel", "noopener");
  });
});

