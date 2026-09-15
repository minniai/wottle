import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlayerBar } from "@/components/room/PlayerBar";

describe("PlayerBar (design system §5.3)", () => {
  it("playing: name, subline, running clock, score, lane with progressbar semantics", () => {
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="1191 · opponent" clockMs={405_000 - 300_000 + 300_000 - 195_000} clockRunning score={170} />);
    const bar = screen.getByTestId("player-bar-top");
    expect(bar).toHaveAttribute("data-seat", "opp");
    expect(screen.getByTestId("player-bar-name")).toHaveTextContent("Kári");
    expect(screen.getByTestId("player-bar-subline")).toHaveTextContent("1191 · opponent");
    expect(screen.getByTestId("player-bar-clock")).toHaveTextContent("3:30");
    expect(screen.getByTestId("player-bar-clock")).toHaveAttribute("data-running", "true");
    expect(screen.getByTestId("player-bar-score")).toHaveTextContent("170");
    const lane = screen.getByTestId("player-bar-lane");
    expect(lane).toHaveAttribute("role", "progressbar");
    expect(lane).toHaveAttribute("aria-valuemin", "0");
    expect(lane).toHaveAttribute("aria-valuemax", "300");
    expect(lane).toHaveAttribute("aria-valuenow", "210");
    expect(lane).toHaveAttribute("aria-valuetext", "3:30 remaining, running");
    expect(lane.style.getPropertyValue("--lane-fraction")).toBe("0.7");
    expect(lane).toHaveAttribute("aria-label", "opponent's clock");
  });

  it("empty seat: the lane still has an accessible name (axe aria-progressbar-name)", () => {
    render(<PlayerBar seat="you" position="bottom" state="empty" subline="no account needed" />);
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-label", "your clock");
  });

  it("stopped clock is muted and the lane holds", () => {
    render(<PlayerBar seat="you" position="bottom" state="playing" name="Birna" subline="1204 · you" clockMs={120_000} clockRunning={false} score={127} />);
    expect(screen.getByTestId("player-bar-clock")).toHaveClass("player-bar__clock--stopped");
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-valuetext", "2:00 remaining, stopped");
  });

  it("under 1:00 the lane is low (8px + blink class)", () => {
    render(<PlayerBar seat="you" position="bottom" state="playing" name="B" subline="s" clockMs={59_000} clockRunning score={0} />);
    expect(screen.getByTestId("player-bar-lane")).toHaveClass("player-bar__lane--low");
  });

  it("disconnected: dashed lane and the counting subline", () => {
    render(<PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="reconnecting · 0:42 left" clockMs={100_000} clockRunning={false} score={5} disconnected />);
    expect(screen.getByTestId("player-bar-lane")).toHaveClass("player-bar__lane--disconnected");
    expect(screen.getByTestId("player-bar-subline")).toHaveTextContent("reconnecting · 0:42 left");
  });

  it("empty seat: dashed square, state sentence, primary action instead of a total", () => {
    render(<PlayerBar seat="opp" position="top" state="empty" name="No opponent yet" subline="ranked · about 0:10 to find one" action={<button className="action-primary">play ranked ▸</button>} />);
    expect(screen.getByTestId("player-bar-top")).toHaveClass("player-bar--empty");
    expect(screen.getByTestId("player-bar-action")).toHaveTextContent("play ranked ▸");
    expect(screen.queryByTestId("player-bar-score")).toBeNull();
    expect(screen.getByTestId("player-bar-clock")).toHaveTextContent("");
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("data-mode", "empty");
  });

  it("searching: travelling lane segment", () => {
    render(<PlayerBar seat="opp" position="top" state="searching" name="Finding an opponent" subline="ranked · 0:07 · cancel ▸" />);
    expect(screen.getByTestId("player-bar-lane")).toHaveClass("player-bar__lane--searching");
    expect(screen.getByTestId("player-bar-lane")).toHaveAttribute("aria-valuetext", "searching");
  });

  it("nameInput replaces the name slot (landing)", () => {
    render(<PlayerBar seat="you" position="bottom" state="empty" subline="no account needed" nameInput={<input data-testid="player-bar-name-input" />} />);
    expect(screen.getByTestId("player-bar-name-input")).toBeInTheDocument();
    expect(screen.queryByTestId("player-bar-name")).toBeNull();
  });

  /**
   * Spec 045 FR-029. A CSS dashed border lets the browser choose the pattern
   * (Chrome draws about 12/12); the design is 6px on, 4px off.
   */
  it("draws the disconnected lane as the design's dash pattern, not the browser's", () => {
    render(
      <PlayerBar seat="opp" position="top" state="playing" name="Kári" subline="reconnecting · 0:42 left" clockMs={151_000} clockRunning={false} score={15} disconnected />,
    );
    const lane = screen.getByTestId("player-bar-lane");
    expect(lane).toHaveAttribute("data-mode", "disconnected");

    const line = lane.querySelector("svg line");
    expect(line, "the lane is an svg line, so the pattern is ours").not.toBeNull();
    expect(line).toHaveAttribute("stroke-dasharray", "6 4");
    expect(line).toHaveAttribute("stroke-width", "4");
    expect(line).toHaveAttribute("stroke", "var(--seat-ink)");
    expect(lane.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
