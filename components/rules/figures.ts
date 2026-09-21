import type { WordBand } from "@/lib/room/bandGeometry";
import type { Coordinate } from "@/lib/types/board";

/**
 * The rules page's three figures (spec 048 US5): literal boards and bands in the
 * field's own grammar. The board is the fixture board so a reader who has seen
 * the room recognises it.
 */
export const RULES_BOARD: string[][] = [
  ["Þ", "A", "K", "R", "E", "I", "S", "T", "Ö", "L"],
  ["G", "Æ", "F", "U", "N", "D", "I", "R", "Ó", "M"],
  ["S", "K", "B", "O", "R", "Ð", "T", "Ý", "U", "N"],
  ["Á", "L", "N", "I", "R", "Ö", "S", "K", "U", "M"],
  ["E", "Y", "Ð", "I", "H", "V", "A", "G", "T", "L"],
  ["R", "Ú", "N", "T", "Æ", "K", "S", "I", "Ð", "Ó"],
  ["Ö", "F", "L", "U", "G", "R", "Á", "L", "E", "K"],
  ["M", "Ý", "S", "J", "A", "Ð", "E", "T", "R", "I"],
  ["I", "S", "K", "Ó", "P", "U", "N", "Æ", "H", "Ö"],
  ["T", "R", "A", "U", "Ð", "L", "E", "G", "I", "S"],
];

const cells = (list: [number, number][]): Coordinate[] => list.map(([x, y]) => ({ x, y }));

/** Figure 1: the two letters of a swap, pinned. */
export const SWAP_PINS: [Coordinate, Coordinate] = [{ x: 4, y: 2 }, { x: 3, y: 5 }];

const BORD = cells([[2, 2], [3, 2], [4, 2], [5, 2]]);
const GILT = cells([[7, 4], [7, 5], [7, 6], [7, 7]]);
const LEK = cells([[7, 6], [8, 6], [9, 6]]);

/** Figure 2: one word each way, with the chevron at the reading's start. */
export const WORD_BANDS: WordBand[] = [
  { id: "borð", seat: "you", cells: BORD, wordCells: BORD, direction: "ltr", strength: "settled", move: 1, word: "BORÐ" },
  { id: "gilt", seat: "opp", cells: GILT, wordCells: GILT, direction: "ttb", strength: "settled", move: 1, word: "GILT" },
];

/**
 * Figure 3: a crossing — LEK crosses GILT at the L, which the opponent froze
 * first, so it keeps his colour and LEK's band covers E and K (spec 049 US2).
 */
export const CROSSING_BANDS: WordBand[] = [
  ...WORD_BANDS,
  { id: "lek", seat: "you", cells: LEK.slice(1), wordCells: LEK, direction: "ltr", strength: "settled", move: 3, word: "LEK" },
];

export type RulesFigureKind = "swap" | "words" | "crossing";
