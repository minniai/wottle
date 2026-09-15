"use client";

import { useEffect, useState } from "react";

import { Field } from "@/components/room/Field";
import { LobbyRoomView } from "@/components/room/LobbyRoomView";
import { MatchRoomView } from "@/components/room/MatchRoomView";
import { QueueRoomView } from "@/components/room/QueueRoomView";
import { RoomShell } from "@/components/room/RoomShell";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { OPPONENT, TAP_SECOND_LETTER, roundOneIn, searchingSubline, settingField } from "@/lib/constants/copy";
import { bandsFromWords } from "@/lib/room/bandGeometry";
import { useRoomStore } from "@/lib/room/roomStore";
import type { LiveState } from "@/lib/room/ledgerRows";
import type { MatchResult } from "@/lib/types/match";
import {
  BIRNA,
  DISCONNECT_STATE,
  FINAL_STATE,
  FINAL_VERDICT,
  FIXTURE_BOARD,
  FIXTURE_FROZEN,
  FIXTURE_WORDS,
  KARI,
  LOBBY_PLAYERS,
  MATCH_STATE,
  OPP_CLOCK_MS,
  OPP_FINAL_LINE,
  OPP_ID,
  PICKED_LIVE,
  PROFILE_FIXTURE,
  QUEUE_ELAPSED,
  QUEUE_LETTERS_LANDED,
  RECENT_GAMES,
  RECONNECT_MS_LEFT,
  YOU_CLOCK_MS,
  YOU_FINAL_LINE,
  YOU_ID,
  type RoomPhase,
} from "./fixtures";

const NO_OP = () => undefined;
const PICKED_CELL = { x: 0, y: 9 };

const BANDS = bandsFromWords({
  words: FIXTURE_WORDS,
  frozenTiles: FIXTURE_FROZEN,
  viewerSlot: "player_a",
  playerAId: YOU_ID,
});

/** The match field, with `T` picked at x 0, y 9 and rounds 1–3 drawn as bands. */
function MatchField({ drawnCount }: { drawnCount: number | null }) {
  return (
    <Field
      board={FIXTURE_BOARD}
      frozenTiles={FIXTURE_FROZEN}
      viewerSlot="player_a"
      ownerNames={{ player_a: BIRNA.displayName, player_b: KARI.displayName }}
      bands={BANDS}
      drawnCount={drawnCount}
      cellStateFor={(at, base) => (at.x === PICKED_CELL.x && at.y === PICKED_CELL.y ? "picked" : base)}
      seatFor={(at) => (at.x === PICKED_CELL.x && at.y === PICKED_CELL.y ? "you" : null)}
      onActivate={NO_OP}
    />
  );
}

function matchSeats(completed: boolean, reconnectMsLeft: number | null) {
  return {
    you: {
      name: BIRNA.displayName,
      rating: BIRNA.eloRating ?? null,
      clockMs: completed ? 41_000 : YOU_CLOCK_MS,
      running: !completed && reconnectMsLeft === null,
      score: completed ? 127 : 46,
      finalLine: completed ? YOU_FINAL_LINE : undefined,
    },
    opp: {
      name: KARI.displayName,
      rating: KARI.eloRating ?? null,
      clockMs: completed ? 12_000 : OPP_CLOCK_MS,
      running: false,
      score: completed ? 170 : 15,
      reconnectMsLeft,
      finalLine: completed ? OPP_FINAL_LINE : undefined,
    },
  };
}

/** The room for one phase, from `fixtures.ts` alone (spec 045 US1). */
export function RoomFixture({ phase }: { phase: RoomPhase }) {
  const [revealed, setRevealed] = useState(phase === "reveal" ? 0 : null);

  useEffect(() => {
    // Seed the store so components reading it (Room's data-phase, seat colours)
    // agree with the props. No transport, no timers.
    const store = useRoomStore.getState();
    store.setViewer(phase === "landing" ? null : BIRNA);
    store.setBoard(FIXTURE_BOARD);
    store.setPhase(phase === "final" ? "final" : phase === "landing" ? "lobby" : phase === "reveal" ? "match" : phase === "disconnect" ? "match" : phase === "profile" ? "lobby" : phase);
  }, [phase]);

  // The reveal phase holds mid-draw so the band, chevron and count-up are all captured.
  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setTimeout(() => setRevealed(FIXTURE_WORDS.length - 1), 0);
    return () => clearTimeout(id);
  }, [phase]);

  if (phase === "profile") {
    const profile = {
      identity: { ...BIRNA, createdAt: "2026-03-02T09:00:00.000Z" },
      stats: { eloRating: 1204, gamesPlayed: 34, wins: 19, losses: 15, draws: 0, winRate: 19 / 34 },
      ratingTrend: [1197, 1216, 1186, 1199, 1204],
      bestWord: { word: "BORÐA", points: 38, opponentName: KARI.displayName },
      form: ["W", "L", "W", "W", "L", "W", "L", "W", "W", "L"] as MatchResult[],
      peakRating: 1216,
      ratingHistory: PROFILE_FIXTURE.ratingHistory.map((rating, i) => ({
        rating,
        recordedAt: `2026-0${1 + Math.floor(i / 6)}-${String(1 + (i % 6) * 5).padStart(2, "0")}T12:00:00.000Z`,
      })),
    };
    return (
      <RoomShell viewer={BIRNA}>
        <ProfilePage profile={profile} words={[...PROFILE_FIXTURE.bestWords]} matches={RECENT_GAMES} isSelf />
      </RoomShell>
    );
  }

  if (phase === "landing" || phase === "lobby") {
    const viewer = phase === "landing" ? null : BIRNA;
    return (
      <RoomShell viewer={viewer}>
        <LobbyRoomView
          viewer={viewer}
          players={LOBBY_PLAYERS}
          recentGames={RECENT_GAMES}
          loadingPlayers={false}
          hint={TAP_SECOND_LETTER}
          notices={[]}
          onAction={NO_OP}
          onSignedIn={NO_OP}
        >
          <Field board={FIXTURE_BOARD} viewerSlot="player_a" onActivate={NO_OP} />
        </LobbyRoomView>
      </RoomShell>
    );
  }

  if (phase === "queue" || phase === "found") {
    const found = phase === "found";
    return (
      <RoomShell viewer={BIRNA}>
        <QueueRoomView
          viewer={BIRNA}
          opponent={found ? KARI : null}
          found={found ? { countdown: 3 } : null}
          elapsed={QUEUE_ELAPSED}
          live={found ? roundOneIn(3) : settingField(QUEUE_LETTERS_LANDED)}
          hint={searchingSubline(QUEUE_ELAPSED)}
          onAction={NO_OP}
        >
          <Field
            board={FIXTURE_BOARD}
            viewerSlot="player_a"
            disabled
            landedCount={found ? null : QUEUE_LETTERS_LANDED}
          />
        </QueueRoomView>
      </RoomShell>
    );
  }

  const completed = phase === "final";
  const disconnected = phase === "disconnect";
  const state = completed ? FINAL_STATE : disconnected ? DISCONNECT_STATE : MATCH_STATE;
  const seats = matchSeats(completed, disconnected ? RECONNECT_MS_LEFT : null);
  const live: LiveState = completed || disconnected ? { kind: "idle" } : PICKED_LIVE;

  return (
    <RoomShell viewer={BIRNA}>
      <MatchRoomView
        matchId={state.matchId}
        viewerSlot="player_a"
        you={seats.you}
        opp={seats.opp}
        currentRound={state.currentRound}
        completed={completed}
        words={FIXTURE_WORDS}
        playerAId={YOU_ID}
        frozenTiles={FIXTURE_FROZEN}
        live={live}
        verdict={completed ? FINAL_VERDICT : undefined}
        notices={disconnected ? [{ kind: "claimWin", opponentName: KARI.displayName }] : []}
        hint={disconnected ? `${KARI.displayName} · ${OPPONENT}` : undefined}
        onAction={NO_OP}
      >
        <MatchField drawnCount={revealed} />
      </MatchRoomView>
    </RoomShell>
  );
}

export const FIXTURE_OPPONENT_ID = OPP_ID;
