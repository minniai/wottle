import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Scoreboard } from "@/components/room/Scoreboard";
import { copyEn } from "@/lib/i18n/copy/en";
import { deriveScoreboard, type ScoreboardInput } from "@/lib/room/scoreboard";

const INPUT: ScoreboardInput = {
  phase: "live",
  moveState: { kind: "yourMove", move: 4, opponentName: "Kári" },
  remainingMs: 192_000,
  clockLengthMs: 300_000,
  moveLimit: 10,
  readOnly: false,
  you: { name: "Birna", rating: 1310, movesPlayed: 3, inFlight: false, score: 44 },
  opp: { name: "Kári", rating: 1265, movesPlayed: 6, inFlight: false, score: 34 },
};

const view = deriveScoreboard(INPUT, copyEn);

describe("Scoreboard (spec 068)", () => {
  it("is one box of three rows: the clock, the opponent, you", () => {
    render(<Scoreboard view={view} />);
    const rows = Array.from(screen.getByTestId("scoreboard").children).map((el) => el.getAttribute("data-testid"));
    expect(rows).toEqual(["scoreboard-clock", "scoreboard-row-opp", "scoreboard-row-you"]);
  });

  it("the clock row is a timer that is not live; its ticks are hidden and the numeral carries the time", () => {
    render(<Scoreboard view={view} />);
    const clock = screen.getByTestId("scoreboard-clock");
    expect(clock).toHaveAttribute("role", "timer");
    expect(clock).toHaveAttribute("aria-live", "off");
    expect(clock).toHaveAttribute("data-phase", "running");
    expect(clock).toHaveTextContent("match clock");
    expect(clock).toHaveTextContent("≈27s a move");
    expect(clock).toHaveTextContent("3:12");
    const track = within(clock).getByTestId("scoreboard-clock-track");
    expect(track).toHaveAttribute("aria-hidden", "true");
    expect(track.querySelectorAll('[data-tick="on"]')).toHaveLength(39);
    expect(track.querySelectorAll("[data-tick]")).toHaveLength(60);
  });

  it("each player row has a name, a sub-line, the moves as a progressbar and the total", () => {
    render(<Scoreboard view={view} />);
    const opp = screen.getByTestId("scoreboard-row-opp");
    expect(within(opp).getByTestId("scoreboard-name")).toHaveTextContent("Kári");
    expect(within(opp).getByTestId("scoreboard-subline")).toHaveTextContent("1265 · 6 of 10 · playing");
    const track = within(opp).getByTestId("scoreboard-track");
    expect(track).toHaveAttribute("role", "progressbar");
    expect(track).toHaveAttribute("aria-valuetext", "4 of 10 moves left");
    expect(track).toHaveAttribute("aria-valuenow", "4");
    expect(within(opp).getByTestId("scoreboard-total")).toHaveTextContent("34");
    const you = screen.getByTestId("scoreboard-row-you");
    expect(within(you).getByTestId("scoreboard-turn")).toHaveAttribute("data-tone", "seat");
    expect(within(you).getByTestId("scoreboard-track")).toHaveAttribute("aria-valuetext", "7 of 10 moves left");
  });

  it("the seat colours come from the seat, never from player_a / player_b", () => {
    render(<Scoreboard view={view} />);
    expect(screen.getByTestId("scoreboard-row-you").style.getPropertyValue("--seat-ink")).toBe("var(--you)");
    expect(screen.getByTestId("scoreboard-row-opp").style.getPropertyValue("--seat-ink")).toBe("var(--opp)");
  });

  it("names link to the profiles, in a new tab while the match is live", () => {
    render(<Scoreboard view={view} profiles={{ you: "/en/profile/birna", opp: "/en/profile/kari" }} profileInNewTab />);
    const link = within(screen.getByTestId("scoreboard-row-opp")).getByRole("link", { name: /Kári/ });
    expect(link).toHaveAttribute("href", "/en/profile/kari");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("the totals shown can be the caller's count-up values", () => {
    render(<Scoreboard view={view} totals={{ you: 40, opp: 34 }} />);
    expect(within(screen.getByTestId("scoreboard-row-you")).getByTestId("scoreboard-total")).toHaveTextContent("40");
  });

  it("an outlined lane says so for the stylesheet", () => {
    const gone = deriveScoreboard({ ...INPUT, opp: { ...INPUT.opp, reconnectMsLeft: 42_000 } }, copyEn);
    render(<Scoreboard view={gone} />);
    expect(within(screen.getByTestId("scoreboard-row-opp")).getByTestId("scoreboard-track")).toHaveAttribute("data-mode", "outlined");
  });

  it("on a phone the blocks fill with no tick marks", () => {
    render(<Scoreboard view={view} compact />);
    const track = screen.getByTestId("scoreboard-clock-track");
    expect(track.querySelectorAll("[data-tick]")).toHaveLength(0);
    const blocks = track.querySelectorAll("[data-block]");
    expect(blocks).toHaveLength(10);
    expect((blocks[6] as HTMLElement).style.getPropertyValue("--fill")).toBe("0.5");
    expect(screen.getByTestId("scoreboard")).toHaveAttribute("data-compact", "true");
  });
});
