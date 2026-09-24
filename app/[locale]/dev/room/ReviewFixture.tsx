"use client";

import { MatchRoomView } from "@/components/room/MatchRoomView";
import { ReviewControls } from "@/components/room/ReviewControls";
import { RoomShell } from "@/components/room/RoomShell";
import { Field } from "@/components/room/Field";
import { useCopy } from "@/components/i18n/LocaleProvider";
import { cursorLines } from "@/lib/review/cursorLines";
import { cursorRow, ledgerCellStates } from "@/lib/review/ledgerCells";
import { scrubberValueText } from "@/lib/review/scrubber";
import { wordsAtStep } from "@/lib/review/wordsAtStep";
import { bandsFromWords } from "@/lib/room/bandGeometry";
import type { Notice } from "@/lib/room/ledgerTypes";

import { BIRNA, FIXTURE_BOARD, KARI, resultVerdict, YOU_ID } from "./fixtures";
import { reviewFixtureSteps, type ReviewVariant } from "./reviewSteps";

export type ReviewPhase = "review" | "review-refused" | "review-time" | "review-public" | "rematch-in-review";

const SETUP: Record<ReviewPhase, { variant: ReviewVariant; step: number | "last"; readOnly: boolean; rematchIn: boolean }> = {
  review: { variant: "both", step: 7, readOnly: false, rematchIn: false },
  "review-refused": { variant: "refused", step: 9, readOnly: false, rematchIn: false },
  "review-time": { variant: "time", step: "last", readOnly: false, rematchIn: false },
  "review-public": { variant: "both", step: 7, readOnly: true, rematchIn: false },
  "rematch-in-review": { variant: "both", step: 7, readOnly: false, rematchIn: true },
};

const NO_OP = () => undefined;
const NAMES = { a: BIRNA.displayName, b: KARI.displayName };

/** Spec 071 (T058): review at a step from static steps, as the controller composes it. */
export function ReviewFixture({ phase }: { phase: ReviewPhase }) {
  const copy = useCopy();
  const setup = SETUP[phase];
  const steps = reviewFixtureSteps(setup.variant);
  const step = steps[(setup.step === "last" ? steps.length : setup.step) - 1];
  const all = wordsAtStep(steps, steps.length).words;
  const at = wordsAtStep(steps, step.index);
  const bands = bandsFromWords({ words: at.words, board: FIXTURE_BOARD, frozenTiles: step.frozen, viewerSlot: "player_a", playerAId: YOU_ID, liveMoveKey: at.liveMoveKey, trustMoveKey: at.liveMoveKey });
  const last = steps[steps.length - 1];
  const notices: Notice[] = setup.rematchIn ? [{ kind: "rematch", text: copy.rematch.asks(KARI.displayName, "0:24"), drain: 0.8 }] : [];
  const ticks = step.swap && step.slot ? [step.swap.from, step.swap.to].map((c) => ({ at: c, seat: step.slot === "player_a" ? ("you" as const) : ("opp" as const), name: step.slot === "player_a" ? BIRNA.displayName : KARI.displayName })) : [];
  return (
    <RoomShell viewer={BIRNA}>
      <MatchRoomView
        matchId="fixture-match"
        viewerSlot="player_a"
        you={{ name: BIRNA.displayName, rating: BIRNA.eloRating ?? null, movesPlayed: step.movesPlayed.a, score: step.totals.a, finalLine: "" }}
        opp={{ name: KARI.displayName, rating: KARI.eloRating ?? null, movesPlayed: step.movesPlayed.b, score: step.totals.b, finalLine: "" }}
        clockMs={8_000}
        clockLengthMs={300_000}
        elapsedMs={292_000}
        moveLimit={10}
        penalizeUnplayed={setup.variant === "time"}
        completed
        words={all}
        playerAId={YOU_ID}
        frozenTiles={step.frozen}
        live={{ kind: "idle" }}
        verdict={resultVerdict("result-moves", copy)}
        caption={copy.review.caption("4:52")}
        readOnly={setup.readOnly}
        hint={setup.readOnly ? copy.review.overLine(NAMES.a, NAMES.b) : undefined}
        notices={notices}
        footActions={
          setup.readOnly ? (
            <button type="button" className="action-primary" data-testid="ledger-lobby">{copy.ENTER_LOBBY}</button>
          ) : (
            <>
              <button type="button" className="action-secondary" data-testid="review-result">◂ {copy.RESULT.replace(/ ▸$/, "")}</button>
              <button type="button" className="action-primary" data-testid="review-primary-rematch">{copy.REMATCH}</button>
            </>
          )
        }
        review={{
          scoreboard: { step: step.index, stepCount: steps.length, clockMs: step.clockMs, valueText: scrubberValueText(step, steps.length, NAMES, copy) },
          ledger: {
            viewerSlot: "player_a",
            current: cursorRow(step, 10),
            cursor: cursorLines(step, NAMES, copy),
            states: ledgerCellStates(steps, step.index),
            names: NAMES,
            controls: <ReviewControls step={step.index} stepCount={steps.length} playing={false} onControl={NO_OP} />,
            phoneControls: <ReviewControls step={step.index} stepCount={steps.length} playing={false} onControl={NO_OP} compact />,
            onJump: NO_OP,
          },
          onStep: NO_OP,
          onTogglePlay: NO_OP,
          finalMoves: { you: last.movesPlayed.a, opp: last.movesPlayed.b },
        }}
        onAction={NO_OP}
      >
        <Field language="is" board={FIXTURE_BOARD} frozenTiles={step.frozen} viewerSlot="player_a" ownerNames={{ player_a: BIRNA.displayName, player_b: KARI.displayName }} bands={bands} disabled turnFrame={null} onActivate={NO_OP} ticks={ticks} />
      </MatchRoomView>
    </RoomShell>
  );
}
