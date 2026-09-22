"use client";

import { CHALLENGE, HERE_NOW, YOUR_LAST_MATCHES } from "@/lib/constants/copy";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { PlayerIdentity } from "@/lib/types/match";

interface LobbyLedgerProps {
  players: PlayerIdentity[];
  viewer: PlayerIdentity | null;
  recentGames: RecentGameRow[] | null;
  loadingPlayers?: boolean;
  onAction: (action: LedgerAction) => void;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** Lobby tables (design system §5.6): ruled rows, no cards, no avatars, `—` while loading. */
export function LobbyLedger({ players, viewer, recentGames, loadingPlayers = false, onAction }: LobbyLedgerProps) {
  const others = players.filter((p) => p.id !== viewer?.id);
  const viewerRating = viewer?.eloRating ?? null;
  return (
    <div className="lobby-ledger">
      <div className="ledger__mono lobby-ledger__title">{HERE_NOW}</div>
      <div className="lobby-ledger__table" data-testid="ledger-here-now" role="table" aria-label="here now">
        {loadingPlayers ? (
          <div className="lobby-ledger__row ledger__mono" role="row"><span role="cell">—</span></div>
        ) : others.length === 0 ? (
          <div className="lobby-ledger__row ledger__mono" role="row" data-testid="ledger-here-now-empty"><span role="cell">—</span></div>
        ) : (
          others.map((p) => (
            <div className="lobby-ledger__row" role="row" data-testid="ledger-here-now-row" data-player-id={p.id} key={p.id}>
              <span className="lobby-ledger__name" role="cell">
                <a href={`/profile/${encodeURIComponent(p.username)}`}>
                  {p.displayName} <span className="ledger__mono">@{p.username}</span>
                </a>
              </span>
              <span className="ledger__mono" role="cell">{p.eloRating ?? "—"}</span>
              <span className="ledger__mono" role="cell">
                {viewerRating != null && p.eloRating != null ? signed(p.eloRating - viewerRating) : "—"}
              </span>
              <span role="cell">
                {viewer && p.status !== "in_match" ? (
                  <button type="button" className="action-secondary" data-testid={`ledger-challenge-${p.id}`} onClick={() => onAction({ challenge: p.id })}>
                    {CHALLENGE}
                  </button>
                ) : (
                  <span className="ledger__mono">{p.status === "in_match" ? "in a match" : ""}</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {viewer ? (
        <>
          <div className="ledger__mono lobby-ledger__title">{YOUR_LAST_MATCHES}</div>
          <div className="lobby-ledger__table" data-testid="ledger-last-matches" role="table" aria-label="your last matches">
            {recentGames === null ? (
              <div className="lobby-ledger__row ledger__mono" role="row"><span role="cell">—</span></div>
            ) : recentGames.length === 0 ? (
              <div className="lobby-ledger__row ledger__mono" role="row"><span role="cell">—</span></div>
            ) : (
              recentGames.map((g) => (
                <div className="lobby-ledger__row" role="row" key={g.matchId} data-testid="ledger-last-match-row">
                  <span className="lobby-ledger__name" role="cell"><a href={`/profile/${encodeURIComponent(g.opponentUsername)}`}>{g.opponentDisplayName}</a></span>
                  <span className="ledger__mono" role="cell">
                    {g.yourScore}–{g.opponentScore}
                  </span>
                  <span className="ledger__mono" role="cell">{g.result}</span>
                  <span role="cell" />
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
