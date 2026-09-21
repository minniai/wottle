import { points } from "@/lib/constants/copy";
import { calculateLengthBonus } from "@/lib/game-engine/scorer";
import { MISS_PENALTY } from "@/lib/scoring/missPenalty";

/** The scoring rules as the engine applies them (rules doc §5; spec 048 FR-018). */
export const SCORING_ROWS: { rule: string; value: string }[] = [
  { rule: "letter values", value: "the numerals on the letters, added up" },
  { rule: "length bonus", value: `(letters − 2) × ${calculateLengthBonus(3)}` },
  { rule: "a letter the opponent froze", value: "counts for length, not for points" },
  { rule: "the same word somewhere new", value: "scores again" },
  // Rules §5.6 (2026-09-21).
  { rule: "a move with no word", value: points(MISS_PENALTY) },
];

export function ScoringTable() {
  return (
    <table className="rules__table" data-testid="rules-scoring">
      <tbody>
        {SCORING_ROWS.map((row) => (
          <tr key={row.rule}>
            <td>{row.rule}</td>
            <td className="rules__mono">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
