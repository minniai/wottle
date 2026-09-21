import { trackBandRecordMismatch } from "@/lib/observability/log";
import type { Coordinate } from "@/lib/types/board";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";

const upper = (s: string) => s.toLocaleUpperCase("is");

/**
 * One message per word record that the board does not spell (spec 047 FR-002,
 * review S5). The fixture test pins it to `[]`; `reportWordIntegrity` runs it
 * in the room. Letters compare in Icelandic upper case (ð → Ð, æ → Æ).
 */
export function assertWordsSpellBoard(board: string[][], words: AccumulatedWord[]): string[] {
  const problems: string[] = [];
  for (const w of words) {
    const message = checkWord(board, w);
    if (message) problems.push(`${w.playerId.slice(0, 8)} M${w.moveSeq} ${w.word}: ${message}`);
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

/** Matches already reported: the room re-renders on every snapshot; one warn per match is the contract. */
const reported = new Set<string>();

/**
 * Report the first record the board does not spell as `bands.record-mismatch`,
 * once per match, in every environment (spec 049 contracts/integrity-check.md).
 * Never throws: a report must not be what breaks the room.
 */
export function reportWordIntegrity(matchId: string, board: string[][], words: AccumulatedWord[]): void {
  if (reported.has(matchId)) return;
  try {
    const [first] = assertWordsSpellBoard(board, words);
    if (!first) return;
    reported.add(matchId);
    trackBandRecordMismatch({ matchId, record: first });
  } catch (error) {
    console.error("[wordIntegrity] could not check the records:", error);
  }
}

/** @internal — test hook. */
export function __resetWordIntegrityForTests(): void {
  reported.clear();
}
