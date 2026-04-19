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
      className="w-full text-ink"
      data-testid="match-shell"
      data-match-id={matchId}
    >
      {loading ? <MatchShellSkeleton /> : children}
    </section>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-hair bg-paper-2 p-4">
      <div className="h-12 w-12 animate-pulse rounded-full bg-paper-3" />
      <div className="h-4 w-20 animate-pulse rounded bg-paper-3" />
      <div className="h-12 w-full animate-pulse rounded-lg bg-paper-3" />
      <div className="h-8 w-16 animate-pulse rounded bg-paper-3" />
    </div>
  );
}

function MatchShellSkeleton() {
  return (
    <div className="match-layout" aria-hidden="true">
      <div className="match-layout__panel match-layout__panel--left">
        <PanelSkeleton />
      </div>

      <div className="match-layout__board">
        {/* Mobile compact bar skeleton */}
        <div className="match-layout__compact-top">
          <div className="flex items-center gap-2 rounded-lg bg-paper-2 px-3 py-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-paper-3" />
            <div className="h-4 w-16 animate-pulse rounded bg-paper-3" />
            <div className="ml-auto h-6 w-14 animate-pulse rounded bg-paper-3" />
          </div>
        </div>

        <div className="board-grid" style={{ "--board-size": 10 } as React.CSSProperties}>
          {Array.from({ length: 100 }, (_, i) => (
            <div
              key={i}
              className="board-grid__cell animate-pulse"
              style={{ cursor: "default", opacity: 0.4 }}
            />
          ))}
        </div>

        {/* Mobile compact bar skeleton */}
        <div className="match-layout__compact-bottom">
          <div className="flex items-center gap-2 rounded-lg bg-paper-2 px-3 py-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-paper-3" />
            <div className="h-4 w-16 animate-pulse rounded bg-paper-3" />
            <div className="ml-auto h-6 w-14 animate-pulse rounded bg-paper-3" />
          </div>
        </div>
      </div>

      <div className="match-layout__panel match-layout__panel--right">
        <PanelSkeleton />
      </div>
    </div>
  );
}
