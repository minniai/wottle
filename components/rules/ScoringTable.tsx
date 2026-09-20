import { calculateLengthBonus } from "@/lib/game-engine/scorer";

/** The scoring rules as the engine applies them (rules doc §5; spec 048 FR-018). */
export const SCORING_ROWS: { rule: string; value: string }[] = [
  { rule: "letter values", value: "the numerals on the letters, added up" },
  { rule: "length bonus", value: `(letters − 2) × ${calculateLengthBonus(3)}` },
  { rule: "a letter the opponent froze", value: "counts for length, not for points" },
  { rule: "a word you already scored", value: "0" },
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
