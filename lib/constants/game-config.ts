import { GameConfig } from '../types';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxRounds: 5,
  timePerRoundMs: 60000,
  minimumWordLength: 3,
  boardSize: 10,
  allowedDirections: ['horizontal', 'vertical'],
  language: 'is',
};
