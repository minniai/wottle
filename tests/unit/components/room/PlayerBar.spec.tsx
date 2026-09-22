import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlayerBar } from "@/components/room/PlayerBar";

/** Design system §5.3, spec 050: no clock in a bar; the lane counts moves. */
describe("PlayerBar", () => {
  it("links a known player to their encoded profile without interrupting a live match", () => {
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" username="kári" subline="opponent" />);
    expect(screen.getByRole("link", { name: "Kári" })).toHaveAttribute("href", "/profile/k%C3%A1ri");
    expect(screen.getByRole("link", { name: "Kári" })).toHaveAttribute("target", "_blank");
  });

  it("opens a finished player's profile in the current tab", () => {
    render(<PlayerBar seat="opp" position="top" state="final" name="Kári" username="kari" subline="wins" />);
    expect(screen.getByRole("link", { name: "Kári" })).toHaveAttribute("href", "/profile/kari");
    expect(screen.getByRole("link", { name: "Kári" })).not.toHaveAttribute("target");
  });

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
    expect(lane).toHaveAttribute("aria-valuenow", "6");
    expect(lane).toHaveAttribute("aria-valuetext", "6 of 10 moves played");
    expect(lane.style.getPropertyValue("--lane-fraction")).toBe("0.6");
  });

  it("your bar names its lane; the suffix takes the seat tone while the move is yours", () => {
    render(<PlayerBar seat="you" position="bottom" state="playing" name="Birna" subline="1204 · you" sublineSuffix="move 4 of 10" sublineTone="seat" movesPlayed={3} score={127} />);
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-label", "your moves");
    expect(screen.getByTestId("player-bar-turn")).toHaveAttribute("data-tone", "seat");
    expect(screen.getByTestId("player-bar-turn")).toHaveTextContent("move 4 of 10");
  });

  it("disconnected: the lane is dashed and holds its length", () => {
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="reconnecting · 0:42 left" movesPlayed={6} score={5} disconnected />);
    const lane = screen.getByTestId("player-bar-lane");
    expect(lane).toHaveClass("player-bar__lane--disconnected");
    expect(lane).toHaveAttribute("data-mode", "disconnected");
    expect(lane.querySelector("line")).toHaveAttribute("stroke-dasharray", "6 4");
  });

  it("empty seat: the lane is empty and the action slot renders", () => {
    render(<PlayerBar seat="opp" position="top" state="empty" subline="about 0:10 to find one" action={<button>find an opponent ▸</button>} />);
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("data-mode", "empty");
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
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-valuenow", "10");
  });
});
