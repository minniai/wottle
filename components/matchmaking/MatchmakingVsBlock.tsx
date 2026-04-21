import { Avatar } from "@/components/ui/Avatar";
import type { PlayerIdentity } from "@/lib/types/match";

export type VsBlockPhase = "found" | "starting";

interface MatchmakingVsBlockProps {
  self: PlayerIdentity;
  opponent: PlayerIdentity;
  phase: VsBlockPhase;
}

const EYEBROW: Record<VsBlockPhase, string> = {
  found: "Opponent found",
  starting: "Starting match…",
};

const SUBTITLE: Record<VsBlockPhase, string> = {
  found: "Both players ready.",
  starting: "Assigning roles · generating board…",
};

export function MatchmakingVsBlock({
  self,
  opponent,
  phase,
}: MatchmakingVsBlockProps) {
  return (
    <div data-testid="matchmaking-vs-block" className="w-full text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
        {EYEBROW[phase]}
      </p>

      <div className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl">
        <span className="text-p1-deep">{self.displayName}</span>
        <br />
        <span className="block py-2 font-mono text-sm uppercase tracking-[0.22em] text-ink-soft">
          — vs —
        </span>
        <span className="text-p2-deep">{opponent.displayName}</span>
      </div>

      <div className="mt-8 flex items-center justify-center gap-12">
        <VsAvatar player={self} />
        <span
          aria-hidden="true"
          className="font-display text-2xl italic text-ink-soft"
        >
          ×
        </span>
        <VsAvatar player={opponent} />
      </div>

      <p className="mt-8 text-sm text-ink-3">{SUBTITLE[phase]}</p>
    </div>
  );
}

function VsAvatar({ player }: { player: PlayerIdentity }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar
        playerId={player.id}
        displayName={player.displayName}
        avatarUrl={player.avatarUrl}
        size="lg"
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        {player.eloRating ?? 1200}
      </span>
    </div>
  );
}
