"use client";

interface MatchShellProps {
  matchId: string;
  loading?: boolean;
  children?: React.ReactNode;
}

export function MatchShell({
  matchId,
  loading = false,
  children,
}: MatchShellProps) {
  return (
    <section
      className="w-full text-white"
      data-testid="match-shell"
      data-match-id={matchId}
    >
      {loading ? <MatchShellSkeleton /> : children}
    </section>
  );
}

function MatchShellSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {/* Header skeleton bars */}
      <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-5 w-12 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
      </div>

      {/* 10x10 skeleton grid */}
      <div className="board-grid" style={{ "--board-size": 10 } as React.CSSProperties}>
        {Array.from({ length: 100 }, (_, i) => (
          <div
            key={i}
            className="board-grid__cell animate-pulse"
            style={{ cursor: "default", opacity: 0.4 }}
          />
        ))}
      </div>

      {/* Footer skeleton bar */}
      <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-5 w-12 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}
