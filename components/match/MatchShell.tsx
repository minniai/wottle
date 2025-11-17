"use client";

interface MatchShellProps {
  matchId: string;
  headline?: string;
  statusMessage?: string;
}

export function MatchShell({
  matchId,
  headline = "Preparing match",
  statusMessage = "Setting up shared timers and board state…",
}: MatchShellProps) {
  return (
    <section
      className="w-full rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-white shadow-2xl shadow-slate-950/40"
      data-testid="match-shell"
      data-match-id={matchId}
    >
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">
          Match Ready
        </p>
        <h1 className="text-3xl font-bold text-white">{headline}</h1>
        <p className="text-white/70">{statusMessage}</p>
      </div>

      <dl className="mt-8 grid gap-4 text-sm text-white/70 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Match ID</dt>
          <dd className="mt-1 font-mono text-base text-white/90">{matchId}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Round limit</dt>
          <dd className="mt-1 text-lg font-semibold text-white">10 rounds</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Status</dt>
          <dd className="mt-1 text-lg font-semibold text-emerald-300">Syncing</dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Board Loading</p>
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-white/5" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Players</p>
          <div className="mt-4 space-y-3">
            <div className="h-5 animate-pulse rounded bg-white/10" />
            <div className="h-5 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </div>
    </section>
  );
}


