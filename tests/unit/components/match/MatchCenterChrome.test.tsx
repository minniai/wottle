import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchCenterChrome } from "@/components/match/MatchCenterChrome";

describe("MatchCenterChrome", () => {
  test("renders the eyebrow with current/total rounds", () => {
    render(
      <MatchCenterChrome
        currentRound={3}
        totalRounds={10}
        status="your-move"
      />,
    );
    expect(screen.getByText("Round 3 / 10")).toBeInTheDocument();
  });

  test("renders the shared RoundPipBar", () => {
    render(
      <MatchCenterChrome
        currentRound={3}
        totalRounds={10}
        status="your-move"
      />,
    );
    expect(screen.getByLabelText("Round 3 of 10")).toBeInTheDocument();
  });

  test.each([
    ["your-move", "YOUR MOVE · SWAP TWO TILES"],
    ["waiting", "WAITING FOR OPPONENT"],
    ["resolving", "RESOLVING ROUND"],
  ] as const)("status=%s renders label %s", (status, expected) => {
    render(
      <MatchCenterChrome
        currentRound={1}
        totalRounds={10}
        status={status}
      />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
