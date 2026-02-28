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
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxRounds: 5,
  timePerRoundMs: 60000,
  minimumWordLength: 2,
  boardSize: 15,
  allowedDirections: ['horizontal', 'vertical'],
};
