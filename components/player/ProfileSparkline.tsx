interface ProfileSparklineProps {
  ratings: number[];
  peak: number;
  current: number;
}

export function ProfileSparkline({
  ratings,
  peak,
  current,
}: ProfileSparklineProps) {
  const min = ratings.length > 0 ? Math.min(...ratings) : 0;
  const max = ratings.length > 0 ? Math.max(...ratings) : 1;
  const range = max - min;
  const lastIndex = ratings.length - 1;

  return (
    <div
      data-testid="profile-sparkline"
      className="flex flex-col gap-2"
      aria-label="Rating history sparkline"
    >
      <div className="flex h-[54px] items-end gap-[3px]">
        {ratings.map((value, index) => {
          const height =
            range === 0 ? 24 : 8 + ((value - min) / range) * 46;
          const isLast = index === lastIndex;
          return (
            <span
              key={`${index}-${value}`}
              data-testid="sparkline-bar"
              className={`w-[6px] rounded-sm ${
                isLast ? "bg-ochre-deep" : "bg-p2/50"
              }`}
              style={{ height: `${height}px` }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Peak {peak} · Now {current}
      </p>
    </div>
  );
}
