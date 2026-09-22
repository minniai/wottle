import { RulesFigure } from "@/components/rules/RulesFigure";
import { ScoringTable } from "@/components/rules/ScoringTable";

import type { RulesContentProps } from "./types";

/** The rules in English (spec 048 US5): six sections, three figures, the scoring table. */
export function RulesEn({ clock, totalMoves, copy }: RulesContentProps) {
  return (
    <>
      <div className="rules__lede">
        <span className="rules__label">how to play</span>
        <h1 className="rules__title">Two players, one field, ten moves each.</h1>
        <p>
          Wottle is a word duel on a 10×10 field of letters. Both players move whenever they like, on one clock.
          The one who reads the field better, and spends the clock better, wins.
        </p>
      </div>

      <section className="rules__section" id="the-move">
        <div>
          <span className="rules__label">1 · the move</span>
          <h2>Swap two letters.</h2>
          <p>
            Tap one letter, then another. They trade places. That is one move; you have ten, and you make them whenever you
            like. Each move is scored the moment it lands, and your next one opens as soon as you have seen the score.
          </p>
          <p>
            You cannot move a frozen letter. Moves are resolved in the order they reach the server. If your opponent
            froze or moved one of your two letters just before yours arrived, your move is refused and you pick again;
            it does not count as one of your ten.
          </p>
        </div>
        <RulesFigure kind="swap" caption="two letters exchanged: one move of your ten" />
      </section>

      <section className="rules__section" id="words">
        <div>
          <span className="rules__label">2 · words</span>
          <h2>Three letters or more, in a straight line.</h2>
          <p>
            After each swap lands, the field is read across and down from the two letters that moved. Every new run of three
            or more letters that is an English word scores for the player whose swap made it. Every form of a word
            counts, and a word scores again if you form it somewhere new.
          </p>
          <p>A word is drawn as a band in the scorer&apos;s ink, with a chevron at the end where reading begins.</p>
        </div>
        <RulesFigure kind="words" caption="WORD read across, GAME read down; the chevron marks where each begins" />
      </section>

      <section className="rules__section" id="freezing">
        <div>
          <span className="rules__label">3 · freezing</span>
          <h2>Scored letters freeze in your ink.</h2>
          <p>
            Every letter of a scored word freezes. Frozen letters cannot be swapped again by anyone, so each word you score
            also takes ground from your opponent. Where a word crosses one already scored, the crossing letter keeps
            the colour of the player who froze it first.
          </p>
          <p>The field always keeps at least 24 free letters.</p>
        </div>
        <RulesFigure kind="crossing" caption="MEN crosses GAME; the M stays the opponent's" />
      </section>

      <section className="rules__section" id="scoring">
        <div>
          <span className="rules__label">4 · scoring</span>
          <h2>Values and length.</h2>
          <ScoringTable copy={copy} />
          <p>Your total is written in your bar and counts up as each band lands.</p>
        </div>
      </section>

      <section className="rules__section" id="the-clock">
        <div>
          <span className="rules__label">5 · the clock</span>
          <h2>Five minutes for the whole match.</h2>
          <p>
            One clock of {clock} for both players, at the top of the ledger. It starts when the match starts and never
            pauses, not while you wait for a score and not while anyone is away. Under 1:00 it blinks. A move that reaches
            the server before 0:00 counts, even if its score lands after.
          </p>
          <p>
            Your bar counts down your {totalMoves} moves: ten marks along its edge, one emptied for each move
            played. Your opponent&apos;s bar counts theirs.
          </p>
        </div>
      </section>

      <section className="rules__section" id="winning">
        <div>
          <span className="rules__label">6 · winning</span>
          <h2>Most points wins.</h2>
          <p>
            The match ends when both players have made all ten moves, or when the clock runs out. If the clock runs out
            first, each move you have not made counts as a move with no word and costs up to −5. Then the higher total wins; on a tie, the player holding more
            frozen letters wins; a full tie is a draw. A total never falls below zero: at 3 points, a move with no word costs −3. Every match is rated: your rating
            moves the moment the match ends, and both new ratings are written on the result.
          </p>
        </div>
      </section>

    </>
  );
}
