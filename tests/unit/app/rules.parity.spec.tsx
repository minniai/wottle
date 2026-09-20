import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RulesPage from "@/app/rules/page";
import { SCORING_ROWS } from "@/components/rules/ScoringTable";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";
import { calculateLengthBonus } from "@/lib/game-engine/scorer";
import { TOTAL_ROUNDS } from "@/lib/room/ledgerRows";
import { MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";

/** Spec 048 FR-018: the page cannot drift from the engine. */
describe("/rules parity", () => {
  it("states the scoring rules the engine applies", () => {
    expect(SCORING_ROWS.map((r) => r.rule)).toEqual(["letter values", "length bonus", "a letter the opponent froze", "a word you already scored"]);
    expect(SCORING_ROWS[1].value).toBe(`(letters − 2) × ${calculateLengthBonus(3)}`);
    expect(calculateLengthBonus(DEFAULT_GAME_CONFIG.minimumWordLength)).toBe(5);
    expect(SCORING_ROWS[3].value).toBe("0");
  });

  it("has six sections in order, three figures and the clock and round figures from the constants", () => {
    render(<RulesPage />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Swap two letters.",
      "Three letters or more, in a straight line.",
      "Scored letters freeze in your ink.",
      "Values and length.",
      "Five minutes for the whole match.",
      "Most points after ten rounds.",
    ]);
    for (const kind of ["swap", "words", "crossing"]) expect(screen.getByTestId(`rules-figure-${kind}`)).toBeInTheDocument();
    expect(screen.getByTestId("rules-page")).toHaveTextContent(`one clock of ${MATCH_CLOCK_BUDGET_MS / 60_000}:00 for all ${TOTAL_ROUNDS} rounds`);
    expect(screen.getByTestId("rules-figure-words").querySelector(".field")).toHaveAttribute("aria-label", "the field");
    expect(screen.getByTestId("rules-figure-words").querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.getByTestId("rules-figure-words").querySelector(".rules__field")).toHaveAttribute("inert");
    expect(screen.getByTestId("rules-play")).toHaveAttribute("href", "/lobby");
    expect(screen.getByTestId("rules-back-top")).toHaveAttribute("href", "/lobby");
  });

  it("minimum word length is three, as the page says", () => {
    expect(DEFAULT_GAME_CONFIG.minimumWordLength).toBe(3);
  });
});
