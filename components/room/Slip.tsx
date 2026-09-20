"use client";

import { useId, useRef, type ReactNode } from "react";

import { useFocusTrap } from "@/lib/a11y/useFocusTrap";
import {
  ACCEPT,
  CLAIM_THE_WIN,
  DECLINE,
  DRAW,
  KEEP_PLAYING,
  KEEP_WAITING,
  LOBBY,
  matchOverLabel,
  NEW_OPPONENT,
  NEW_HERE_HOW_TO_PLAY,
  NO_ACCOUNT_NEEDED,
  RECONNECT_SPENT,
  REMATCH,
  rematchRequest,
  resignConsequence,
  resignLabel,
  RESIGN_QUESTION,
  REVIEW_FIELD,
  roundContext,
  TAGLINE,
  waitingForRematch,
  winsHeadline,
  WORDMARK,
  YES_RESIGN,
  isGone,
} from "@/lib/constants/copy";
import { formatClock } from "@/lib/room/clock";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import type { SlipState } from "@/lib/room/slip";
import type { PlayerIdentity } from "@/lib/types/match";
import { NameInput } from "./NameInput";

export interface SlipProps {
  slip: SlipState;
  onAction: (action: LedgerAction) => void;
  onSignedIn?: (player: PlayerIdentity) => void;
}

/** Escape maps to each kind's cancel; the sign-in slip has none (contracts/slip.md). */
function cancelActionFor(slip: SlipState): LedgerAction | null {
  switch (slip.kind) {
    case "resign":
      return "keepPlaying";
    case "claimWin":
      return "keepWaiting";
    case "matchOver":
      return "reviewField";
    default:
      return null;
  }
}

function Primary({ label, action, testId, onAction }: { label: string; action: LedgerAction; testId: string; onAction: (a: LedgerAction) => void }) {
  return (
    <button type="button" className="action-primary" data-testid={testId} data-slip-primary onClick={() => onAction(action)}>
      {label}
    </button>
  );
}

function Secondary({ label, action, testId, onAction }: { label: string; action: LedgerAction; testId: string; onAction: (a: LedgerAction) => void }) {
  return (
    <button type="button" className="action-secondary" data-testid={testId} onClick={() => onAction(action)}>
      {label}
    </button>
  );
}

function SignInBody({ onSignedIn }: { onSignedIn?: (player: PlayerIdentity) => void }) {
  return (
    <>
      <span className="slip__wordmark">{WORDMARK}</span>
      <span className="slip__label">{TAGLINE}</span>
      <div className="slip__rule" />
      <NameInput onSignedIn={onSignedIn ?? (() => undefined)} />
      <span className="slip__label">{NO_ACCOUNT_NEEDED}</span>
      <a className="action-secondary" href="/rules" data-testid="slip-how-to-play">
        {NEW_HERE_HOW_TO_PLAY}
      </a>
    </>
  );
}

function ResignBody({ slip, onAction, headlineId }: { slip: Extract<SlipState, { kind: "resign" }>; onAction: (a: LedgerAction) => void; headlineId: string }) {
  return (
    <>
      <div role="status" aria-live="assertive" className="slip__head">
        <span className="slip__label">{resignLabel(slip.round, formatClock(slip.clockMs))}</span>
        <h2 id={headlineId} className="slip__headline">{RESIGN_QUESTION}</h2>
        <span className="slip__label">{resignConsequence(slip.opponentName)}</span>
      </div>
      <div className="slip__rule" />
      <div className="slip__actions">
        <Primary label={YES_RESIGN} action="confirmResign" testId="slip-confirm-resign" onAction={onAction} />
        <Secondary label={KEEP_PLAYING} action="keepPlaying" testId="slip-keep-playing" onAction={onAction} />
      </div>
    </>
  );
}

function ClaimWinBody({ slip, onAction, headlineId }: { slip: Extract<SlipState, { kind: "claimWin" }>; onAction: (a: LedgerAction) => void; headlineId: string }) {
  return (
    <>
      <div role="status" aria-live="assertive" className="slip__head">
        <span className="slip__label">{roundContext(slip.round)}</span>
        <h2 id={headlineId} className="slip__headline">{isGone(slip.opponentName)}</h2>
        <span className="slip__label">{RECONNECT_SPENT}</span>
      </div>
      <div className="slip__rule" />
      <div className="slip__actions">
        <Primary label={CLAIM_THE_WIN} action="claimWin" testId="slip-claim-win" onAction={onAction} />
        <Secondary label={KEEP_WAITING} action="keepWaiting" testId="slip-keep-waiting" onAction={onAction} />
      </div>
    </>
  );
}

function MatchOverActions({ slip, onAction }: { slip: Extract<SlipState, { kind: "matchOver" }>; onAction: (a: LedgerAction) => void }) {
  if (slip.readOnly) return <Secondary label={LOBBY} action="lobby" testId="slip-lobby" onAction={onAction} />;
  if (slip.rematch === "incoming") {
    return (
      <div className="slip__actions" data-testid="slip-rematch-incoming">
        <span className="slip__label">{rematchRequest(slip.opponentName)}</span>
        <Primary label={ACCEPT} action="acceptRematch" testId="slip-accept-rematch" onAction={onAction} />
        <Secondary label={DECLINE} action="declineRematch" testId="slip-decline-rematch" onAction={onAction} />
      </div>
    );
  }
  if (slip.rematch === "waiting" || slip.rematch === "requesting") {
    return <span className="slip__label" data-testid="slip-rematch-waiting">{waitingForRematch(slip.opponentName)}</span>;
  }
  return (
    <>
      <div className="slip__actions">
        <Primary label={REMATCH} action="rematch" testId="slip-rematch" onAction={onAction} />
        <Secondary label={NEW_OPPONENT} action="newOpponent" testId="slip-new-opponent" onAction={onAction} />
        <Secondary label={REVIEW_FIELD} action="reviewField" testId="slip-review-field" onAction={onAction} />
      </div>
      <Secondary label={LOBBY} action="lobby" testId="slip-lobby" onAction={onAction} />
    </>
  );
}

function MatchOverBody({ slip, onAction, headlineId }: { slip: Extract<SlipState, { kind: "matchOver" }>; onAction: (a: LedgerAction) => void; headlineId: string }) {
  const winner = slip.verdict.winnerSeat;
  const headline = winner === null ? DRAW : winsHeadline(winner === "you" ? slip.viewerName : slip.opponentName);
  const first = winner === "opp" ? "opp" : "you";
  const second = first === "you" ? "opp" : "you";
  return (
    <>
      <div role="status" aria-live="assertive" className="slip__head">
        <span className="slip__label">{matchOverLabel(slip.rounds, slip.durationMmSs)}</span>
        <h2 id={headlineId} className="slip__headline" data-seat={winner ?? undefined}>{headline}</h2>
        <span className="slip__score" data-testid="slip-score">
          <span data-seat={first}>{slip.scores[first]}</span> – <span data-seat={second}>{slip.scores[second]}</span>
        </span>
        <span className="slip__label">{slip.verdict.detailLine}</span>
      </div>
      <div className="slip__rule" />
      <div className="slip__ratings" data-testid="slip-ratings">
        {slip.ratings.map((row) => (
          <div key={row.seat} className="slip__rating" data-seat={row.seat}>
            <span className="slip__square" data-seat={row.seat} />
            <span className="slip__name">{row.name}</span>
            <span className="slip__mono">{row.line}</span>
          </div>
        ))}
      </div>
      <div className="slip__rule" />
      <MatchOverActions slip={slip} onAction={onAction} />
    </>
  );
}

function bodyFor(slip: SlipState, onAction: (a: LedgerAction) => void, onSignedIn: SlipProps["onSignedIn"], headlineId: string): ReactNode {
  switch (slip.kind) {
    case "signIn":
      return <SignInBody onSignedIn={onSignedIn} />;
    case "resign":
      return <ResignBody slip={slip} onAction={onAction} headlineId={headlineId} />;
    case "claimWin":
      return <ClaimWinBody slip={slip} onAction={onAction} headlineId={headlineId} />;
    case "matchOver":
      return <MatchOverBody slip={slip} onAction={onAction} headlineId={headlineId} />;
  }
}

/**
 * The slip (design system §5.9): a paper panel with a 1.5px ink frame laid over
 * the field, the one overlay the room permits. Focus is trapped inside it, the
 * headline is announced once, and Escape is the kind's cancel.
 */
export function Slip({ slip, onAction, onSignedIn }: SlipProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const headlineId = useId();
  const cancel = cancelActionFor(slip);
  useFocusTrap({ isActive: true, containerRef: ref, onEscape: cancel ? () => onAction(cancel) : undefined });

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={slip.kind === "signIn" ? undefined : headlineId}
      aria-label={slip.kind === "signIn" ? WORDMARK : undefined}
      className="slip"
      data-testid="slip"
      data-kind={slip.kind}
      data-field-safe
    >
      {bodyFor(slip, onAction, onSignedIn, headlineId)}
    </div>
  );
}
