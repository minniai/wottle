import { generateBoard } from "@/lib/game-engine/boardGenerator";
import { getLanguagePack } from "@/lib/game-engine/languagePack";
import type { Language } from "@/lib/types/game-config";

/** The shared match clock (spec 050): 5:00 unless a test shortens it. */
export const MATCH_CLOCK_MS = Number(process.env.PLAYTEST_MATCH_CLOCK_MS ?? 300_000);

/** The starting board from the seed, drawn from the match language's letters (spec 060 FR-014). */
export function startingBoardFor(match: { board_seed: string | null; id: string; language: Language | null }): string[][] {
  return generateBoard({ seed: match.board_seed ?? match.id, weights: getLanguagePack(match.language ?? "is").letterWeights });
}
