"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

import { WORDMARK } from "@/lib/constants/copy";
import { getSeatColors } from "@/lib/constants/seatColors";
import { foldRows } from "@/lib/room/ledgerRows";
import { noticeText } from "@/lib/room/notices";
import { useMeasuredLines } from "./hooks/useMeasuredLines";
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
  /** Non-participant view: header without `· you`. */
  readOnly?: boolean;
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

function SeatWords({ cell, seat, showPoints, folded }: { cell: SeatCell | null; seat: "you" | "opp"; showPoints: boolean; folded: boolean }) {
  if (!cell) return <div className="ledger__words" data-seat={seat} />;
  const style = { "--seat-ink": getSeatColors(seat).ink } as CSSProperties;
  if (folded) {
    return (
      <div className="ledger__words ledger__words--folded" style={style} data-seat={seat} title={cell.words.map((w) => w.word).join(" · ")}>
        <span className="ledger__total">{cell.total}</span>
      </div>
    );
  }
  return (
    <div className="ledger__words" style={style} data-seat={seat}>
      {cell.words.map((w, i) => (
        <span key={`${w.word}-${i}`}>
          {i > 0 ? " · " : ""}
          {w.word}
          {showPoints ? <span className="ledger__points"> {w.points}</span> : null}
        </span>
      ))}
      {cell.words.length > 0 ? <span className="ledger__total">{cell.total}</span> : null}
    </div>
  );
}

function Row({ row, hovered, onRowHover }: { row: LedgerRow; hovered: boolean; onRowHover?: (round: number | null) => void }) {
  return (
    <div
      className={`ledger__row ledger__row--${row.status}${row.folded ? " ledger__row--folded" : ""}`}
      data-testid={`ledger-row-${row.round}`}
      data-status={row.status}
      data-folded={row.folded || undefined}
      onMouseEnter={() => onRowHover?.(row.round)}
      onMouseLeave={() => onRowHover?.(null)}
    >
      {row.status === "live" ? (
        /* One element across all three columns so the tint reaches both edges
           with the 3px rule at its left; the inner grid keeps the label aligned
           with the rows above (Fig. 2, spec 045 B2). */
        <div className="ledger__live-row" style={{ gridColumn: "1 / -1" }} data-testid="ledger-live-row" aria-live="polite">
          <div className="ledger__round" data-testid="ledger-live-round">R{row.round}</div>
          <div className="ledger__live-text">{row.liveText ?? ""}</div>
        </div>
      ) : (
        <>
          {/* Future numerals are a progression mark, not a fact for AT: the caption carries the round (design system §7). */}
          <div className="ledger__round" aria-hidden={row.status === "future" || undefined}>R{row.round}</div>
          <SeatWords cell={row.you} seat="you" showPoints={hovered} folded={row.folded} />
          <SeatWords cell={row.opp} seat="opp" showPoints={hovered} folded={row.folded} />
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
  if (notice.kind === "challenge") {
    return (
      <>
        {notice.fromName} challenges you ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-accept-challenge" onClick={() => onAction({ acceptChallenge: notice.inviteId })}>
          accept ▸
        </button>{" "}
        ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-decline-challenge" onClick={() => onAction({ declineChallenge: notice.inviteId })}>
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
  const { variant, model, notices = [], viewerName, opponentName, readOnly = false, body, footActions, onRowHover, onAction, renderNotice } = props;
  const showsTable = variant === "match" || variant === "final";
  const { territory } = model;
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const lineCounts = useMeasuredLines(rowsRef, ".ledger__words", [model.rows]);
  const rows = foldRows(model.rows, lineCounts);
  const hover = (round: number | null) => {
    setHovered(round);
    onRowHover?.(round);
  };
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
              <span className="ledger__seat" style={{ background: "var(--you)" }} aria-hidden /> {viewerName}{readOnly ? "" : " · you"}
            </span>
            <span>
              <span className="ledger__seat" style={{ background: "var(--opp)" }} aria-hidden /> {opponentName ?? "—"}
            </span>
          </div>
          <div ref={rowsRef} className="ledger__rows" data-testid="ledger-rows">
            {rows.map((row) => (
              <Row key={row.round} row={row} hovered={hovered === row.round} onRowHover={hover} />
            ))}
          </div>
          <div className="ledger__territory" data-testid="ledger-territory" role="img" aria-label={`territory ${territory.you}–${territory.opp}`}>
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

      {model.live !== undefined && (
        <div className="ledger__live-row" style={{ gridColumn: "1 / -1" }} data-testid="ledger-live-row" aria-live="polite">
          <div className="ledger__live-text ledger__live-text--full">{model.live}</div>
        </div>
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
