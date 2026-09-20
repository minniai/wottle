import type { Metadata } from "next";
import Link from "next/link";

import { RulesFigure } from "@/components/rules/RulesFigure";
import { ScoringTable } from "@/components/rules/ScoringTable";
import { PLAY_RANKED, WORDMARK } from "@/lib/constants/copy";
import { TOTAL_ROUNDS } from "@/lib/room/ledgerRows";
import { formatClock, MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";
import "@/app/styles/rules.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "how to play · wottle",
  description: "Two players, one field, ten rounds. How a Wottle match is played and scored.",
};

const BACK = "back to the lobby ▸";

/**
 * The rules, outside the room (spec 048 US5): six sections, three figures in the
 * field's grammar, the scoring table. Static; reads no session and mounts no store.
 */
export default function RulesPage() {
  const clock = formatClock(MATCH_CLOCK_BUDGET_MS);
  return (
    <main className="rules" data-testid="rules-page">
      <header className="rules__header">
        <Link href="/" className="rules__wordmark">{WORDMARK}</Link>
        <Link href="/lobby" className="action-secondary" data-testid="rules-back-top">{BACK}</Link>
      </header>

      <div className="rules__lede">
        <span className="rules__label">how to play</span>
        <h1 className="rules__title">Two players, one field, ten rounds.</h1>
        <p>
          Wottle is a word duel on a 10×10 field of Icelandic letters. Both players move at the same time. The one who reads
          the field better, and spends the clock better, wins.
        </p>
      </div>

      <section className="rules__section" id="the-round">
        <div>
          <span className="rules__label">1 · the round</span>
          <h2>Swap two letters.</h2>
          <p>
            Tap one letter, then another. They trade places. That is your whole move for the round, and your opponent makes
            theirs at the same time. The round resolves when both have played, or when a clock runs out.
          </p>
          <p>You cannot move a frozen letter. If both players pick the same letter, the swap that arrived first is the one that stands.</p>
        </div>
        <RulesFigure kind="swap" caption="two letters, pinned: your move for the round" />
      </section>

      <section className="rules__section" id="words">
        <div>
          <span className="rules__label">2 · words</span>
          <h2>Three letters or more, in a straight line.</h2>
          <p>
            After both swaps land, the field is read across and down from the letters that moved. Every new run of three or
            more letters that is an Icelandic word scores for the player whose swap made it. Every inflected form counts.
          </p>
          <p>A word is drawn as a band in the scorer&apos;s ink, with a chevron at the end where reading begins.</p>
        </div>
        <RulesFigure kind="words" caption="BORÐ read across, GILT read down; the chevron marks where each begins" />
      </section>

      <section className="rules__section" id="freezing">
        <div>
          <span className="rules__label">3 · freezing</span>
          <h2>Scored letters freeze in your ink.</h2>
          <p>
            Every letter of a scored word freezes. Frozen letters cannot be swapped again by anyone, so each word you score
            also takes ground from your opponent. A letter shared by both players&apos; words is drawn in ink.
          </p>
          <p>The field always keeps at least 24 free letters.</p>
        </div>
        <RulesFigure kind="crossing" caption="LEK crosses GILT; the shared L belongs to both" />
      </section>

      <section className="rules__section" id="scoring">
        <div>
          <span className="rules__label">4 · scoring</span>
          <h2>Values and length.</h2>
          <ScoringTable />
          <p>Your total is written in your bar and counts up as each band lands.</p>
        </div>
      </section>

      <section className="rules__section" id="the-clock">
        <div>
          <span className="rules__label">5 · the clock</span>
          <h2>Five minutes for the whole match.</h2>
          <p>
            Each player has one clock of {clock} for all {TOTAL_ROUNDS} rounds. It runs while it is your move and stops when
            you play. Under 1:00 the lane in your bar thickens and blinks. When it reaches 0:00 the rest of your rounds pass
            without a swap.
          </p>
          <p>Rounds are counted on the rail at the top of the ledger. Ten squares; the current one is framed.</p>
        </div>
      </section>

      <section className="rules__section" id="winning">
        <div>
          <span className="rules__label">6 · winning</span>
          <h2>Most points after ten rounds.</h2>
          <p>
            The higher total wins. On a tie, the player holding more frozen letters wins. Every match is rated: your rating
            moves the moment the match ends, and both new ratings are written on the result.
          </p>
        </div>
      </section>

      <footer className="rules__footer">
        <Link href="/lobby" className="action-primary" data-testid="rules-play">{PLAY_RANKED}</Link>
        <Link href="/lobby" className="action-secondary" data-testid="rules-back-bottom">{BACK}</Link>
      </footer>
    </main>
  );
}
