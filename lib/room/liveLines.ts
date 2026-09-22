import type { Copy } from "@/lib/i18n/copy/types";
import type { LiveLines } from "./ledgerTypes";

/** The live-row state the field interaction implies (spec 047 amendment P1). */
export type LiveState =
  | { kind: "idle" }
  | { kind: "picking"; letter: string; value: number }
  | { kind: "played" }
  /** A frozen letter was tapped; held for two seconds, then back to idle. `move` is the mover's Nth move that froze it. */
  | { kind: "illegal"; ownerName: string; round: number }
  | { kind: "resolving" };

/**
 * The live row's two lines (spec 047 amendment P1, design system §7): line 1
 * is the state, line 2 the instruction — present only while there is a next
 * step to take. Every beat has a signal, and nothing is said twice.
 */
export function liveText(live: LiveState, copy: Copy): LiveLines {
  switch (live.kind) {
    case "picking":
      return { line1: copy.picking(live.letter, live.value), line2: copy.TAP_SECOND_LETTER };
    case "played":
      return { line1: copy.SCORING, line2: "" };
    case "illegal":
      return { line1: copy.frozenNotice(live.ownerName, live.round), line2: "" };
    case "resolving":
      return { line1: copy.SCORING, line2: "" };
    default:
      return { line1: copy.PICK_A_LETTER, line2: "" };
  }
}
