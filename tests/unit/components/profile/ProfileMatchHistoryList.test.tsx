import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileMatchHistoryList } from "@/components/profile/ProfileMatchHistoryList";

const ROWS = [
  {
    matchId: "m1",
    result: "win" as const,
    opponentId: "o1",
    opponentUsername: "birna",
    opponentDisplayName: "Birna",
    yourScore: 42,
    opponentScore: 18,
    wordsFound: 7,
    completedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    matchId: "m2",
    result: "loss" as const,
    opponentId: "o2",
    opponentUsername: "jon",
    opponentDisplayName: "Jón",
    yourScore: 12,
    opponentScore: 48,
    wordsFound: 2,
    completedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

describe("ProfileMatchHistoryList", () => {
  test("renders one row per match", () => {
    render(<ProfileMatchHistoryList matches={ROWS} />);
    expect(screen.getAllByTestId("match-history-row")).toHaveLength(2);
  });

  test("renders W/L chip per row", () => {
    render(<ProfileMatchHistoryList matches={ROWS} />);
    expect(
      screen.getByTestId("match-history-chip-m1").textContent?.trim(),
    ).toBe("W");
    expect(
      screen.getByTestId("match-history-chip-m2").textContent?.trim(),
    ).toBe("L");
  });

  test("renders opponent username + score", () => {
    render(<ProfileMatchHistoryList matches={ROWS} />);
    expect(screen.getByText(/@birna/)).toBeInTheDocument();
    expect(screen.getByText(/42\s*[–-]\s*18/)).toBeInTheDocument();
  });

  test("renders empty state when matches is empty", () => {
    render(<ProfileMatchHistoryList matches={[]} />);
    expect(screen.getByText(/No recent matches/i)).toBeInTheDocument();
  });
});
