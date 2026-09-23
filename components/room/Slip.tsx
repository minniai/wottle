"use client";

import { useId, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";

import { enterAsReturningAction } from "@/app/actions/auth/enterAsReturning";

import { useLocalePath } from "@/components/i18n/LocaleProvider";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";
import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import { formatClock } from "@/lib/room/clock";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import type { SlipState } from "@/lib/room/slip";
import type { ReturningPlayer } from "@/lib/types/lobby";
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
    case "endEarly":
      return "keepWaiting";
    case "matchOver":
      return "reviewField";
    default:
      return null;
  }
}

/** A control that has just appeared ignores activation for 500ms (game flow §5.0 guards). */
const GUARD_MS = 500;

function Primary({ label, action, testId, onAction, guarded = false }: { label: string; action: LedgerAction; testId: string; onAction: (a: LedgerAction) => void; guarded?: boolean }) {
  const shownAt = useRef(Date.now());
  const activate = () => {
    if (guarded && Date.now() - shownAt.current < GUARD_MS) return;
    onAction(action);
  };
  return (
    <button type="button" className="action-primary" data-testid={testId} data-slip-primary onClick={activate}>
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

/** After a sign-out the door greets this browser's player by name (spec 067 US3, DoorReturning). */
function ReturningBody({ returning, onSignedIn, onAnotherName }: { returning: ReturningPlayer; onSignedIn: (player: PlayerIdentity) => void; onAnotherName: () => void }) {
  const { ENTER_LOBBY, errors, notYou, returningLine, WELCOME_BACK } = useCopy();
  const { language } = useLocale();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const enter = () =>
    startTransition(async () => {
      const result = await enterAsReturningAction(language);
      if (result.status === "success" && result.player) onSignedIn(result.player);
      else setFailed(true);
    });
  return (
    <>
      <span className="slip__label">{WELCOME_BACK}</span>
      <div className="slip__rating" data-seat="you">
        <span className="slip__square" data-seat="you" />
        <span className="slip__name" data-testid="slip-returning-name">{returning.displayName}</span>
        <span className="slip__mono" data-testid="slip-returning-line">{returningLine(returning.rating)}</span>
      </div>
      <button type="button" className="action-primary" data-testid="slip-enter-returning" data-slip-primary disabled={pending} onClick={enter}>
        {ENTER_LOBBY}
      </button>
      {failed ? (
        <span className="ledger__mono name-input__error" role="alert">
          {errors.login_failed}
        </span>
      ) : null}
      <button type="button" className="action-secondary" data-testid="slip-use-another-name" onClick={onAnotherName}>
        {notYou(returning.displayName)}
      </button>
    </>
  );
}

function SignInBody({ onSignedIn }: { onSignedIn?: (player: PlayerIdentity) => void }) {
  const { NEW_HERE_HOW_TO_PLAY, NO_ACCOUNT_NEEDED, TAGLINE, THIS_BROWSER_KEEPS_YOUR_NAME, WORDMARK } = useCopy();
  const to = useLocalePath();
  const returning = useRoomStore((s) => s.returning);
  const [anotherName, setAnotherName] = useState(false);
  const signedIn = onSignedIn ?? (() => undefined);
  return (
    <>
      <span className="slip__wordmark">{WORDMARK}</span>
      <span className="slip__label">{TAGLINE}</span>
      <div className="slip__rule" />
      {returning && !anotherName ? (
        <ReturningBody returning={returning} onSignedIn={signedIn} onAnotherName={() => setAnotherName(true)} />
      ) : (
        <>
          <NameInput onSignedIn={signedIn} />
          <span className="slip__label">{NO_ACCOUNT_NEEDED}</span>
          <span className="slip__label">{THIS_BROWSER_KEEPS_YOUR_NAME}</span>
        </>
      )}
      <a className="action-secondary" href={to("/rules")} data-testid="slip-how-to-play">
        {NEW_HERE_HOW_TO_PLAY}
      </a>
    </>
  );
}

function ResignBody({ slip, onAction, headlineId }: { slip: Extract<SlipState, { kind: "resign" }>; onAction: (a: LedgerAction) => void; headlineId: string }) {
  const { KEEP_PLAYING, resignConsequence, resignLabel, RESIGN_QUESTION, YES_RESIGN } = useCopy();
  return (
    <>
      <div role="status" aria-live="assertive" className="slip__head">
        <span className="slip__label">{resignLabel(slip.move, formatClock(slip.clockMs))}</span>
        <h2 id={headlineId} className="slip__headline">{RESIGN_QUESTION}</h2>
        <span className="slip__label">{resignConsequence(slip.opponentName)}</span>
      </div>
      <div className="slip__rule" />
      {/* Resigning forfeits the viewer's match: the safe action leads and is focused (game flow C6, §8 item 3). */}
      <div className="slip__actions" data-stacked="true">
        <Primary label={KEEP_PLAYING} action="keepPlaying" testId="slip-keep-playing" onAction={onAction} />
        <Secondary label={YES_RESIGN} action="confirmResign" testId="slip-confirm-resign" onAction={onAction} />
      </div>
    </>
  );
}

/** Spec 050 FR-012: offered only to a player with all their moves whose opponent has been gone for the window. */
function EndEarlyBody({ slip, onAction, headlineId, headlineRef }: { slip: Extract<SlipState, { kind: "endEarly" }>; onAction: (a: LedgerAction) => void; headlineId: string; headlineRef: RefObject<HTMLHeadingElement | null> }) {
  const { END_THE_MATCH, endEarlyLabel, KEEP_WAITING, isGone, NORMAL_RULES_DECIDE } = useCopy();
  return (
    <>
      <div role="status" aria-live="assertive" className="slip__head">
        <span className="slip__label">{endEarlyLabel(formatClock(slip.clockMs))}</span>
        {/* Raised by the game, so its headline takes focus, not an action (game flow C8, §8 item 3). */}
        <h2 id={headlineId} ref={headlineRef} tabIndex={-1} className="slip__headline">{isGone(slip.opponentName)}</h2>
        <span className="slip__label">{NORMAL_RULES_DECIDE}</span>
      </div>
      <div className="slip__rule" />
      <div className="slip__actions">
        <Primary label={END_THE_MATCH} action="endEarly" testId="slip-end-early" onAction={onAction} guarded />
        <Secondary label={KEEP_WAITING} action="keepWaiting" testId="slip-keep-waiting" onAction={onAction} />
      </div>
    </>
  );
}

function MatchOverActions({ slip, onAction }: { slip: Extract<SlipState, { kind: "matchOver" }>; onAction: (a: LedgerAction) => void }) {
  const { ACCEPT, DECLINE, LOBBY, NEW_OPPONENT, REMATCH, rematchRequest, REVIEW_FIELD, waitingForRematch } = useCopy();
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
  const { DRAW, matchOverLabel, winsHeadline, points } = useCopy();
  const winner = slip.verdict.winnerSeat;
  const headline = winner === null ? DRAW : winsHeadline(winner === "you" ? slip.viewerName : slip.opponentName);
  const first = winner === "opp" ? "opp" : "you";
  const second = first === "you" ? "opp" : "you";
  return (
    <>
      <div role="status" aria-live="assertive" className="slip__head">
        <span className="slip__label">{matchOverLabel(slip.durationMmSs)}</span>
        <h2 id={headlineId} className="slip__headline" data-seat={winner ?? undefined}>{headline}</h2>
        <span className="slip__score" data-testid="slip-score">
          <span data-seat={first}>{points(slip.scores[first])}</span> – <span data-seat={second}>{points(slip.scores[second])}</span>
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

function bodyFor(slip: SlipState, onAction: (a: LedgerAction) => void, onSignedIn: SlipProps["onSignedIn"], headlineId: string, headlineRef: RefObject<HTMLHeadingElement | null>): ReactNode {
  switch (slip.kind) {
    case "signIn":
      return <SignInBody onSignedIn={onSignedIn} />;
    case "resign":
      return <ResignBody slip={slip} onAction={onAction} headlineId={headlineId} />;
    case "endEarly":
      return <EndEarlyBody slip={slip} onAction={onAction} headlineId={headlineId} headlineRef={headlineRef} />;
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
  const { WORDMARK } = useCopy();
  const ref = useRef<HTMLDivElement | null>(null);
  const headlineId = useId();
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const cancel = cancelActionFor(slip);
  useFocusTrap({ isActive: true, containerRef: ref, initialFocusRef: headlineRef, onEscape: cancel ? () => onAction(cancel) : undefined });

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
      {bodyFor(slip, onAction, onSignedIn, headlineId, headlineRef)}
    </div>
  );
}
