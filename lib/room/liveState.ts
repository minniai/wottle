import { getLanguagePack } from "@/lib/game-engine/languagePack";
import type { FieldInteraction } from "@/lib/room/fieldInteraction";
import type { LiveState } from "@/lib/room/liveLines";
import type { BoardGrid, Coordinate } from "@/lib/types/board";
import type { Language } from "@/lib/types/game-config";

export interface LetterFacts {
  letter: string;
  value: number;
}

/** The numeral in a cell's gutter, in the match's language (spec 060); 0 for an empty cell or an unknown letter. */
export function letterValue(letter: string, language: Language): number {
  const values = getLanguagePack(language).letterValues;
  return values[letter.toUpperCase()] ?? values[letter] ?? 0;
}

/** The letter-and-value lookup `liveStateFor` needs, over one board. */
export function letterFactsOn(board: BoardGrid, language: Language): (at: Coordinate) => LetterFacts {
  return (at) => {
    const letter = board[at.y]?.[at.x] ?? "";
    return { letter, value: letterValue(letter, language) };
  };
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
    case "picked":
      return { kind: "picking", ...letterAt(interaction.a) };
    default:
      return { kind: "idle" };
  }
}
