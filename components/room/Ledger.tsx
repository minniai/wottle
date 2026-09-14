"use client";

import type { CSSProperties, ReactNode } from "react";

import { WORDMARK } from "@/lib/constants/copy";
import { getSeatColors } from "@/lib/constants/seatColors";
import { noticeText } from "@/lib/room/notices";
import type { LedgerAction, LedgerModel, LedgerRow, Notice, SeatCell } from "@/lib/room/ledgerTypes";
import { LedgerFoot } from "./LedgerFoot";
import type { RoomMenuVariant } from "./RoomMenu";

export type LedgerVariant = "match" | "final" | "lobby" | "queue";

export interface LedgerProps {
  variant: LedgerVariant;
  model: LedgerModel;
  notices?: Notice[];
  viewerName: string;
  opponentName: string | null;
  /** Lobby/queue content rendered in place of the rounds table. */
  body?: ReactNode;
  footActions?: ReactNode;
  onRowHover?: (round: number | null) => void;
  onAction: (action: LedgerAction) => void;
  renderNotice?: (notice: Notice) => ReactNode;
}

function menuVariant(variant: LedgerVariant): RoomMenuVariant {
  if (variant === "match") return "match";
  if (variant === "final") return "final";
  return "lobby";
}

function SeatWords({ cell, seat }: { cell: SeatCell | null; seat: "you" | "opp" }) {
  if (!cell) return <div className="ledger__words" />;
  return (
    <div className="ledger__words" style={{ "--seat-ink": getSeatColors(seat).ink } as CSSProperties}>
      {cell.words.map((w) => w.word).join(" · ")}
      {cell.words.length > 0 ? <span className="ledger__total">{cell.total}</span> : null}
    </div>
  );
}

function Row({ row, onRowHover }: { row: LedgerRow; onRowHover?: (round: number | null) => void }) {
  return (
    <div
      className={`ledger__row ledger__row--${row.status}`}
      data-testid={`ledger-row-${row.round}`}
      data-status={row.status}
      onMouseEnter={() => onRowHover?.(row.round)}
      onMouseLeave={() => onRowHover?.(null)}
    >
      <div className="ledger__round">R{row.round}</div>
      {row.status === "live" ? (
        <div className="ledger__live-row" style={{ gridColumn: "span 2" }} data-testid="ledger-live-row" aria-live="polite">
          {row.liveText ?? ""}
        </div>
      ) : (
        <>
          <SeatWords cell={row.you} seat="you" />
          <SeatWords cell={row.opp} seat="opp" />
        </>
      )}
    </div>
  );
}

function NoticeLine({ notice, onAction }: { notice: Notice; onAction: (action: LedgerAction) => void }) {
  if (notice.kind === "resignConfirm") {
    return (
      <>
        resign the match? ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-confirm-resign" onClick={() => onAction("confirmResign")}>
          yes, resign ▸
        </button>{" "}
        ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-cancel-resign" onClick={() => onAction("cancelResign")}>
          no
        </button>
      </>
    );
  }
  if (notice.kind === "rematchRequest") {
    return (
      <>
        {notice.requesterName} asks for a rematch ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-accept-rematch" onClick={() => onAction("acceptRematch")}>
          accept ▸
        </button>{" "}
        ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-decline-rematch" onClick={() => onAction("declineRematch")}>
          decline
        </button>
      </>
    );
  }
  if (notice.kind === "claimWin") {
    return (
      <>
        {notice.opponentName} is gone ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-claim-win" onClick={() => onAction("claimWin")}>
          claim the win ▸
        </button>
      </>
    );
  }
  return <>{noticeText(notice)}</>;
}

/**
 * Every fact about the match (design system §5.4): caption → seat header →
 * ten rows (one live) → territory → hint → notices → foot. It never scrolls.
 */
export function Ledger(props: LedgerProps) {
  const { variant, model, notices = [], viewerName, opponentName, body, footActions, onRowHover, onAction, renderNotice } = props;
  const showsTable = variant === "match" || variant === "final";
  const { territory } = model;
  const total = Math.max(1, territory.you + territory.opp + territory.free);

  return (
    <section className="ledger" data-testid="ledger" data-variant={variant} aria-label="ledger">
      <div className="ledger__caption" data-testid="ledger-caption">
        <span className="ledger__wordmark">{WORDMARK}</span>
        <span className="ledger__mono" data-testid="round-indicator">
          {model.caption}
        </span>
      </div>

      {model.verdict ? (
        <div className="ledger__verdict" data-testid="verdict" aria-live="assertive">
          <div className="ledger__verdict-line">{model.verdict.scoreLine}</div>
          <div className="ledger__mono">{model.verdict.detailLine}</div>
        </div>
      ) : null}

      {showsTable ? (
        <>
          <div className="ledger__header" data-testid="ledger-header">
            <span />
            <span>
              <span className="ledger__seat" style={{ background: "var(--you)" }} aria-hidden /> {viewerName} · you
            </span>
            <span>
              <span className="ledger__seat" style={{ background: "var(--opp)" }} aria-hidden /> {opponentName ?? "—"}
            </span>
          </div>
          <div className="ledger__rows" data-testid="ledger-rows">
            {model.rows.map((row) => (
              <Row key={row.round} row={row} onRowHover={onRowHover} />
            ))}
          </div>
          <div className="ledger__territory" data-testid="ledger-territory" aria-label={`territory ${territory.you}–${territory.opp}`}>
            <span className="ledger__territory-you" style={{ width: `${(territory.you / total) * 100}%` }} />
            <span style={{ flex: 1 }} />
            <span className="ledger__territory-opp" style={{ width: `${(territory.opp / total) * 100}%` }} />
          </div>
          <div className="ledger__mono">
            {territory.you} · {territory.free} free · {territory.opp}
          </div>
        </>
      ) : (
        body
      )}

      <div className="ledger__hint ledger__mono" data-testid="ledger-hint">
        {model.hint}
      </div>

      {notices.map((notice, i) => (
        <div key={`${notice.kind}-${i}`} className="ledger__notice" data-testid="ledger-notice" data-kind={notice.kind} aria-live="polite">
          {renderNotice ? renderNotice(notice) : <NoticeLine notice={notice} onAction={onAction} />}
        </div>
      ))}

      <LedgerFoot variant={menuVariant(variant)} actions={footActions} onAction={onAction} />
    </section>
  );
}
