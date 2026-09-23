"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { getSeatColors } from "@/lib/constants/seatColors";
import { foldRows } from "@/lib/room/ledgerRows";
import { noticeKey, noticeText } from "@/lib/room/notices";
import { useMeasuredLines } from "./hooks/useMeasuredLines";
import type { LedgerAction, LedgerModel, LedgerRow, LiveLines, Notice, SeatCell } from "@/lib/room/ledgerTypes";
import { LedgerFoot } from "./LedgerFoot";
import { LedgerSheet } from "./LedgerSheet";
import { RoomMenu, type RoomMenuVariant } from "./RoomMenu";

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

/**
 * One player's cell (the spine, 2026-09-21): words and the move's points, the
 * points always beside the spine — after your words, before theirs. A miss
 * says so in words, and its −5 is muted, so it never reads as a score.
 */
function SeatWords({ cell, seat, showPoints, folded }: { cell: SeatCell | null; seat: "you" | "opp"; showPoints: boolean; folded: boolean }) {
  const { NO_WORD, NOT_PLAYED, points } = useCopy();
  if (!cell) return <div className="ledger__words" data-seat={seat} />;
  const total = <span className="ledger__total">{points(cell.total)}</span>;
  const inward = (content: ReactNode) => (seat === "you" ? <>{content}{total}</> : <>{total}{content}</>);
  if (cell.words.length === 0) {
    return (
      <div className="ledger__words ledger__words--empty" data-seat={seat} data-miss={cell.miss || undefined} data-unplayed={cell.unplayed || undefined}>
        {inward(<span className="ledger__miss">{cell.unplayed ? NOT_PLAYED : NO_WORD}</span>)}
      </div>
    );
  }
  // 14px words: the text variant, which passes AA on paper (decision 2).
  const style = { "--seat-ink": getSeatColors(seat).text } as CSSProperties;
  if (folded) {
    return (
      <div className="ledger__words ledger__words--folded" style={style} data-seat={seat} title={cell.words.map((w) => w.word).join(" · ")}>
        {total}
      </div>
    );
  }
  return (
    <div className="ledger__words" style={style} data-seat={seat}>
      {inward(
        <span className="ledger__word-list">
          {cell.words.map((w, i) => (
            <span key={`${w.word}-${i}`}>
              {i > 0 ? " · " : ""}
              {w.word}
              {showPoints ? <span className="ledger__points"> {w.points}</span> : null}
            </span>
          ))}
        </span>,
      )}
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
          {/* One band across the ledger: the beat names the move, so the spine breaks here. */}
          <div className="ledger__live-text" data-testid="ledger-live-row" aria-live="polite">
            <LiveText live={row.live} />
          </div>
          {/* Their total only, top-right on line 1: the rows share one height, so
              the live row must stay two lines. Their words land once it is past. */}
          <SeatWords cell={row.opp} seat="opp" showPoints={hovered} folded />
        </>
      ) : (
        <>
          {/* Your cell, the spine, theirs: the move number separates the players. Future
              numerals are a progression mark, not a fact for AT (design system §7). */}
          <SeatWords cell={row.you} seat="you" showPoints={hovered} folded={row.folded} />
          <div className="ledger__move" aria-hidden={row.status === "future" || undefined}>{row.move}</div>
          <SeatWords cell={row.opp} seat="opp" showPoints={hovered} folded={row.folded} />
        </>
      )}
    </div>
  );
}

function NoticeLine({ notice, onAction }: { notice: Notice; onAction: (action: LedgerAction) => void }) {
  const copy = useCopy();
  if (notice.kind === "challenge") {
    return (
      <>
        {notice.fromName} {copy.CHALLENGES_YOU} ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-accept-challenge" onClick={() => onAction({ acceptChallenge: notice.inviteId })}>
          {copy.ACCEPT}
        </button>{" "}
        ·{" "}
        <button type="button" className="action-secondary" data-testid="notice-decline-challenge" onClick={() => onAction({ declineChallenge: notice.inviteId })}>
          {copy.DECLINE}
        </button>
      </>
    );
  }
  return <>{noticeText(notice, copy)}</>;
}

/**
 * Every fact about the match (design system §5.4): caption → seat header →
 * ten rows (one live) → territory → hint → notices → foot. It never scrolls.
 */
export function Ledger(props: LedgerProps) {
  const { HISTORY, points, SPINE_HEADER, TOTAL_LABEL, WORDMARK, LEDGER, LANGUAGE_WORDS, territoryAria, territoryLine, YOU } = useCopy();
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

  const header = (
      <div className="ledger__header" data-testid="ledger-header">
        <span className="ledger__header-you">
          {viewerName}
          {readOnly ? "" : ` · ${YOU}`}
          <span className="ledger__seat" style={{ background: "var(--you)" }} aria-hidden />
        </span>
        <span className="ledger__header-spine">{SPINE_HEADER}</span>
        <span className="ledger__header-opp">
          <span className="ledger__seat" style={{ background: "var(--opp)" }} aria-hidden />
          {opponentName ?? "—"}
        </span>
      </div>
  );

  const rowsAndTotals = (
    <>
      <div ref={rowsRef} className="ledger__rows" data-testid="ledger-rows">
        {rows.map((row) => (
          <Row key={row.move} row={row} hovered={hovered === row.move} onRowHover={hover} />
        ))}
      </div>
      {model.completed && model.totals ? (
        <div className="ledger__totals" data-testid="ledger-totals">
          <span className="ledger__totals-you">{points(model.totals.you)}</span>
          <span className="ledger__header-spine">{TOTAL_LABEL}</span>
          <span className="ledger__totals-opp">{points(model.totals.opp)}</span>
        </div>
      ) : null}
    </>
  );

  const table = (
    <>
      {header}
      {rowsAndTotals}
    </>
  );

  const territoryBlock = showsTable ? (
    <>
      <div className="ledger__territory" data-testid="ledger-territory" role="img" aria-label={territoryAria(territory.you, territory.opp)}>
        <span className="ledger__territory-you" style={{ width: `${(territory.you / total) * 100}%` }} />
        <span style={{ flex: 1 }} />
        <span className="ledger__territory-opp" style={{ width: `${(territory.opp / total) * 100}%` }} />
      </div>
      <div className="ledger__mono">
        {territoryLine(territory.you, territory.free, territory.opp)}
      </div>
    </>
  ) : null;

  const noticeLines = notices.map((notice) => (
    <div key={noticeKey(notice)} className="ledger__notice" data-testid="ledger-notice" data-field-safe data-kind={notice.kind} aria-live="polite">
      {renderNotice ? renderNotice(notice) : <NoticeLine notice={notice} onAction={onAction} />}
    </div>
  ));

  const collapsedLive: LiveLines | undefined = model.live ? { line1: model.live, line2: "" } : rows.find((row) => row.status === "live" || row.status === "settled")?.live;

  // Desktop match and final (spec 068): the ledger sits on the scoreboard's grid.
  // Its first three rows mirror the scoreboard's, and each move row is one cell tall.
  const grid = showsTable && !collapsed;

  const verdictBlock = model.verdict ? (
    <div className="ledger__verdict" data-testid="verdict" aria-live="assertive">
      <div className="ledger__verdict-line">{model.verdict.scoreLine}</div>
      <div className="ledger__mono">{model.verdict.detailLine}</div>
    </div>
  ) : null;

  const caption = (
    <div className="ledger__caption" data-testid="ledger-caption">
      <span className="ledger__wordmark">{WORDMARK}</span>
      <span className="ledger__caption-right">
        <span className="ledger__mono" data-testid="ledger-context">
          {model.caption}
        </span>
        {grid ? <RoomMenu variant={menuVariant(variant)} onAction={onAction} /> : null}
      </span>
    </div>
  );

  return (
    <section className="ledger" data-testid="ledger" data-variant={variant} data-grid={grid || undefined} aria-label={LEDGER}>
      {grid ? (
        <div className="ledger__head" data-testid="ledger-head">
          {caption}
          <div className="ledger__state-line" data-testid="ledger-state-line">
            {verdictBlock ?? territoryBlock}
          </div>
          {header}
        </div>
      ) : (
        <>
          {/* On a phone the match's top is the scoreboard and the field; the wordmark stays off it (artboard PhoneMatch). */}
          {collapsed ? null : caption}
          {verdictBlock}
        </>
      )}

      {grid ? rowsAndTotals : null}

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
          <div className="ledger__territory-block">{territoryBlock}</div>
          <LedgerSheet open={sheetOpen} onClose={closeSheet}>
            {showsTable ? table : body}
            {noticeLines}
            {footActions ? <LedgerFoot variant={menuVariant(variant)} actions={footActions} onAction={onAction} menu={false} /> : null}
          </LedgerSheet>
          {/* Pinned to the bottom edge with the safe area, always visible (spec 068 FR-015). */}
          <div className="ledger__phone-foot" data-testid="ledger-phone-foot" data-field-safe>
            <RoomMenu variant={menuVariant(variant)} onAction={onAction} />
            <span className="ledger__mono">{LANGUAGE_WORDS}</span>
          </div>
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

          {/* On the grid the ⋯ lives in the caption; the final state keeps its actions in the foot. */}
          {grid && variant === "match" ? null : <LedgerFoot variant={menuVariant(variant)} actions={footActions} onAction={onAction} menu={!grid} />}
        </>
      )}
    </section>
  );
}
