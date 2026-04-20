import type { ReactNode } from "react";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface BoardCoordLabelsProps {
  children: ReactNode;
}

export function BoardCoordLabels({ children }: BoardCoordLabelsProps) {
  return (
    <div className="board-coords">
      <div
        data-testid="board-coords-top"
        className="board-coords__top font-mono text-[9px] uppercase tracking-[0.06em] text-ink-soft"
      >
        {COLS.map((c) => (
          <span key={c} role="presentation">
            {c}
          </span>
        ))}
      </div>
      <div
        data-testid="board-coords-left"
        className="board-coords__left font-mono text-[9px] uppercase tracking-[0.06em] text-ink-soft"
      >
        {ROWS.map((r) => (
          <span key={r} role="presentation">
            {r}
          </span>
        ))}
      </div>
      <div className="board-coords__board">{children}</div>
    </div>
  );
}
