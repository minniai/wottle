"use client";

import Link from "next/link";

import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { formatClock } from "@/lib/room/clock";
import type { LastMatch as LastMatchFacts } from "@/lib/types/standing";

import { BandMap } from "./BandMap";
import { whenWord } from "./when";

interface LastMatchProps {
  last: LastMatchFacts;
  viewerName: string;
  nowMs: number;
}

/**
 * The verdict in its seat colours (B1): your name and score in `--you`, theirs
 * in `--opp-text`. The line is written by the copy; only the parts are coloured.
 */
function Verdict({ line, winner, youWon, you, them }: { line: string; winner: string; youWon: boolean; you: number; them: number }) {
  const [before, rest] = [line.slice(0, line.indexOf(winner) + winner.length), line.slice(line.indexOf(winner) + winner.length)];
  const scores = rest.match(/(\d+)–(\d+)/);
  if (!scores || scores.index === undefined) return <>{line}</>;
  const middle = rest.slice(0, scores.index);
  const [first, second] = youWon ? ["seat-you", "seat-opp-text"] : ["seat-opp-text", "seat-you"];
  return (
    <>
      <span className={youWon ? "seat-you" : "seat-opp"}>{before}</span>
      {middle}
      <span className={first}>{youWon ? you : them}</span>–<span className={second}>{youWon ? them : you}</span>
      {rest.slice(scores.index + scores[0].length)}
    </>
  );
}

/** Your last match (game flow B1): the band map in one link to its review, the verdict, and who, how long, when. */
export function LastMatch({ last, viewerName, nowMs }: LastMatchProps) {
  const copy = useCopy();
  const locale = useLocale();
  const to = useLocalePath();
  const when = whenWord(last.completedAt, nowMs, copy, locale.htmlLang);
  const href = to(`/match/${last.matchId}?review=last`);
  const winner = last.youWon === null ? null : last.youWon ? viewerName : last.opponent;
  const [first, second] = last.youWon === false ? [last.them, last.you] : [last.you, last.them];
  return (
    <section className="last-match" aria-labelledby="last-match-label">
      <h2 id="last-match-label" className="page-caption">{copy.pages.LAST_MATCH}</h2>
      <Link href={href} className="last-match__map" aria-label={copy.pages.REVIEW_LAST}>
        <BandMap bands={last.bands} label={copy.pages.bandMapAria(viewerName, last.you, last.opponent, last.them, when)} />
      </Link>
      <p className="last-match__verdict" data-testid="last-match-verdict">
        {winner === null ? copy.pages.drawLine(last.you, last.them) : <Verdict line={copy.pages.winsLine(winner, first, second)} winner={winner} youWon={Boolean(last.youWon)} you={last.you} them={last.them} />}
      </p>
      <p className="last-match__detail">
        <span className="page-label">{copy.pages.lastMatchDetail(last.opponent, last.durationMs ? formatClock(last.durationMs) : "", when)}</span>
        <Link href={href} className="page-link page-link--ink">{copy.pages.REVIEW}</Link>
      </p>
    </section>
  );
}
