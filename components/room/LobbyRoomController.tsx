"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { respondInviteAction, sendInviteAction } from "@/app/actions/matchmaking/sendInvite";
import { generateBoard } from "@/lib/game-engine/boardGenerator";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import { EMPTY_LOBBY_HINT, NO_SUCH_MATCH, TAP_SECOND_LETTER } from "@/lib/constants/copy";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import { hintLine, letterFactsOn } from "@/lib/room/liveState";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import type { Coordinate } from "@/lib/types/board";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { PlayerIdentity } from "@/lib/types/match";
import { Field } from "./Field";
import { LobbyRoomView } from "./LobbyRoomView";
import { useFieldInteraction } from "./hooks/useFieldInteraction";
import { useLobbyInvites, type PendingInvite } from "./hooks/useLobbyInvites";
import { useRoomHotkeys } from "./hooks/useRoomHotkeys";
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
  const letterAt = useMemo(() => letterFactsOn(board), [board]);
  const setBoard = useRoomStore((s) => s.setBoard);
  const setPhase = useRoomStore((s) => s.setPhase);
  const hydrateBoard = useCallback(() => setBoard(generateBoard({ seed: `warmup:${Date.now()}` })), [setBoard]);
  const me = storeViewer ?? viewer;

  useEffect(() => {
    setPhase("lobby");
    if (board.length === 0) hydrateBoard();
  }, [setPhase, board.length, hydrateBoard]);

  // `/` and `/lobby` are one page (app/(room)/LobbyRoomPage). A signed-in viewer's URL is /lobby, rewritten
  // in place: routing would swap the page segment and remount the field (spec 044 SC-008).
  useEffect(() => {
    if (me && window.location.pathname === "/") window.history.replaceState(null, "", "/lobby");
  }, [me]);

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

  // A match that does not exist redirects here with ?notice=no-match; show it
  // once and clear the param so a reload does not repeat it (spec 045 FR-017).
  const unreachableMatch = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("notice") !== "no-match") return;
    unreachableMatch.current = params.get("match");
    push({ kind: "text", text: NO_SUCH_MATCH });
    params.delete("notice");
    params.delete("match");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [push]);

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
  const onActiveMatch = useCallback(
    (activeMatchId: string) => {
      // Never return to a match we were just bounced out of: it would fail to
      // load again and bounce again, forever.
      if (activeMatchId === unreachableMatch.current) return;
      router.replace(`/match/${activeMatchId}`);
    },
    [router],
  );
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

  // `?` opens the rules, `M` mutes (design system §9, FR-026).
  useRoomHotkeys(handleAction);

  const onSignedIn = useCallback((player: PlayerIdentity) => setViewer(player), [setViewer]);

  return (
    <LobbyRoomView
      viewer={me}
      players={players}
      recentGames={recentGames}
      loadingPlayers={Boolean(me) && presenceStatus === "connecting" && players.length === 0}
      hint={me ? (previewEnabled ? hintLine(field.interaction, letterAt) : TAP_SECOND_LETTER) : EMPTY_LOBBY_HINT}
      notices={notices}
      onAction={handleAction}
      onSignedIn={onSignedIn}
    >
      <Field
        board={board}
        viewerSlot="player_a"
        cellStateFor={field.cellStateFor}
        seatFor={field.seatFor}
        shakeAt={field.shakeAt}
        focusAt={field.focusAt}
        onActivate={(at) => field.dispatch({ type: "tap", at })}
        onDrag={(from, to) => field.dispatch({ type: "drag", from, to })}
        exchange={field.ownPins}
        onKeyDown={field.onKeyDown}
      />
    </LobbyRoomView>
  );
}
