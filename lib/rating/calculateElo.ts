import type {
  EloCalculationInput,
  EloCalculationResult,
} from "../types/match";

const K_FACTOR_NEW = 32;
const K_FACTOR_ESTABLISHED = 16;
const GAMES_THRESHOLD = 20;
const RATING_FLOOR = 100;

export function determineKFactor(gamesPlayed: number): number {
  return gamesPlayed < GAMES_THRESHOLD
    ? K_FACTOR_NEW
    : K_FACTOR_ESTABLISHED;
}

export function calculateElo(
  input: EloCalculationInput,
): EloCalculationResult {
  const { playerRating, opponentRating, actualScore, kFactor } = input;

  const expectedScore =
    1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

  const rawDelta = kFactor * (actualScore - expectedScore);
  const rawNewRating = playerRating + rawDelta;
  const clampedRating = Math.max(RATING_FLOOR, Math.round(rawNewRating));
  const delta = clampedRating - playerRating;

  return { newRating: clampedRating, delta, expectedScore };
}
