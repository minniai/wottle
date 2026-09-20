import { frozenNotice, PICK_A_LETTER, PLAYED, PREVIEW_INSTRUCTION, PREVIEWING, picking, previewLine, RESOLVING, TAP_SECOND_LETTER } from "@/lib/constants/copy";
import type { LiveLines } from "./ledgerTypes";

/** The live-row state the field interaction implies (spec 047 amendment P1). */
export type LiveState =
  | { kind: "idle" }
  | { kind: "picking"; letter: string; value: number }
  /** Opt-in preview: `total` is null until the server has priced the swap. */
  | { kind: "previewing"; total: number | null; words: string[] }
  | { kind: "played" }
  /** A frozen letter was tapped; held for two seconds, then back to idle. */
  | { kind: "illegal"; ownerName: string; round: number }
  | { kind: "resolving" };

/**
 * The live row's two lines (spec 047 amendment P1, design system §7): line 1
 * is the state, line 2 the instruction — present only while there is a next
 * step to take. Every beat has a signal, and nothing is said twice.
 */
export function liveText(live: LiveState): LiveLines {
  switch (live.kind) {
    case "picking":
      return { line1: picking(live.letter, live.value), line2: TAP_SECOND_LETTER };
    case "previewing":
      return { line1: live.total === null ? PREVIEWING : previewLine(live.total, live.words), line2: PREVIEW_INSTRUCTION };
    case "played":
      return { line1: PLAYED, line2: "" };
    case "illegal":
      return { line1: frozenNotice(live.ownerName, live.round), line2: "" };
    case "resolving":
      return { line1: RESOLVING, line2: "" };
    default:
      return { line1: PICK_A_LETTER, line2: "" };
  }
}
