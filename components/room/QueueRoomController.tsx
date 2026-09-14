"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CANCEL, FINDING_OPPONENT, OPPONENT, QUEUE_CONTEXT, roundOneIn, searchingSubline, settingField, YOU } from "@/lib/constants/copy";
import { diffBoards, generateBoard } from "@/lib/game-engine/boardGenerator";
import { formatClock } from "@/lib/room/clock";
import type { LedgerAction, LedgerModel } from "@/lib/room/ledgerTypes";
import { EMPTY_TERRITORY, emptyRows } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import { useMatchmaking } from "@/lib/room/useMatchmaking";
import type { MatchPlayerProfiles, MatchState, PlayerIdentity } from "@/lib/types/match";
import { Field } from "./Field";
import { Ledger } from "./Ledger";
import { MatchRoomController } from "./MatchRoomController";
import { PlayerBar } from "./PlayerBar";
import { Room } from "./Room";
import { useReducedMotion } from "./hooks/useReducedMotion";

export const LETTER_LAND_MS = 100;
export const FOUND_COUNTDOWN_MS = 1_000;

interface QueueRoomControllerProps {
  viewer: PlayerIdentity;
}

interface ReadyMatch {
  matchId: string;
  state: MatchState;
  profiles: MatchPlayerProfiles;
}

async function fetchMatch(matchId: string): Promise<MatchState | null> {
  const res = await fetch(`/api/match/${matchId}/state`, { cache: "no-store" }).catch(() => null);
  return res && res.ok ? ((await res.json()) as MatchState) : null;
}

function profilesFor(state: MatchState, viewer: PlayerIdentity, opponent: PlayerIdentity | null): MatchPlayerProfiles {
  const toProfile = (p: PlayerIdentity | null, id: string) => ({
    playerId: id,
    displayName: p?.displayName ?? "opponent",
    username: p?.username ?? "",
    avatarUrl: p?.avatarUrl ?? null,
    eloRating: p?.eloRating ?? 1200,
  });
  const viewerIsA = state.timers.playerA.playerId === viewer.id;
  return {
    playerA: toProfile(viewerIsA ? viewer : opponent, state.timers.playerA.playerId),
    playerB: toProfile(viewerIsA ? opponent : viewer, state.timers.playerB.playerId),
  };
}

/**
 * Queue → found → match in one room (spec 044 US8, decision Q3): a placeholder
 * field sets itself letter by letter; when an opponent is found their name
 * writes into the top bar, differing letters swap to the real board, round 1
 * counts down, and the match phase takes over. The URL follows without a
 * route change.
 */
export function QueueRoomController({ viewer }: QueueRoomControllerProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const phase = useRoomStore((s) => s.phase);
  const queue = useRoomStore((s) => s.queue);
  const found = useRoomStore((s) => s.found);
  const board = useRoomStore((s) => s.board);
  const startQueue = useRoomStore((s) => s.startQueue);
  const cancelQueue = useRoomStore((s) => s.cancelQueue);
  const setBoard = useRoomStore((s) => s.setBoard);
  const setLettersLanded = useRoomStore((s) => s.setLettersLanded);
  const setFound = useRoomStore((s) => s.setFound);
  const [startedAt] = useState(() => Date.now());
  const [ready, setReady] = useState<ReadyMatch | null>(null);

  useEffect(() => {
    startQueue(startedAt);
    setBoard(generateBoard({ seed: `queue:${viewer.id}:${startedAt}` }));
  }, [startQueue, setBoard, viewer.id, startedAt]);

  const { state, cancel } = useMatchmaking(phase === "queue", startedAt);

  // Letters land ~100 ms apart (all at once under reduced motion).
  const landed = queue?.lettersLanded ?? 100;
  useEffect(() => {
    if (phase !== "queue") return;
    if (reducedMotion) {
      setLettersLanded(100);
      return;
    }
    if (landed >= 100) return;
    const id = setTimeout(() => setLettersLanded(landed + 1), LETTER_LAND_MS);
    return () => clearTimeout(id);
  }, [phase, landed, reducedMotion, setLettersLanded]);

  // Found: fetch the real board, swap the letters that differ, count round 1 in.
  useEffect(() => {
    if (state.kind !== "found") return;
    let active = true;
    void fetchMatch(state.matchId).then((match) => {
      if (!active || !match) {
        if (active) router.replace(`/match/${state.matchId}`);
        return;
      }
      setLettersLanded(100);
      setBoard(board.length === 10 && diffBoards(board, match.board).length > 0 ? match.board : match.board);
      setFound(state.opponent, 3);
      setReady({ matchId: state.matchId, state: match, profiles: profilesFor(match, viewer, state.opponent) });
      window.history.replaceState(null, "", `/match/${state.matchId}`);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, viewer]);

  useEffect(() => {
    if (phase !== "found" || !found) return;
    const id = setTimeout(() => {
      if (found.countdown > 1) setFound(useRoomStore.getState().opponent, (found.countdown - 1) as 2 | 1);
      else useRoomStore.getState().setPhase("match");
    }, reducedMotion ? 0 : FOUND_COUNTDOWN_MS);
    return () => clearTimeout(id);
  }, [phase, found, reducedMotion, setFound]);

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "cancelQueue") {
        void cancel();
        cancelQueue();
        router.replace("/lobby");
      }
    },
    [cancel, cancelQueue, router],
  );

  const model: LedgerModel = useMemo(
    () => ({
      caption: QUEUE_CONTEXT,
      rows: emptyRows(),
      territory: EMPTY_TERRITORY,
      hint: phase === "found" && found ? roundOneIn(found.countdown) : settingField(Math.min(landed, 100)),
    }),
    [phase, found, landed],
  );

  if (phase === "match" && ready) {
    return <MatchRoomController initialState={ready.state} currentPlayerId={viewer.id} matchId={ready.matchId} playerProfiles={ready.profiles} />;
  }

  const opponent = useRoomStore.getState().opponent;
  const elapsed = state.kind === "searching" ? formatClock(state.elapsedSeconds * 1000) : "0:00";
  return (
    <Room
      topBar={
        phase === "found" && found ? (
          <PlayerBar seat="opp" position="top" state="found" name={opponent?.displayName ?? "opponent"} subline={`${opponent?.eloRating ?? "unrated"} · ${OPPONENT} · ${roundOneIn(found.countdown)}`} clockMs={300_000} clockRunning={false} score={0} />
        ) : (
          <PlayerBar
            seat="opp"
            position="top"
            state="searching"
            name={FINDING_OPPONENT}
            subline={searchingSubline(elapsed)}
            action={
              <button type="button" className="action-secondary" data-testid="player-bar-action-cancel" onClick={() => handleAction("cancelQueue")}>
                {CANCEL}
              </button>
            }
          />
        )
      }
      field={<Field board={board} viewerSlot="player_a" disabled landedCount={phase === "queue" ? landed : null} />}
      bottomBar={<PlayerBar seat="you" position="bottom" state="idle" name={viewer.displayName} subline={`${viewer.eloRating ?? "unrated"} · ${YOU}`} />}
      ledger={
        <Ledger
          variant="queue"
          model={model}
          viewerName={viewer.displayName}
          opponentName={opponent?.displayName ?? null}
          footActions={
            phase === "queue" ? (
              <button type="button" className="action-secondary" data-testid="ledger-cancel-queue" onClick={() => handleAction("cancelQueue")}>
                {CANCEL}
              </button>
            ) : null
          }
          onAction={handleAction}
        />
      }
    />
  );
}
