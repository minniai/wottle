"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { HISTORY, WORDMARK } from "@/lib/constants/copy";
import { getSeatColors } from "@/lib/constants/seatColors";
import { foldRows } from "@/lib/room/ledgerRows";
import { noticeText } from "@/lib/room/notices";
import { useMeasuredLines } from "./hooks/useMeasuredLines";
import type { LedgerAction, LedgerModel, LedgerRow, LiveLines, Notice, SeatCell } from "@/lib/room/ledgerTypes";
import { LedgerFoot } from "./LedgerFoot";
import { LedgerSheet } from "./LedgerSheet";
import { MoveRail } from "./MoveRail";
import type { RoomMenuVariant } from "./RoomMenu";

export type LedgerVariant = "match" | "final" | "lobby" | "queue";

export interface LedgerProps {
  variant: LedgerVariant;
  /** Below 900px: caption, live row and territory only; the rest opens from the live row. */
  collapsed?: boolean;
  model: LedgerModel;
  notices?: Notice[];
  viewerName: string;
  opponentName: string | null;
  /** Non-participant view: header without `· you`. */
  readOnly?: boolean;
  /** Lobby/queue content rendered in place of the rounds table. */
  body?: ReactNode;
  footActions?: ReactNode;
  onRowHover?: (move: number | null) => void;
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
  // A resolved move with no word writes 0 (spec 050 FR-016): played, not pending.
  if (cell.words.length === 0) {
    return (
      <div className="ledger__words ledger__words--empty" data-seat={seat}>
        <span className="ledger__total">0</span>
      </div>
    );
  }
  // 14px words: the text variant, which passes AA on paper (decision 2).
  const style = { "--seat-ink": getSeatColors(seat).text } as CSSProperties;
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

/** The live row's state line and, only while there is one, the instruction beneath it (amendment P1). */
function LiveText({ live }: { live?: LiveLines }) {
  if (!live) return null;
  return (
    <>
      <span className="ledger__live-line1">{live.line1}</span>
      {live.line2 ? <span className="ledger__live-line2">{live.line2}</span> : null}
    </>
  );
}

function Row({ row, hovered, onRowHover }: { row: LedgerRow; hovered: boolean; onRowHover?: (move: number | null) => void }) {
  const liveOrHeld = row.status === "live" || row.status === "settled";
  return (
    <div
      className={`ledger__row ledger__row--${row.status}${row.folded ? " ledger__row--folded" : ""}`}
      data-testid={`ledger-row-${row.move}`}
      data-status={row.status}
      data-folded={row.folded || undefined}
      onMouseEnter={() => onRowHover?.(row.move)}
      onMouseLeave={() => onRowHover?.(null)}
    >
      {liveOrHeld ? (
        /* The row itself is the tinted grid item with the 3px rule at its left
           edge; the viewer's column carries the beat and the instruction, the
           opponent's column their Nth move if they have played it (spec 050,
           design system §5.4). During the hold the row keeps the tint and says
           the move scored; its words land when the hold ends. */
        <>
          <div className="ledger__move" data-testid="ledger-live-move">M{row.move}</div>
          <div className="ledger__live-text" data-testid="ledger-live-row" aria-live="polite">
            <LiveText live={row.live} />
          </div>
          {/* Their total only, top-right on line 1: the rows share one height, so
              the live row must stay two lines. Their words land once it is past. */}
          <SeatWords cell={row.opp} seat="opp" showPoints={hovered} folded />
        </>
      ) : (
        <>
          {/* Future numerals are a progression mark, not a fact for AT: the caption carries the count (design system §7). */}
          <div className="ledger__move" aria-hidden={row.status === "future" || undefined}>M{row.move}</div>
          <SeatWords cell={row.you} seat="you" showPoints={hovered} folded={row.folded} />
          <SeatWords cell={row.opp} seat="opp" showPoints={hovered} folded={row.folded} />
        </>
      )}
    </div>
  );
}

function NoticeLine({ notice, onAction }: { notice: Notice; onAction: (action: LedgerAction) => void }) {
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
  return <>{noticeText(notice)}</>;
}

/**
 * Every fact about the match (design system §5.4): caption → seat header →
 * ten rows (one live) → territory → hint → notices → foot. It never scrolls.
 */
export function Ledger(props: LedgerProps) {
  const { variant, model, collapsed: collapsedProp = false, notices = [], viewerName, opponentName, readOnly = false, body, footActions, onRowHover, onAction, renderNotice } = props;
  const showsTable = variant === "match" || variant === "final";
  /**
   * Only a ledger with a rounds table collapses. The lobby's body is the here-now
   * directory and the queue's is its own progress — those are the primary content
   * of those states, not history to be folded away behind a button.
   */
  const collapsed = collapsedProp && showsTable;
  const { territory } = model;
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const liveRef = useRef<HTMLButtonElement | null>(null);
  // Widening back to desktop shows everything again, so an open sheet is moot.
  useEffect(() => {
    if (!collapsed) setSheetOpen(false);
  }, [collapsed]);
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    liveRef.current?.focus();
  }, []);
  const lineCounts = useMeasuredLines(rowsRef, ".ledger__words", [model.rows]);
  const rows = foldRows(model.rows, lineCounts);
  const hover = (move: number | null) => {
    setHovered(move);
    onRowHover?.(move);
  };
  const total = Math.max(1, territory.you + territory.opp + territory.free);

  const table = (
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
          <Row key={row.move} row={row} hovered={hovered === row.move} onRowHover={hover} />
        ))}
      </div>
    </>
  );

  const territoryBlock = showsTable ? (
    <>
      <div className="ledger__territory" data-testid="ledger-territory" role="img" aria-label={`territory ${territory.you}–${territory.opp}`}>
        <span className="ledger__territory-you" style={{ width: `${(territory.you / total) * 100}%` }} />
        <span style={{ flex: 1 }} />
        <span className="ledger__territory-opp" style={{ width: `${(territory.opp / total) * 100}%` }} />
      </div>
      <div className="ledger__mono">
        {territory.you} · {territory.free} free · {territory.opp}
      </div>
    </>
  ) : null;

  const noticeLines = notices.map((notice, i) => (
    <div key={`${notice.kind}-${i}`} className="ledger__notice" data-testid="ledger-notice" data-field-safe data-kind={notice.kind} aria-live="polite">
      {renderNotice ? renderNotice(notice) : <NoticeLine notice={notice} onAction={onAction} />}
    </div>
  ));

  const collapsedLive: LiveLines | undefined = model.live ? { line1: model.live, line2: "" } : rows.find((row) => row.status === "live" || row.status === "settled")?.live;
  // The rail (spec 048 US3): every ledger with moves to count — match, final and the queue (all future).
  const rail = variant === "lobby" ? null : <MoveRail movesPlayed={model.movesPlayed ?? null} completed={model.completed ?? false} />;

  return (
    <section className="ledger" data-testid="ledger" data-variant={variant} aria-label="ledger">
      <div className="ledger__caption" data-testid="ledger-caption">
        <span className="ledger__wordmark">{WORDMARK}</span>
        <span className="ledger__caption-right">
          <span className="ledger__mono" data-testid="ledger-context">
            {model.caption}
          </span>
          {model.clock !== undefined ? (
            /* The one place the match clock is drawn (spec 050 FR-015). Under 1:00 it
               is heavier and blinks in colour only; the live row announces the beats,
               so the timer itself is silent to AT. */
            <span className="ledger__caption-clock" data-testid="match-clock" data-low={model.clockLow || undefined} role="timer" aria-label="match clock" aria-live="off">
              {model.clock}
            </span>
          ) : null}
        </span>
      </div>
      {rail}

      {model.verdict ? (
        <div className="ledger__verdict" data-testid="verdict" aria-live="assertive">
          <div className="ledger__verdict-line">{model.verdict.scoreLine}</div>
          <div className="ledger__mono">{model.verdict.detailLine}</div>
        </div>
      ) : null}

      {showsTable && !collapsed ? (
        <>
          {table}
          {territoryBlock}
        </>
      ) : null}

      {collapsed || showsTable ? null : body}

      {collapsed ? (
        <>
          {/* Fig. 5: the live row carries the glance and opens the rest. */}
          <button
            ref={liveRef}
            type="button"
            className="ledger__live-row ledger__live-row--trigger"
            /* Distinct from the table's own live row, which the sheet also shows. */
            data-testid="ledger-live-trigger"
            aria-expanded={sheetOpen}
            onClick={() => (sheetOpen ? closeSheet() : setSheetOpen(true))}
          >
            <span className="ledger__live-text" aria-live="polite">
              <LiveText live={collapsedLive} />
            </span>
            <span className="ledger__live-more">{HISTORY}</span>
          </button>
          {territoryBlock}
          <LedgerSheet open={sheetOpen} onClose={closeSheet}>
            {showsTable ? table : body}
            {noticeLines}
            <LedgerFoot variant={menuVariant(variant)} actions={footActions} onAction={onAction} />
          </LedgerSheet>
        </>
      ) : (
        <>
          {model.live !== undefined && (
            <div className="ledger__live-row" data-testid="ledger-live-row" aria-live="polite">
              <div className="ledger__live-text ledger__live-text--full">{model.live}</div>
            </div>
          )}

          <div className="ledger__hint ledger__mono" data-testid="ledger-hint">
            {model.hint}
          </div>

          {noticeLines}

          <LedgerFoot variant={menuVariant(variant)} actions={footActions} onAction={onAction} />
        </>
      )}
    </section>
  );
}
