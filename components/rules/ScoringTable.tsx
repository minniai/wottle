import type { Copy } from "@/lib/i18n/copy/types";
import { calculateLengthBonus } from "@/lib/game-engine/scorer";
import { MISS_PENALTY } from "@/lib/scoring/missPenalty";

/** The scoring rules as the engine applies them (rules doc §5; spec 048 FR-018), in the page's language. */
export function scoringRowsFor(copy: Copy): { rule: string; value: string }[] {
  // Rules §5.6 (2026-09-21): the last row is the miss penalty.
  return copy.scoringRows(calculateLengthBonus(3), copy.points(MISS_PENALTY));
}

export function ScoringTable({ copy }: { copy: Copy }) {
  return (
    <table className="rules__table" data-testid="rules-scoring">
      <tbody>
        {scoringRowsFor(copy).map((row) => (
          <tr key={row.rule}>
            <td>{row.rule}</td>
            <td className="rules__mono">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
