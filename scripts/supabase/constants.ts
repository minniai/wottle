export const PRIMARY_BOARD_ID = "primary-board" as const;

export const BASELINE_GRID: string[][] = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) =>
    String.fromCharCode(65 + ((x + y) % 26))
  )
);
