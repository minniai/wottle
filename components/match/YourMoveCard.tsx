import type { Coordinate } from "@/lib/types/board";
import { formatCoord } from "@/lib/util/coord";

interface YourMoveCardProps {
  selection: Coordinate | null;
  submittedMove: [Coordinate, Coordinate] | null;
}

export function YourMoveCard({ selection, submittedMove }: YourMoveCardProps) {
  return (
    <div
      data-testid="your-move-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        Your move
      </div>
      <div className="mt-2.5 text-[13px] leading-[1.6] text-ink-3">
        {submittedMove ? (
          <SubmittedState move={submittedMove} />
        ) : selection ? (
          <SinglePickState selection={selection} />
        ) : (
          <span className="text-ink-soft">Select your first tile.</span>
        )}
      </div>
    </div>
  );
}

function SinglePickState({ selection }: { selection: Coordinate }) {
  return (
    <span>
      Picked{" "}
      <b className="font-mono font-medium text-ink">
        {formatCoord(selection.x, selection.y)}
      </b>
      . Pick a second.
    </span>
  );
}

function SubmittedState({ move }: { move: [Coordinate, Coordinate] }) {
  const [from, to] = move;
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
        Submitted
      </div>
      <div className="mt-1.5 font-mono text-ink">
        {formatCoord(from.x, from.y)} ↔ {formatCoord(to.x, to.y)}
      </div>
      <div className="mt-2 text-[12px] text-ink-soft">
        Hidden from opponent until both submit.
      </div>
    </div>
  );
}
