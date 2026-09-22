"use client";

import { useMemo, type ReactNode } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import type { LedgerAction, LedgerModel, Notice } from "@/lib/room/ledgerTypes";
import { EMPTY_TERRITORY } from "@/lib/room/ledgerTypes";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { PlayerIdentity } from "@/lib/types/match";
import { Ledger } from "./Ledger";
import { useIsPhone } from "./hooks/useIsPhone";
import { LobbyLedger } from "./LobbyLedger";
import { PlayerBar } from "./PlayerBar";
import { Room } from "./Room";

export interface LobbyRoomViewProps {
  /** `null` is the landing state: the bottom bar carries the name input. */
  viewer: PlayerIdentity | null;
  /** Everyone present, the viewer included; the caption counts the others. */
  players: PlayerIdentity[];
  recentGames: RecentGameRow[] | null;
  loadingPlayers: boolean;
  hint: string;
  notices?: Notice[];
  onAction: (action: LedgerAction) => void;
  onSignedIn: (player: PlayerIdentity) => void;
  /** The field slot — the warm-up field, wired by the controller. */
  children: ReactNode;
}

/**
 * The lobby phase of the room (design system §7): an empty opponent bar, the
 * warm-up field, your bar (or the name input), and the lobby ledger. Landing and
 * lobby are the same screen; signing in converts the bar in place.
 *
 * Presentational, as `MatchRoomView` is: every fact arrives as a prop so the
 * fixture route can mount it without a database (spec 045 FR-003).
 */
export function LobbyRoomView(props: LobbyRoomViewProps) {
  const { EMPTY_LOBBY_HINT, lobbyContext, NO_OPPONENT, NO_OPPONENT_SUBLINE, FIND_OPPONENT, SIGN_IN_TO_SET_THE_FIELD, YOU } = useCopy();
  const { viewer, players, recentGames, loadingPlayers, hint, notices, onAction, onSignedIn, children } = props;
  const isPhone = useIsPhone();

  const model: LedgerModel = useMemo(
    () => ({
      caption: lobbyContext(players.filter((p) => p.id !== viewer?.id).length),
      rows: [],
      territory: EMPTY_TERRITORY,
      hint: viewer ? hint : EMPTY_LOBBY_HINT,
    }),
    [players, viewer, hint, EMPTY_LOBBY_HINT, lobbyContext],
  );

  return (
    <Room
      onSlipAction={onAction}
      onSignedIn={onSignedIn}
      topBar={
        <PlayerBar
          seat="opp"
          position="top"
          state="empty"
          name={NO_OPPONENT}
          subline={NO_OPPONENT_SUBLINE}
          action={
            viewer ? (
              <button type="button" className="action-primary" data-testid="player-bar-action-find" onClick={() => onAction("findOpponent")}>
                {FIND_OPPONENT}
              </button>
            ) : undefined
          }
        />
      }
      field={children}
      bottomBar={
        viewer ? (
          <PlayerBar seat="you" position="bottom" state="idle" name={viewer.displayName} subline={`${viewer.eloRating ?? "unrated"} · ${YOU}`} />
        ) : (
          <PlayerBar seat="you" position="bottom" state="empty" name="—" subline={SIGN_IN_TO_SET_THE_FIELD} />
        )
      }
      ledger={
        <Ledger
          variant="lobby"
          collapsed={isPhone}
          model={model}
          notices={notices}
          viewerName={viewer?.displayName ?? ""}
          opponentName={null}
          body={
            <LobbyLedger
              players={players}
              viewer={viewer}
              recentGames={viewer ? recentGames : null}
              loadingPlayers={loadingPlayers}
              onAction={onAction}
            />
          }
          onAction={onAction}
        />
      }
    />
  );
}
