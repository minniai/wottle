"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { respondInviteAction, sendInviteAction } from "@/app/actions/matchmaking/sendInvite";
import { useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { generateBoard } from "@/lib/game-engine/boardGenerator";
import { getLanguagePack } from "@/lib/game-engine/languagePack";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import { useCopy } from "@/components/i18n/LocaleProvider";
import { isLandingPath } from "@/lib/i18n/locales";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import type { LedgerAction, OutgoingChallenge } from "@/lib/room/ledgerTypes";
import { challengeOutcome, syncChallenges } from "@/lib/room/notices";
import { useRoomStore } from "@/lib/room/roomStore";
import type { Coordinate } from "@/lib/types/board";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { PlayerIdentity } from "@/lib/types/match";
import { Field } from "./Field";
import { LobbyRoomView } from "./LobbyRoomView";
import { useFieldInteraction } from "./hooks/useFieldInteraction";
import { useLobbyInvites, type PendingInvite } from "./hooks/useLobbyInvites";
import { useRoomHotkeys } from "./hooks/useRoomHotkeys";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { LETTER_LAND_MS } from "./QueueRoomController";
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
  const copy = useCopy();
  const { EMPTY_LOBBY_HINT, NO_SUCH_MATCH, TAP_SECOND_LETTER } = copy;
  const router = useRouter();
  const storeViewer = useRoomStore((s) => s.viewer);
  const setViewer = useRoomStore((s) => s.setViewer);
  const board = useRoomStore((s) => s.board);
  const { language } = useLocale();
  const setBoard = useRoomStore((s) => s.setBoard);
  const setPhase = useRoomStore((s) => s.setPhase);
  // The warm-up field is dealt in the lobby's language (spec 060 FR-016).
  const hydrateBoard = useCallback(
    () => setBoard(generateBoard({ seed: `warmup:${Date.now()}`, weights: getLanguagePack(language).letterWeights })),
    [setBoard, language],
  );
  const me = storeViewer ?? viewer;
  const setSlip = useRoomStore((s) => s.setSlip);

  // Entering the lobby leaves any match behind: its state and its slip (reported
  // 2026-09-21: the match-over slip stayed up over the lobby).
  const leaveToLobby = useRoomStore((s) => s.leaveToLobby);
  useEffect(() => {
    leaveToLobby();
  }, [leaveToLobby]);
  useEffect(() => {
    setPhase("lobby");
    if (board.length === 0) hydrateBoard();
  }, [setPhase, board.length, hydrateBoard]);

  // Spec 048 US4: no field before a name. Signed out, the slot is an empty frame under
  // the sign-in slip; signing in lands the letters with the queue's own motion.
  const reducedMotion = useReducedMotion();
  const [landed, setLanded] = useState<number | null>(() => (me ? null : 0));
  useEffect(() => {
    if (!me) setSlip({ kind: "signIn" });
  }, [me, setSlip]);
  useEffect(() => {
    if (!me || landed === null) return;
    if (reducedMotion || landed >= 100) {
      setLanded(null);
      return;
    }
    const id = setTimeout(() => setLanded(landed + 1), LETTER_LAND_MS);
    return () => clearTimeout(id);
  }, [me, landed, reducedMotion]);

  // `/` and `/lobby` are one page (app/[locale]/(room)/LobbyRoomPage). A signed-in viewer's URL is /lobby, rewritten
  // in place: routing would swap the page segment and remount the field (spec 044 SC-008).
  const locale = useLocale();
  const to = useLocalePath();
  useEffect(() => {
    if (me && isLandingPath(window.location.pathname, locale.id)) window.history.replaceState(null, "", to("/lobby"));
  }, [me, locale.id, to]);

  const players = useLobbyPresenceStore((s) => s.players);
  const presenceStatus = useLobbyPresenceStore((s) => s.status);
  const connect = useLobbyPresenceStore((s) => s.connect);
  const disconnect = useLobbyPresenceStore((s) => s.disconnect);
  // Keyed on the player, not the object: a cleanup between two renders of the same player
  // sends a DELETE that can land after the reconnect's upsert and drop them from the lobby.
  const connectPresence = useEffectEvent(() => {
    if (me) void connect({ self: me, initialPlayers, language });
  });
  const meId = me?.id;
  useEffect(() => {
    if (!meId) return;
    connectPresence();
    return () => disconnect();
  }, [meId, language, disconnect]);

  const { notices, push, dismiss, apply } = useNotices();
  // The challenge this viewer sent, until the poll reports what became of it.
  const sentChallenge = useRef<string | null>(null);

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
  }, [push, NO_SUCH_MATCH]);

  const sound = useSoundEffects(usePreferencesStore((s) => s.soundEnabled));

  const field = useFieldInteraction({
    matchId: null,
    board,
    frozenKeys: EMPTY_FROZEN,
    canPick: board.length > 0 && Boolean(me) && landed === null,
    onPick: sound.playTileSelect,
    onCommitted: sound.playValidSwap,
    onRejected: () => undefined,
    onNotice: () => undefined,
    onLocalSwap: (from: Coordinate, to: Coordinate) => setBoard(applyLetterSwaps(board, [[from, to]])),
  });

  const onInvites = useCallback(
    (pending: PendingInvite[]) =>
      apply((prev) => syncChallenges(prev, pending.map((i) => ({ kind: "challenge", fromName: i.sender.displayName ?? i.sender.username, inviteId: i.id })))),
    [apply],
  );
  const onOutgoing = useCallback(
    (outgoing: OutgoingChallenge | null) => {
      if (!outgoing || outgoing.id !== sentChallenge.current || outgoing.status === "pending") return;
      sentChallenge.current = null;
      dismiss("challengeSent");
      const outcome = challengeOutcome(outgoing, copy);
      if (outcome) push({ kind: "text", text: outcome });
    },
    [dismiss, push, copy],
  );
  const onActiveMatch = useCallback(
    (activeMatchId: string) => {
      // Never return to a match we were just bounced out of: it would fail to
      // load again and bounce again, forever.
      if (activeMatchId === unreachableMatch.current) return;
      router.replace(to(`/match/${activeMatchId}`));
    },
    [router, to],
  );
  useLobbyInvites({ enabled: Boolean(me), onInvites, onOutgoing, onActiveMatch });

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "findOpponent") router.replace(to("/matchmaking"));
      else if (action === "profile") router.push(to("/profile"));
      else if (action === "signOut") {
        const leave = () => {
          disconnect();
          setViewer(null);
          router.replace(to("/"));
          router.refresh();
        };
        // Signing out is refused while a match is live (spec 067); it never resigns.
        void logoutAction().then((r) => (r.status === "refused" ? push({ kind: "text", text: copy.errors[r.code] }) : leave()), leave);
      }
      else if (typeof action === "object" && "challenge" in action) {
        const target = players.find((p) => p.id === action.challenge);
        sendInviteAction(action.challenge, language).then((r) => {
          // They had already challenged us: our challenge was the answer (spec 067).
          if (r.status === "accepted") return router.replace(to(`/match/${r.matchId}`));
          if (r.status !== "sent") return push({ kind: "text", text: copy.errors[r.status === "unauthenticated" ? "signed_out" : "invite_failed"] });
          sentChallenge.current = r.inviteId;
          push({ kind: "challengeSent", toName: target?.displayName ?? target?.username ?? "", inviteId: r.inviteId });
        });
      } else if (typeof action === "object" && "acceptChallenge" in action) {
        dismiss(`challenge:${action.acceptChallenge}`);
        respondInviteAction(action.acceptChallenge, "accepted").then((r) => {
          if (r.status === "accepted") router.replace(to(`/match/${r.matchId}`));
          else if (r.status === "busy") push({ kind: "text", text: copy.opponentBusy(r.name) });
          else if (r.status !== "declined") push({ kind: "text", text: copy.errors[r.status === "unauthenticated" ? "signed_out" : "accept_failed"] });
        });
      } else if (typeof action === "object" && "declineChallenge" in action) {
        dismiss(`challenge:${action.declineChallenge}`);
        void respondInviteAction(action.declineChallenge, "declined");
      }
    },
    [router, push, dismiss, disconnect, setViewer, players, to, copy, language],
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
      hint={me ? TAP_SECOND_LETTER : EMPTY_LOBBY_HINT}
      notices={notices}
      onAction={handleAction}
      onSignedIn={onSignedIn}
    >
      <Field
        landedCount={landed}
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
