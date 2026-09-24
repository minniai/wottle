"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { getSeatColors } from "@/lib/constants/seatColors";
import { getNextRovingIndex } from "@/lib/a11y/rovingFocus";
import { foldRows } from "@/lib/room/ledgerRows";
import { cellName, type CellState } from "@/lib/review/ledgerCells";
import type { ReviewNames } from "@/lib/review/stepFacts";
import { noticeKey, noticeText } from "@/lib/room/notices";
import { useMeasuredLines } from "./hooks/useMeasuredLines";
import type { LedgerAction, LedgerModel, LedgerRow, LiveLines, Notice, SeatCell, Verdict } from "@/lib/room/ledgerTypes";
import { LedgerFoot } from "./LedgerFoot";
import { LedgerSheet } from "./LedgerSheet";
import { PointsLost } from "./PointsLost";
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
  /** Spec 071: the ledger in review; cells jump to their step. */
  review?: LedgerReview;
}

type Slot = "player_a" | "player_b";

export interface LedgerReview {
  /** Whose column is `you`: the viewer's, or player A's for a reader who did not play. */
  viewerSlot: Slot;
  /** The row the cursor line takes: the step's move, or for the closing step the first unplayed row (slot null). */
  current: { slot: Slot | null; move: number } | null;
  cursor: LiveLines;
  states: Map<string, CellState>;
  names: ReviewNames;
  /** The step controls, on the head's state line (desktop). */
  controls: ReactNode;
  /** The phone's: five glyphs pinned in the foot beside `◂ result` (game flow F7). */
  phoneControls?: ReactNode;
  onJump: (slot: Slot, move: number) => void;
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
    // Points lost read inward to the spine: `no word −5` in your column, `−5 not played` in theirs.
    return (
      <div className="ledger__words ledger__words--empty" data-seat={seat} data-miss={cell.miss || undefined} data-unplayed={cell.unplayed || undefined}>
        <PointsLost value={cell.total} label={cell.unplayed ? NOT_PLAYED : NO_WORD} labelFirst={seat === "you"} />
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

/** Line 2 in parts: words, a crimson number of points lost, or a secondary action (spec 068). */
function Line2({ live, onAction }: { live: LiveLines; onAction?: (action: LedgerAction) => void }) {
  if (!live.line2Parts) return <>{live.line2}</>;
  // Inside a control (the phone's live row) an action is left out: its button is drawn beside the row.
  if (!onAction) {
    const words = live.line2Parts.map((part) => ("text" in part ? part.text : "")).join("").replace(/ · $/, "");
    const loss = live.line2Parts.find((part) => "pointsLost" in part);
    if (!loss) return <>{words}</>;
  }
  return (
    <>
      {live.line2Parts.map((part, i) => {
        if ("text" in part) return <span key={i}>{part.text}</span>;
        if ("pointsLost" in part) return <PointsLost key={i} value={part.pointsLost.value} label={part.pointsLost.label} />;
        if (!onAction) return null;
        return (
          <button key={i} type="button" className="action-secondary" onClick={() => onAction(part.action.action)}>
            {part.action.label}
          </button>
        );
      })}
    </>
  );
}

/** The action a live row's second line offers, if any (the end-early offer, spec 068 FR-036). */
function offerOf(live?: LiveLines): { label: string; action: LedgerAction } | null {
  const part = live?.line2Parts?.find((p) => "action" in p);
  return part && "action" in part ? part.action : null;
}

/** The live row's state line and, only while there is one, the instruction beneath it (amendment P1). */
function LiveText({ live, onAction }: { live?: LiveLines; onAction?: (action: LedgerAction) => void }) {
  if (!live) return null;
  return (
    <>
      <span className="ledger__live-line1">{live.line1}</span>
      {live.line2 ? (
        <span className="ledger__live-line2">
          <Line2 live={live} onAction={onAction} />
        </span>
      ) : null}
    </>
  );
}

function ReviewCell({ slot, row, seat, review }: { slot: Slot; row: LedgerRow; seat: "you" | "opp"; review: LedgerReview }) {
  const copy = useCopy();
  const state = review.states.get(`${slot}:${row.move}`);
  const cell = seat === "you" ? row.you : row.opp;
  if (!state) return <SeatWords cell={cell} seat={seat} showPoints={false} folded={row.folded ?? false} />;
  return (
    <div
      role="gridcell"
      tabIndex={-1}
      className="ledger__review-cell"
      data-review={state}
      data-cell={`${slot}:${row.move}`}
      aria-label={cellName(slot, row.move, review.names, state, copy)}
      onClick={() => review.onJump(slot, row.move)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          review.onJump(slot, row.move);
        }
      }}
    >
      <SeatWords cell={cell} seat={seat} showPoints={false} folded={row.folded ?? false} />
    </div>
  );
}

/** Spec 071 (FR-036, FR-037): a row in review; the step's move is the cursor line, in the live row's style. */
function ReviewRow({ row, review }: { row: LedgerRow; review: LedgerReview }) {
  const youSlot = review.viewerSlot;
  const oppSlot: Slot = youSlot === "player_a" ? "player_b" : "player_a";
  const cursorHere = review.current?.move === row.move;
  return (
    <div role="row" className={`ledger__row ledger__row--${cursorHere ? "settled" : "past"}`} data-testid={`ledger-row-${row.move}`} data-status={cursorHere ? "settled" : "past"}>
      {cursorHere ? (
        <>
          <div role="gridcell" tabIndex={-1} className="ledger__live-text" data-testid="ledger-live-row" aria-live="polite">
            <LiveText live={review.cursor} />
          </div>
          {review.current?.slot ? <SeatWords cell={review.current.slot === youSlot ? row.opp : row.you} seat={review.current.slot === youSlot ? "opp" : "you"} showPoints={false} folded /> : null}
        </>
      ) : (
        <>
          <ReviewCell slot={youSlot} row={row} seat="you" review={review} />
          <div className="ledger__move" aria-hidden="true">{row.move}</div>
          <ReviewCell slot={oppSlot} row={row} seat="opp" review={review} />
        </>
      )}
    </div>
  );
}

/** One grid, one tab stop (FR-036): the arrows and Home/End move among its cells. */
function useRovingGrid(): [RefObject<HTMLDivElement | null>, (e: KeyboardEvent<HTMLDivElement>) => void] {
  const ref = useRef<HTMLDivElement | null>(null);
  const cells = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="gridcell"]') ?? []);
  useEffect(() => {
    const all = cells();
    const current = all.find((c) => c.getAttribute("data-review") === "current") ?? all.find((c) => c.dataset.testid === "ledger-live-row") ?? all[0];
    all.forEach((c) => (c.tabIndex = c === current ? 0 : -1));
  });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = cells();
    const index = all.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = all[getNextRovingIndex(index, all.length, e.key)];
    all.forEach((c) => (c.tabIndex = c === next ? 0 : -1));
    next.focus();
  };
  return [ref, onKeyDown];
}

function Row({ row, hovered, onRowHover, onAction }: { row: LedgerRow; hovered: boolean; onRowHover?: (move: number | null) => void; onAction?: (action: LedgerAction) => void }) {
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
            <LiveText live={row.live} onAction={onAction} />
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

/**
 * The grid's state row has one line under the verdict (spec 068): the detail's first two
 * clauses, which say why the match ended; the slip carries the rest (spec 071).
 */
function gridDetail(verdict: Verdict): string {
  return verdict.detailClauses ? verdict.detailClauses.slice(0, 2).join(" · ") : verdict.detailLine;
}

function NoticeLine({ notice, onAction }: { notice: Notice; onAction: (action: LedgerAction) => void }) {
  const copy = useCopy();
  if (notice.kind !== "call" && notice.kind !== "rematch") return <>{noticeText(notice, copy)}</>;
  // A call or a rematch on the result screen (B6, spec 071 T41): the line and its two secondaries.
  const [accept, decline, id]: [LedgerAction, LedgerAction, string] =
    notice.kind === "rematch" ? ["acceptRematch", "declineRematch", "ledger-rematch"] : ["acceptCall", "declineCall", "ledger-call"];
  // Two lines, so a long name never pushes the actions out of the row (spec 071): the call, then its answers.
  return (
    <>
      <span className="ledger__call-text">{notice.text}</span>
      <span className="ledger__call-actions">
        <button type="button" className="action-secondary" data-testid={`${id}-accept`} onClick={() => onAction(accept)}>
          {copy.ACCEPT}
        </button>
        <button type="button" className="action-secondary" data-testid={`${id}-decline`} onClick={() => onAction(decline)}>
          {copy.DECLINE}
        </button>
      </span>
      {notice.kind === "rematch" ? <span className="ledger__drain" data-testid="ledger-rematch-drain" style={{ transform: `scaleX(${notice.drain})` }} /> : null}
    </>
  );
}

/**
 * The phone foot's right end (spec 071, F4, F7): in review `◂ result` and the five step glyphs;
 * at the result its actions (`result ▸` once the slip is lifted); the language otherwise.
 */
function phoneFootEnd(variant: LedgerVariant, review: LedgerReview | undefined, footActions: ReactNode, words: { language: string; result: string }, onAction: (a: LedgerAction) => void): ReactNode {
  if (review) {
    return (
      <span className="ledger__phone-review">
        <button type="button" className="action-secondary" data-testid="ledger-phone-result" onClick={() => onAction("result")}>
          ◂ {words.result}
        </button>
        {review.phoneControls}
      </span>
    );
  }
  if (variant === "final" && footActions) return <span className="ledger__phone-actions">{footActions}</span>;
  return <span className="ledger__mono">{words.language}</span>;
}

/**
 * Every fact about the match (design system §5.4): caption → seat header →
 * ten rows (one live) → territory → hint → notices → foot. It never scrolls.
 */
export function Ledger(props: LedgerProps) {
  const { HISTORY, points, SPINE_HEADER, TOTAL_LABEL, WORDMARK, LEDGER, LANGUAGE_WORDS, RESULT, territoryAria, territoryLine, YOU } = useCopy();
  const { variant, model, collapsed: collapsedProp = false, notices = [], viewerName, opponentName, readOnly = false, body, footActions, onRowHover, onAction, renderNotice, review } = props;
  const [gridRef, onGridKeyDown] = useRovingGrid();
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

  const rows10 = review ? (
    <div ref={gridRef} className="ledger__rows" data-testid="ledger-rows" role="grid" aria-label={LEDGER} onKeyDown={onGridKeyDown}>
      {rows.map((row) => (
        <ReviewRow key={row.move} row={row} review={review} />
      ))}
    </div>
  ) : (
    <div ref={rowsRef} className="ledger__rows" data-testid="ledger-rows">
      {rows.map((row) => (
        <Row key={row.move} row={row} hovered={hovered === row.move} onRowHover={hover} onAction={onAction} />
      ))}
    </div>
  );

  const totalsRow =
    model.completed && model.totals ? (
      <div className="ledger__totals" data-testid="ledger-totals">
        <span className="ledger__totals-you">{points(model.totals.you)}</span>
        <span className="ledger__header-spine">{TOTAL_LABEL}</span>
        <span className="ledger__totals-opp">{points(model.totals.opp)}</span>
      </div>
    ) : null;

  const table = (
    <>
      {header}
      {rows10}
      {totalsRow}
    </>
  );

  const territoryBar = (
    <div className="ledger__territory" data-testid="ledger-territory" role="img" aria-label={territoryAria(territory.you, territory.opp)}>
      <span className="ledger__territory-you" style={{ width: `${(territory.you / total) * 100}%` }} />
      <span style={{ flex: 1 }} />
      <span className="ledger__territory-opp" style={{ width: `${(territory.opp / total) * 100}%` }} />
    </div>
  );
  const territoryNumbers = <div className="ledger__mono">{territoryLine(territory.you, territory.free, territory.opp)}</div>;
  const territoryBlock = showsTable ? (
    <>
      {territoryBar}
      {territoryNumbers}
    </>
  ) : null;

  const noticeLines = notices.map((notice) => (
    <div key={noticeKey(notice)} className="ledger__notice" data-testid="ledger-notice" data-field-safe data-kind={notice.kind} aria-live="polite">
      {renderNotice ? renderNotice(notice) : <NoticeLine notice={notice} onAction={onAction} />}
    </div>
  ));

  // In review the cursor line takes the live row's place on a phone (F7).
  const collapsedLive: LiveLines | undefined = review ? review.cursor : model.live ? { line1: model.live, line2: "" } : rows.find((row) => row.status === "live" || row.status === "settled")?.live;

  const latestNotice = noticeLines.length > 0 ? noticeLines[noticeLines.length - 1] : null;
  // On a phone a call cannot wait in the closed sheet: it sits under the live row (B6).
  // An incoming rematch outranks a third party's call (spec 071 T41, T65).
  const rematchIndex = notices.findIndex((n) => n.kind === "rematch");
  const callIndex = rematchIndex >= 0 ? rematchIndex : notices.findIndex((n) => n.kind === "call");
  const phoneCall = callIndex >= 0 ? noticeLines[callIndex] : null;
  const sheetNotices = noticeLines.filter((_, i) => i !== callIndex);

  // Desktop match and final (spec 068): the ledger sits on the scoreboard's grid.
  // Its first three rows mirror the scoreboard's, and each move row is one cell tall.
  const grid = showsTable && !collapsed;

  const verdictBlock = model.verdict ? (
    <div className="ledger__verdict" data-testid="verdict" aria-live="assertive">
      <div className="ledger__verdict-line">{model.verdict.scoreLine}</div>
      <div className="ledger__mono">{gridDetail(model.verdict)}</div>
    </div>
  ) : null;

  const caption = (
    <div className="ledger__caption" data-testid="ledger-caption">
      <span className="ledger__wordmark">{WORDMARK}</span>
      <span className="ledger__caption-right">
        {/* On the grid the final state's actions take the context's place: the scoreboard says the match is over (spec 068). */}
        {grid && variant === "final" && footActions ? (
          <span className="ledger__actions" data-testid="ledger-caption-actions">
            {footActions}
          </span>
        ) : (
          <span className="ledger__mono" data-testid="ledger-context">
            {model.caption}
          </span>
        )}
        {grid ? <RoomMenu variant={menuVariant(variant)} onAction={onAction} /> : null}
      </span>
    </div>
  );

  return (
    <section className="ledger" data-testid="ledger" data-variant={variant} data-grid={grid || undefined} aria-label={LEDGER}>
      {grid ? (
        <div className="ledger__head" data-testid="ledger-head">
          {caption}
          {/* The state's line: territory (or the verdict), whose second line a notice takes while it shows. */}
          <div className="ledger__state-line" data-testid="ledger-state-line">
            {review ? (
              <div className="ledger__review-controls">{latestNotice ?? review.controls}</div>
            ) : model.verdict ? (
              <div className="ledger__verdict" data-testid="verdict" aria-live="assertive">
                <div className="ledger__verdict-line">{model.verdict.scoreLine}</div>
                {latestNotice ?? <div className="ledger__mono" data-testid="ledger-verdict-detail">{gridDetail(model.verdict)}</div>}
              </div>
            ) : (
              <>
                {territoryBar}
                {latestNotice ?? territoryNumbers}
              </>
            )}
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

      {/* On the grid the scoreboard's rows carry the totals, so the rows end level with the field. */}
      {grid ? rows10 : null}

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
          {offerOf(collapsedLive) ? (
            <button type="button" className="action-secondary ledger__live-offer" data-testid="ledger-live-offer" onClick={() => onAction(offerOf(collapsedLive)!.action)}>
              {offerOf(collapsedLive)!.label}
            </button>
          ) : null}
          {phoneCall}
          <div className="ledger__territory-block">{territoryBlock}</div>
          <LedgerSheet open={sheetOpen} onClose={closeSheet}>
            {showsTable ? table : body}
            {sheetNotices}
            <LedgerFoot variant={menuVariant(variant)} actions={footActions} onAction={onAction} menu={false} />
          </LedgerSheet>
          {/* Pinned to the bottom edge with the safe area, always visible (spec 068 FR-015). */}
          <div className="ledger__phone-foot" data-testid="ledger-phone-foot" data-field-safe>
            <RoomMenu variant={menuVariant(variant)} onAction={onAction} />
            {phoneFootEnd(variant, review, footActions, { language: LANGUAGE_WORDS, result: RESULT.replace(/ ▸$/, "") }, onAction)}
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

          {grid ? null : noticeLines}

          {/* On the grid the ⋯ and the final state's actions live in the caption. */}
          {grid ? null : <LedgerFoot variant={menuVariant(variant)} actions={footActions} onAction={onAction} />}
        </>
      )}
    </section>
  );
}
