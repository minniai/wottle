import { GameConfig } from '../types';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxRounds: 5,
  timePerRoundMs: 60000,
  // Per PRD §1.2 — a valid word is a sequence of 3 or more letters.
  // The entire scoring pipeline reads this constant: scanner, cross-validator,
  // delta detector. Changing it to 2 re-enables 2-letter scoring end-to-end.
  minimumWordLength: 3,
  boardSize: 10,
  allowedDirections: ['horizontal', 'vertical'],
  language: 'is',
};
