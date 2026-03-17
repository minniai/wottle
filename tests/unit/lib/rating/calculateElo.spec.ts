import { describe, it, expect } from "vitest";
import {
  determineKFactor,
  calculateElo,
} from "../../../../lib/rating/calculateElo";

describe("determineKFactor", () => {
  it("should return 32 for new players with fewer than 20 games", () => {
    expect(determineKFactor(0)).toBe(32);
    expect(determineKFactor(1)).toBe(32);
    expect(determineKFactor(10)).toBe(32);
    expect(determineKFactor(19)).toBe(32);
  });

  it("should return 16 for established players with 20+ games", () => {
    expect(determineKFactor(20)).toBe(16);
    expect(determineKFactor(21)).toBe(16);
    expect(determineKFactor(100)).toBe(16);
  });
});

describe("calculateElo", () => {
  it("should calculate correctly for equal ratings with a win (K=32)", () => {
    const result = calculateElo({
      playerRating: 1200,
      opponentRating: 1200,
      actualScore: 1.0,
      kFactor: 32,
    });
    expect(result.delta).toBe(16);
    expect(result.newRating).toBe(1216);
    expect(result.expectedScore).toBeCloseTo(0.5, 4);
  });

  it("should calculate correctly for equal ratings with a loss (K=32)", () => {
    const result = calculateElo({
      playerRating: 1200,
      opponentRating: 1200,
      actualScore: 0.0,
      kFactor: 32,
    });
    expect(result.delta).toBe(-16);
    expect(result.newRating).toBe(1184);
  });

  it("should give small gain when higher-rated player wins", () => {
    const result = calculateElo({
      playerRating: 1400,
      opponentRating: 1100,
      actualScore: 1.0,
      kFactor: 16,
    });
    // Expected score for 1400 vs 1100 is high (~0.849)
    // Delta = 16 * (1.0 - 0.849) ≈ 2.4 → rounds to 2
    expect(result.delta).toBeGreaterThan(0);
    expect(result.delta).toBeLessThan(8);
    expect(result.newRating).toBe(1400 + result.delta);
  });

  it("should give large gain when lower-rated player wins (upset)", () => {
    const result = calculateElo({
      playerRating: 1100,
      opponentRating: 1400,
      actualScore: 1.0,
      kFactor: 32,
    });
    // Expected score for 1100 vs 1400 is low (~0.151)
    // Delta = 32 * (1.0 - 0.151) ≈ 27
    expect(result.delta).toBeGreaterThan(20);
    expect(result.newRating).toBe(1100 + result.delta);
  });

  it("should return zero delta for draw between equal ratings", () => {
    const result = calculateElo({
      playerRating: 1200,
      opponentRating: 1200,
      actualScore: 0.5,
      kFactor: 32,
    });
    expect(result.delta).toBe(0);
    expect(result.newRating).toBe(1200);
  });

  it("should converge ratings for draw between unequal ratings", () => {
    const higher = calculateElo({
      playerRating: 1400,
      opponentRating: 1100,
      actualScore: 0.5,
      kFactor: 16,
    });
    const lower = calculateElo({
      playerRating: 1100,
      opponentRating: 1400,
      actualScore: 0.5,
      kFactor: 16,
    });
    // Higher-rated player should lose points on draw
    expect(higher.delta).toBeLessThan(0);
    // Lower-rated player should gain points on draw
    expect(lower.delta).toBeGreaterThan(0);
  });

  it("should enforce rating floor of 100", () => {
    const result = calculateElo({
      playerRating: 100,
      opponentRating: 1500,
      actualScore: 0.0,
      kFactor: 32,
    });
    expect(result.newRating).toBe(100);
    // Delta reflects the floor, not raw calculation
    expect(result.delta).toBe(0);
  });

  it("should round to nearest integer", () => {
    // 1200 vs 1201 with K=32 win → expectedScore ~0.4986
    // delta = 32 * (1.0 - 0.4986) = 16.045 → rounds to 16
    const result = calculateElo({
      playerRating: 1200,
      opponentRating: 1201,
      actualScore: 1.0,
      kFactor: 32,
    });
    expect(Number.isInteger(result.delta)).toBe(true);
    expect(Number.isInteger(result.newRating)).toBe(true);
  });

  it("should use K=16 for established players", () => {
    const k32 = calculateElo({
      playerRating: 1200,
      opponentRating: 1200,
      actualScore: 1.0,
      kFactor: 32,
    });
    const k16 = calculateElo({
      playerRating: 1200,
      opponentRating: 1200,
      actualScore: 1.0,
      kFactor: 16,
    });
    expect(k32.delta).toBe(16);
    expect(k16.delta).toBe(8);
  });
});
