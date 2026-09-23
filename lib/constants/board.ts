export const BOARD_SIZE = 10;

export const BOARD_MAX_INDEX = BOARD_SIZE - 1;

export const BOARD_DIMENSIONS_LABEL = `${BOARD_SIZE}x${BOARD_SIZE}`;

export const BOARD_TILE_COUNT = BOARD_SIZE * BOARD_SIZE;


/**
 * The empty ruled field: ten rows of ten blank cells. Drawn at the table
 * (spec 069), where the server holds the letters until both players sit down.
 */
export const BLANK_BOARD: readonly string[][] = Object.freeze(
  Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => "")),
) as readonly string[][];

export function boardOrBlank(board: string[][] | null | undefined): string[][] {
  return board ?? (BLANK_BOARD as string[][]);
}
