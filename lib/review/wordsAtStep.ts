import type { AccumulatedWord } from "@/lib/room/ledgerRows";
import type { ReviewStep } from "@/lib/types/review";

/**
 * Spec 071 (FR-032): the words scored up to step k, as the field's bands and the ledger read them.
 * Step k's own move is the live one (its bands at 30%); earlier ones are settled (14%).
 */
export function wordsAtStep(steps: ReviewStep[], k: number): { words: AccumulatedWord[]; liveMoveKey: string | null } {
  const reached = steps.filter((s) => s.index <= k && s.kind === "move");
  const words = reached.flatMap((s) => s.words.map((w) => ({ ...w, moveSeq: s.moveNumber ?? 0, globalSeq: s.index })));
  const current = reached.find((s) => s.index === k);
  const liveMoveKey = current?.words.length ? `${current.words[0].playerId}:${current.moveNumber}` : null;
  return { words, liveMoveKey };
}
