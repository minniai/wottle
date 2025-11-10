import { randomUUID } from "node:crypto";

import {
  BOARD_SIZE,
  BOARD_TILE_COUNT,
} from "../../lib/constants/board";

export const ICELANDIC_LETTER_WEIGHTS: Record<string, number> = {
  A: 9,
  Á: 3,
  B: 2,
  D: 4,
  Ð: 2,
  E: 7,
  É: 2,
  F: 3,
  G: 4,
  H: 3,
  I: 7,
  Í: 3,
  J: 4,
  K: 4,
  L: 6,
  M: 4,
  N: 7,
  O: 2,
  Ó: 3,
  P: 2,
  R: 7,
  S: 6,
  T: 6,
  U: 3,
  Ú: 2,
  V: 2,
  X: 1,
  Y: 1,
  Ý: 1,
  Þ: 2,
  Æ: 2,
  Ö: 2,
};

export interface GenerateBoardOptions {
  matchId?: string;
  weights?: Record<string, number>;
}

export function getLetterWeights(): Record<string, number> {
  return { ...ICELANDIC_LETTER_WEIGHTS };
}

export function generateBoard(options: GenerateBoardOptions = {}): string[][] {
  const weights = options.weights ?? ICELANDIC_LETTER_WEIGHTS;
  const letters = Object.keys(weights);
  if (letters.length > BOARD_TILE_COUNT) {
    throw new Error("Alphabet larger than board capacity");
  }

  const matchId = options.matchId ?? randomUUID();
  const rng = createRng(matchId);
  const weightedLetters = createWeightedDistribution(weights);
  const cells: string[] = [];

  // Ensure each alphabet character appears at least once
  cells.push(...letters);

  for (let i = cells.length; i < BOARD_TILE_COUNT; i += 1) {
    const roll = rng();
    const selected = pickLetter(weightedLetters, roll);
    cells.push(selected);
  }

  shuffleInPlace(cells, rng);

  const board: string[][] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const start = row * BOARD_SIZE;
    board.push(cells.slice(start, start + BOARD_SIZE));
  }

  return board;
}

type Distribution = Array<{ letter: string; cumulative: number }>;

function createWeightedDistribution(weights: Record<string, number>): Distribution {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) {
    throw new Error("Letter weights must sum to a positive value");
  }

  let cumulative = 0;
  return entries.map(([letter, weight]) => {
    cumulative += weight / totalWeight;
    return { letter, cumulative };
  });
}

function pickLetter(distribution: Distribution, roll: number): string {
  for (const entry of distribution) {
    if (roll <= entry.cumulative) {
      return entry.letter;
    }
  }
  return distribution.at(-1)?.letter ?? "A";
}

type Rng = () => number;

function createRng(seed: string): Rng {
  const [a, b, c, d] = cyrb128(seed);
  return sfc32(a, b, c, d);
}

function shuffleInPlace(items: string[], rng: Rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function cyrb128(str: string) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0, k: number; i < str.length; i += 1) {
    k = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ k, 597399067);
    h2 = Math.imul(h2 ^ k, 2869860233);
    h3 = Math.imul(h3 ^ k, 951274213);
    h4 = Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h2) >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): Rng {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) | 0;
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const board = generateBoard({ matchId: process.env.MATCH_ID });
  const payload = {
    event: "supabase.generateBoard.preview",
    timestamp: new Date().toISOString(),
    matchId: process.env.MATCH_ID,
    board,
  };
  console.log(JSON.stringify(payload));
}

