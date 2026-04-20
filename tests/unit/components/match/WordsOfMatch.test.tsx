import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { WordsOfMatch } from "@/components/match/WordsOfMatch";
import type { WordHistoryRow } from "@/components/match/FinalSummary";

const words: WordHistoryRow[] = [
  {
    roundNumber: 2,
    playerId: "pA",
    word: "BARN",
    totalPoints: 11,
    lettersPoints: 6,
    bonusPoints: 5,
    coordinates: [],
  },
  {
    roundNumber: 4,
    playerId: "pA",
    word: "HESTUR",
    totalPoints: 22,
    lettersPoints: 12,
    bonusPoints: 10,
    coordinates: [],
  },
  {
    roundNumber: 1,
    playerId: "pB",
    word: "VATN",
    totalPoints: 8,
    lettersPoints: 6,
    bonusPoints: 2,
    coordinates: [],
  },
];

describe("WordsOfMatch", () => {
  test("renders header with found count", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    expect(screen.getByText("Words of the match")).toBeInTheDocument();
    expect(screen.getByText("3 found")).toBeInTheDocument();
  });

  test("sorts rows by roundNumber ascending", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    const rows = screen.getAllByTestId("words-of-match-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("VATN");
    expect(rows[1]).toHaveTextContent("BARN");
    expect(rows[2]).toHaveTextContent("HESTUR");
  });

  test("row shows word, R{n}, and +points", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    const [first] = screen.getAllByTestId("words-of-match-row");
    expect(first).toHaveTextContent("VATN");
    expect(first).toHaveTextContent("R1");
    expect(first).toHaveTextContent("+8");
  });

  test("rows tinted by player slot (p1 / p2)", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    const rows = screen.getAllByTestId("words-of-match-row");
    expect(rows[0].className).toMatch(/text-p2-deep/);
    expect(rows[1].className).toMatch(/text-p1-deep/);
    expect(rows[2].className).toMatch(/text-p1-deep/);
  });

  test("empty list shows a 'no words scored' placeholder", () => {
    render(<WordsOfMatch wordHistory={[]} playerASlotId="pA" />);
    expect(screen.getByText(/no words scored/i)).toBeInTheDocument();
  });
});
