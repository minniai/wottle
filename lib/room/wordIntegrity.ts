import type { Coordinate } from "@/lib/types/board";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";

const upper = (s: string) => s.toLocaleUpperCase("is");

/**
 * One message per word record that the board does not spell (spec 047 FR-002,
 * review S5). Run in development by `MatchRoomController`; the fixture test
 * pins it to `[]`. Letters compare in Icelandic upper case (ð → Ð, æ → Æ).
 */
export function assertWordsSpellBoard(board: string[][], words: AccumulatedWord[]): string[] {
  const problems: string[] = [];
  for (const w of words) {
    const message = checkWord(board, w);
    if (message) problems.push(`R${w.roundNumber} ${w.word}: ${message}`);
  }
  return problems;
}

function checkWord(board: string[][], w: AccumulatedWord): string | null {
  const expected = upper(w.word);
  const letters = [...expected];
  if (w.coordinates.length !== letters.length) {
    return `expected ${letters.length} coordinates, got ${w.coordinates.length}`;
  }
  const spelled = spellAt(board, w.coordinates);
  return spelled === expected ? null : `board spells ${spelled} at ${describeRun(w.coordinates)}`;
}

function spellAt(board: string[][], coordinates: Coordinate[]): string {
  return coordinates.map((c) => upper(board[c.y]?.[c.x] ?? "?")).join("");
}

function describeRun(coordinates: Coordinate[]): string {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return `(${first?.x},${first?.y})…(${last?.x},${last?.y})`;
}
