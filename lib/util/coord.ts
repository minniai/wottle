const COLUMNS = "ABCDEFGHIJ";

export function formatCoord(x: number, y: number): string {
  if (x < 0 || x >= COLUMNS.length) {
    throw new RangeError(`Column index out of range: ${x}`);
  }
  if (y < 0 || y >= 10) {
    throw new RangeError(`Row index out of range: ${y}`);
  }
  return `${COLUMNS[x]}${y + 1}`;
}
