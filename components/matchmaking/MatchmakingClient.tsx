"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MatchRing } from "@/components/matchmaking/MatchRing";
import { MatchmakingVsBlock } from "@/components/matchmaking/MatchmakingVsBlock";
import type { PlayerIdentity } from "@/lib/types/match";

const POLL_INTERVAL_MS = 3_000;
const RATING_WINDOW_BASE = 200;
const RATING_WINDOW_STEP = 50;
const FOUND_HOLD_MS = 2_200;
const STARTING_HOLD_MS = 1_400;

type Phase =
  | { kind: "searching" }
  | { kind: "found"; matchId: string; opponent: PlayerIdentity }
  | { kind: "starting"; matchId: string; opponent: PlayerIdentity };

interface MatchmakingClientProps {
  self: PlayerIdentity;
}

export function MatchmakingClient({ self }: MatchmakingClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "searching" });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (phase.kind !== "searching") return;
    const id = setInterval(
      () => setElapsedSeconds((s) => s + 1),
      1_000,
    );
    return () => clearInterval(id);
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind !== "searching") return;
    let cancelled = false;

    const poll = async () => {
      const result = await startQueueAction();
      if (cancelled) return;
      if (result.status === "matched" && result.matchId) {
        const overview = await getMatchOverviewAction({
          matchId: result.matchId,
        });
        if (cancelled) return;
        if (overview.status === "ok") {
          setPhase({
            kind: "found",
            matchId: result.matchId,
            opponent: overview.opponent,
          });
        } else {
          router.push(`/match/${result.matchId}`);
        }
      }
    };

    void poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase.kind, router]);

  useEffect(() => {
    if (phase.kind !== "found") return;
    const id = setTimeout(() => {
      setPhase({
        kind: "starting",
        matchId: phase.matchId,
        opponent: phase.opponent,
      });
    }, FOUND_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase.kind !== "starting") return;
    const id = setTimeout(() => {
      router.push(`/match/${phase.matchId}`);
    }, STARTING_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, router]);

  const handleCancel = useCallback(async () => {
    await cancelQueueAction();
    router.push("/lobby");
  }, [router]);

  const ratingWindow =
    RATING_WINDOW_BASE + elapsedSeconds * RATING_WINDOW_STEP;

  if (phase.kind === "searching") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-58px)] w-full max-w-2xl items-center justify-center px-6 py-16">
        <div className="w-full text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
            Ranked · 5+0 · Icelandic nouns
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold italic leading-tight sm:text-5xl">
            Finding an opponent within{" "}
            <em className="font-display not-italic text-ochre-deep">
              ±{ratingWindow}
            </em>{" "}
            rating
          </h1>
          <div className="mt-12 grid place-items-center gap-6">
            <MatchRing>
              <Avatar
                playerId={self.id}
                displayName={self.displayName}
                avatarUrl={self.avatarUrl}
                size="lg"
              />
            </MatchRing>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
              Elapsed · {elapsedSeconds}s
            </p>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel search
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-58px)] w-full max-w-2xl items-center justify-center px-6 py-16">
      <MatchmakingVsBlock
        self={self}
        opponent={phase.opponent}
        phase={phase.kind === "found" ? "found" : "starting"}
      />
    </main>
  );
}
