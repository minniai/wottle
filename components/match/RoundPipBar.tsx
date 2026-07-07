interface RoundPipBarProps {
  current: number;
  total: number;
}

function pipState(index: number, current: number): "done" | "current" | "future" {
  if (index < current - 1) return "done";
  if (index === current - 1) return "current";
  return "future";
}

const PIP_CLASSES: Record<"done" | "current" | "future", string> = {
  done: "h-[3px] bg-ink-2",
  current: "h-[5px] bg-ochre-deep",
  future: "h-[3px] bg-hair-strong",
};

export function RoundPipBar({ current, total }: RoundPipBarProps) {
  return (
    <div
      data-testid="round-pip-bar"
      role="progressbar"
      aria-label={`Round ${current} of ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      className="flex items-center gap-1"
    >
      {Array.from({ length: total }, (_, i) => {
        const state = pipState(i, current);
        return (
          <span
            key={i}
            data-testid="round-pip"
            data-state={state}
            className={`w-[22px] rounded-[2px] transition-colors ${PIP_CLASSES[state]}`}
          />
        );
      })}
    </div>
  );
}
