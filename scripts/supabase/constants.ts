import { BOARD_SIZE } from "@/lib/constants/board";

export const PRIMARY_BOARD_ID = "primary-board" as const;

export const BASELINE_GRID: string[][] = Array.from({ length: BOARD_SIZE }, (_, y) =>
  Array.from({ length: BOARD_SIZE }, (_, x) =>
    String.fromCharCode(65 + ((x + y) % 26))
  )
);
