export interface GameConfig {
  /** The maximum number of rounds to play before the match ends. */
  maxRounds: number;
  /** The time limit for a single round in milliseconds. */
  timePerRoundMs: number;
  /** The maximum allowed length for a submitted word. If omitted, constrained by board. */
  maxWordLength?: number;
  /** The explicitly permitted directions for reading a primary word. */
  allowedDirections: Array<'horizontal' | 'vertical'>;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxRounds: 5,
  timePerRoundMs: 60000,
  allowedDirections: ['horizontal', 'vertical'],
};
