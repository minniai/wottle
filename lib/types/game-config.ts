/** Supported dictionary languages. */
export type Language = 'is' | 'en' | 'se' | 'no' | 'dk';

export interface GameConfig {
  /** The maximum number of rounds to play before the match ends. */
  maxRounds: number;
  /** The time limit for a single round in milliseconds. */
  timePerRoundMs: number;
  /** The minimum allowed length for a submitted word. */
  minimumWordLength: number;
  /** The maximum allowed length for a submitted word. If omitted, constrained by board. */
  maxWordLength?: number;
  /** The dimensions of the square game board (e.g., 15 for a 15x15 board). */
  boardSize: number;
  /** The explicitly permitted directions for reading a primary word. */
  allowedDirections: Array<'horizontal' | 'vertical'>;
  /** Language code selecting the dictionary and letter-scoring table. */
  language: Language;
}

export interface MoveEvaluation {
  /** True if the move is legal (orthogonal, valid words, adjacent). */
  isValid: boolean;
  /** The complete list of distinct words formed by the move. */
  words: Array<{ word: string, startIndex: number, direction: 'horizontal' | 'vertical' }>;
  /** The computed score for the move. */
  score: number;
  /** The reason for rejection if isValid is false. */
  error?: string;
}
