import { GameConfig } from "../types";
import { BOARD_SIZE } from "./board";

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxRounds: 10,
  // Per PRD §1.2 — a valid word is a sequence of 3 or more letters.
  // The entire scoring pipeline reads this constant: scanner, cross-validator,
  // delta detector. Changing it to 2 re-enables 2-letter scoring end-to-end,
  // after `pnpm wordlists:build` writes the word_list_2_<max>_<lang>.txt lists.
  minimumWordLength: 3,
  // The longest word is the board's width. The dictionary holds only words of
  // minimumWordLength..boardSize letters (word_list_<min>_<max>_<lang>.txt,
  // `pnpm wordlists:build`).
  boardSize: BOARD_SIZE,
  allowedDirections: ["horizontal", "vertical"],
  language: "is",
};
