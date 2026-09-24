import type { Copy } from "@/lib/i18n/copy/types";
import type { ProfileRecord } from "@/lib/types/profile";

/** The record row (spec 072 FR-032): won, lost, drawn, and won ÷ matches as a whole percent, `—` with none. */
export function recordCells(record: ProfileRecord, copy: Copy): { value: string; label: string }[] {
  const rate = record.winRate === null ? "—" : `${Math.round(record.winRate * 100)}%`;
  return [
    { value: String(record.won), label: copy.WON },
    { value: String(record.lost), label: copy.LOST },
    { value: String(record.drawn), label: copy.DRAWN },
    { value: rate, label: copy.WIN_RATE },
  ];
}

/** won ÷ matches (draws count as matches), or null with none. */
export function winRateOf(won: number, lost: number, drawn: number): number | null {
  const matches = won + lost + drawn;
  return matches === 0 ? null : won / matches;
}
