import type { FieldInteraction } from "@/lib/room/fieldInteraction";
import { liveText, type LiveState } from "@/lib/room/ledgerRows";
import type { Coordinate } from "@/lib/types/board";

export interface LetterFacts {
  letter: string;
  value: number;
}

/**
 * The live-row state a field interaction implies (spec 047 amendment P1). The
 * reducer knows coordinates, not letters, so the caller supplies the lookup.
 * Match-level states (`played` on a paused clock, `resolving`, `illegal`) are
 * layered on by the controller.
 */
export function liveStateFor(interaction: FieldInteraction, letterAt: (at: Coordinate) => LetterFacts): LiveState {
  switch (interaction.kind) {
    case "committed":
      return { kind: "played" };
    case "preview":
      return interaction.price === "pending"
        ? { kind: "previewing", total: null, words: [] }
        : { kind: "previewing", total: interaction.price.total, words: interaction.price.words.map((w) => w.word) };
    case "picked":
      return { kind: "picking", ...letterAt(interaction.a) };
    default:
      return { kind: "idle" };
  }
}

/** One line for a ledger that has no live row (the lobby's warm-up field). */
export function hintLine(interaction: FieldInteraction, letterAt: (at: Coordinate) => LetterFacts): string {
  const { line1, line2 } = liveText(liveStateFor(interaction, letterAt));
  return [line1, line2].filter(Boolean).join(" · ");
}
