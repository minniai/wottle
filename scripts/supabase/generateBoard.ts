import { randomUUID } from "node:crypto";

import {
  ICELANDIC_LETTER_WEIGHTS,
  generateBoard as generateSeededBoard,
  getLetterWeights,
} from "@/lib/game-engine/boardGenerator";

export { ICELANDIC_LETTER_WEIGHTS, getLetterWeights };

export interface GenerateBoardOptions {
  matchId?: string;
  weights?: Record<string, number>;
}

/** CLI/seed-script wrapper: defaults the seed to a random UUID (pure core lives in lib/game-engine). */
export function generateBoard(options: GenerateBoardOptions = {}): string[][] {
  return generateSeededBoard({ seed: options.matchId ?? randomUUID(), weights: options.weights });
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
