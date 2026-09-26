"use client";

import Link from "next/link";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { rowsAfter } from "@/lib/pages/lastMatches";
import { formatClock } from "@/lib/room/clock";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { LastMatch as LastMatchFacts } from "@/lib/types/standing";

import { BandMap } from "./BandMap";
import { RecentRows } from "./RecentMatches";
import { whenWord } from "./when";

interface LastMatchProps {
  last: LastMatchFacts;
  viewerName: string;
  nowMs: number;
  /** Your recent matches; the ones after the drawn match follow it as rows. */
  recent: RecentGameRow[];
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

/**
 * Your last matches (game flow B1, amended 2026-09-25): one list under one
 * heading. The latest is drawn as its final board in one link to its review,
 * with the verdict and who, how long, when; the next three follow as rows.
 */
export function LastMatch({ last, viewerName, nowMs, recent }: LastMatchProps) {
  const copy = useCopy();
  const to = useLocalePath();
  const when = whenWord(last.completedAt, nowMs, copy);
  const href = to(`/match/${last.matchId}?review=last`);
  const winner = last.youWon === null ? null : last.youWon ? viewerName : last.opponent;
  const [first, second] = last.youWon === false ? [last.them, last.you] : [last.you, last.them];
  return (
    <section className="last-match" aria-labelledby="last-match-label">
      <h2 id="last-match-label" className="page-caption">{copy.pages.LAST_MATCHES}</h2>
      <Link href={href} className="last-match__map" aria-label={copy.pages.REVIEW_LAST}>
        <BandMap bands={last.bands} board={last.board} label={copy.pages.bandMapAria(viewerName, last.you, last.opponent, last.them, when)} />
      </Link>
      <p className="last-match__verdict" data-testid="last-match-verdict">
        {winner === null ? copy.pages.drawLine(last.you, last.them) : <Verdict line={copy.pages.winsLine(winner, first, second)} winner={winner} youWon={Boolean(last.youWon)} you={last.you} them={last.them} />}
      </p>
      <p className="last-match__detail">
        <span className="page-label">{copy.pages.lastMatchDetail(last.opponent, last.durationMs ? formatClock(last.durationMs) : "", when)}</span>
        <Link href={href} className="page-link page-link--ink">{copy.pages.REVIEW}</Link>
      </p>
      <RecentRows games={rowsAfter(recent, last.matchId)} />
    </section>
  );
}
