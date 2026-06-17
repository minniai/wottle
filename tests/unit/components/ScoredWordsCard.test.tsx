import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { WordHistoryRow } from "@/components/match/FinalSummary";
import {
  ScoredWordsCard,
  buildScoredWordRounds,
} from "@/components/match/ScoredWordsCard";

const row = (
  roundNumber: number,
  playerId: string,
  word: string,
  totalPoints: number,
): WordHistoryRow => ({
  roundNumber,
  playerId,
  word,
  totalPoints,
  lettersPoints: totalPoints,
  bonusPoints: 0,
  coordinates: [],
});

const PLAYER = "player-1";
const OPPONENT = "player-2";

describe("buildScoredWordRounds", () => {
  test("keeps only the given player's words", () => {
    const words = [
      row(1, PLAYER, "ARÐUR", 12),
      row(1, OPPONENT, "TÓM", 7),
    ];

    const rounds = buildScoredWordRounds(words, PLAYER, [1]);

    expect(rounds).toHaveLength(1);
    expect(rounds[0].words.map((w) => w.word)).toEqual(["ARÐUR"]);
  });

  test("includes completed rounds with no scoring as empty entries", () => {
    const words = [row(1, PLAYER, "ARÐUR", 12)];

    const rounds = buildScoredWordRounds(words, PLAYER, [1, 2]);

    const round2 = rounds.find((r) => r.roundNumber === 2);
    expect(round2).toBeDefined();
    expect(round2!.words).toEqual([]);
  });

  test("sorts rounds newest first", () => {
    const words = [
      row(1, PLAYER, "ARÐUR", 12),
      row(3, PLAYER, "KÓLU", 14),
      row(2, PLAYER, "HESTUR", 21),
    ];

    const rounds = buildScoredWordRounds(words, PLAYER, [1, 2, 3]);

    expect(rounds.map((r) => r.roundNumber)).toEqual([3, 2, 1]);
  });
});

describe("ScoredWordsCard", () => {
  const renderCard = (words: WordHistoryRow[], completedRounds: number[]) =>
    render(
      <ScoredWordsCard
        title="Your words"
        playerId={PLAYER}
        accumulatedWords={words}
        completedRounds={completedRounds}
        playerColor="#38BDF8"
      />,
    );

  test("renders the title", () => {
    renderCard([], []);
    expect(screen.getByText("Your words")).toBeInTheDocument();
  });

  test("shows a placeholder when no words have been scored yet", () => {
    renderCard([], []);
    expect(screen.getByTestId("scored-words-empty")).toBeInTheDocument();
  });

  test("renders each scored word with its points under its round", () => {
    renderCard([row(1, PLAYER, "ARÐUR", 12)], [1]);

    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("ARÐUR")).toBeInTheDocument();
    expect(screen.getByText("+12")).toBeInTheDocument();
  });

  test("shows 'no words' for a completed round the player did not score in", () => {
    renderCard([row(1, PLAYER, "ARÐUR", 12)], [1, 2]);

    expect(screen.getByText("Round 2")).toBeInTheDocument();
    expect(screen.getByText("no words")).toBeInTheDocument();
  });

  test("does not render the opponent's words", () => {
    renderCard(
      [row(1, PLAYER, "ARÐUR", 12), row(1, OPPONENT, "TÓM", 7)],
      [1],
    );

    expect(screen.queryByText("TÓM")).not.toBeInTheDocument();
  });
});
