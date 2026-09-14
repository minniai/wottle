"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { respondInviteAction, sendInviteAction } from "@/app/actions/matchmaking/sendInvite";
import { generateBoard } from "@/lib/game-engine/boardGenerator";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import { EMPTY_LOBBY_HINT, lobbyContext, NO_ACCOUNT_NEEDED, NO_OPPONENT, NO_OPPONENT_SUBLINE, PLAY_RANKED, TAP_SECOND_LETTER, YOU } from "@/lib/constants/copy";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import type { LedgerAction, LedgerModel } from "@/lib/room/ledgerTypes";
import { EMPTY_TERRITORY } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import type { Coordinate } from "@/lib/types/board";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { PlayerIdentity } from "@/lib/types/match";
import { Field } from "./Field";
import { Ledger } from "./Ledger";
import { LobbyLedger } from "./LobbyLedger";
import { NameInput } from "./NameInput";
import { PlayerBar } from "./PlayerBar";
import { Room } from "./Room";
import { useFieldInteraction } from "./hooks/useFieldInteraction";
import { useLobbyInvites, type PendingInvite } from "./hooks/useLobbyInvites";
import { useNotices } from "./hooks/useNotices";

export interface LobbyRoomControllerProps {
  viewer: PlayerIdentity | null;
  initialPlayers: PlayerIdentity[];
  recentGames: RecentGameRow[] | null;
}

const EMPTY_FROZEN = new Set<string>();

/**
 * The lobby phase of the room (design system §7): an empty opponent bar, a
 * real warm-up field, your bar (or the name input), and the lobby ledger.
 * Landing and lobby are the same screen; signing in converts the bar in place.
 */
export function LobbyRoomController({ viewer, initialPlayers, recentGames }: LobbyRoomControllerProps) {
  const router = useRouter();
  const storeViewer = useRoomStore((s) => s.viewer);
  const setViewer = useRoomStore((s) => s.setViewer);
  const board = useRoomStore((s) => s.board);
  const setBoard = useRoomStore((s) => s.setBoard);
  const setPhase = useRoomStore((s) => s.setPhase);
  const hydrateBoard = useCallback(() => setBoard(generateBoard({ seed: `warmup:${Date.now()}` })), [setBoard]);
  const me = storeViewer ?? viewer;

  useEffect(() => {
    setPhase("lobby");
    if (board.length === 0) hydrateBoard();
  }, [setPhase, board.length, hydrateBoard]);

  const players = useLobbyPresenceStore((s) => s.players);
  const presenceStatus = useLobbyPresenceStore((s) => s.status);
  const connect = useLobbyPresenceStore((s) => s.connect);
  const disconnect = useLobbyPresenceStore((s) => s.disconnect);
  useEffect(() => {
    if (!me) return;
    void connect({ self: me, initialPlayers });
    return () => disconnect();
  }, [me, initialPlayers, connect, disconnect]);

  const { notices, push, dismiss } = useNotices();
  const sound = useSoundEffects(usePreferencesStore((s) => s.soundEnabled));
  const previewEnabled = usePreferencesStore((s) => s.previewEnabled) && Boolean(me);

  const field = useFieldInteraction({
    matchId: null,
    warmupBoard: me ? board : null,
    previewEnabled,
    frozenKeys: EMPTY_FROZEN,
    opponentPins: null,
    canPick: board.length > 0,
    currentRound: 0,
    onPick: sound.playTileSelect,
    onCommitted: sound.playValidSwap,
    onRejected: () => undefined,
    onNotice: () => undefined,
    onLocalSwap: (from: Coordinate, to: Coordinate) => setBoard(applyLetterSwaps(board, [[from, to]])),
  });

  const onInvite = useCallback(
    (invite: PendingInvite) => push({ kind: "challenge", fromName: invite.sender.displayName ?? invite.sender.username, inviteId: invite.id }),
    [push],
  );
  const onActiveMatch = useCallback((matchId: string) => router.replace(`/match/${matchId}`), [router]);
  useLobbyInvites({ enabled: Boolean(me), onInvite, onActiveMatch });

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "playRanked") router.replace("/matchmaking");
      else if (action === "profile") router.push("/profile");
      else if (action === "signOut") {
        void logoutAction({}).finally(() => {
          disconnect();
          setViewer(null);
          router.replace("/");
          router.refresh();
        });
      } else if (action === "rules") push({ kind: "firstMatchRules" });
      else if (typeof action === "object" && "challenge" in action) {
        sendInviteAction(action.challenge).then((r) => r.status !== "sent" && push({ kind: "text", text: (r.message ?? "challenge failed").toLowerCase() }));
      } else if (typeof action === "object" && "acceptChallenge" in action) {
        dismiss("challenge");
        respondInviteAction(action.acceptChallenge, "accepted").then((r) => {
          if (r.status === "accepted" && r.matchId) router.replace(`/match/${r.matchId}`);
          else push({ kind: "text", text: (r.message ?? r.status).toLowerCase() });
        });
      } else if (typeof action === "object" && "declineChallenge" in action) {
        dismiss("challenge");
        void respondInviteAction(action.declineChallenge, "declined");
      }
    },
    [router, push, dismiss, disconnect, setViewer],
  );

  const onSignedIn = useCallback(
    (player: PlayerIdentity) => {
      setViewer(player);
      router.replace("/lobby");
    },
    [setViewer, router],
  );

  const model: LedgerModel = useMemo(
    () => ({
      caption: lobbyContext(players.filter((p) => p.id !== me?.id).length),
      rows: [],
      territory: EMPTY_TERRITORY,
      hint: me ? (previewEnabled ? field.hint : TAP_SECOND_LETTER) : EMPTY_LOBBY_HINT,
    }),
    [players, me, previewEnabled, field.hint],
  );

  return (
    <Room
      topBar={
        <PlayerBar
          seat="opp"
          position="top"
          state="empty"
          name={NO_OPPONENT}
          subline={NO_OPPONENT_SUBLINE}
          action={
            <button type="button" className="action-primary" data-testid="player-bar-action-ranked" disabled={!me} onClick={() => handleAction("playRanked")}>
              {PLAY_RANKED}
            </button>
          }
        />
      }
      field={
        <Field
          board={board}
          viewerSlot="player_a"
          cellStateFor={field.cellStateFor}
          seatFor={field.seatFor}
          shakeAt={field.shakeAt}
          focusAt={field.focusAt}
          onActivate={(at) => field.dispatch({ type: "tap", at })}
          onKeyDown={field.onKeyDown}
        />
      }
      bottomBar={
        me ? (
          <PlayerBar seat="you" position="bottom" state="idle" name={me.displayName} subline={`${me.eloRating ?? "unrated"} · ${YOU}`} />
        ) : (
          <PlayerBar seat="you" position="bottom" state="empty" subline={NO_ACCOUNT_NEEDED} nameInput={<NameInput onSignedIn={onSignedIn} />} />
        )
      }
      ledger={
        <Ledger
          variant="lobby"
          model={model}
          notices={notices}
          viewerName={me?.displayName ?? ""}
          opponentName={null}
          body={<LobbyLedger players={players} viewer={me} recentGames={me ? recentGames : null} loadingPlayers={Boolean(me) && presenceStatus === "connecting" && players.length === 0} onAction={handleAction} />}
          onAction={handleAction}
        />
      }
    />
  );
}
