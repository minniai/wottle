"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Copy } from "@/lib/i18n/copy/types";
import { formatClock } from "@/lib/room/clock";
import type { MoveResolution } from "@/lib/types/match";

export interface AnnouncementsInput {
  /** The latest resolution that arrived live (never one read from a snapshot). */
  liveResolution: MoveResolution | null;
  opponentId: string;
  opponentName: string;
  opponentSlot: "playerA" | "playerB";
  /** The viewer's own reveal is drawing: their beat is said first. */
  revealingOwn: boolean;
  clockMs: number;
  copy: Copy;
}

/** At most one line per 1.5s; the newest waiting line wins (research R10). */
const RATE_MS = 1_500;
/** The clock marks said once each as the clock crosses them (spec 068 FR-010). */
const CLOCK_MARKS = [60_000, 15_000];

function lineFor(r: MoveResolution, name: string, slot: AnnouncementsInput["opponentSlot"], copy: Copy): string {
  return copy.oppAnnouncement(name, r.words.map((w) => w.word.toLocaleUpperCase()), r.delta, r.movesPlayed[slot]);
}

/**
 * What the room's polite region says (spec 068 FR-033, FR-010): each opponent
 * move once, only as it arrives live and after the viewer's own beat, keyed by
 * receipt sequence so a poll or a reload never replays one; and 1:00 and 0:15
 * once each as the clock crosses them.
 */
export function useAnnouncements(input: AnnouncementsInput): string {
  const { liveResolution, opponentId, opponentName, opponentSlot, revealingOwn, clockMs, copy } = input;
  const [line, setLine] = useState("");
  // What was already on the board at mount is never said; the floor holds only within that match.
  const floor = useRef({ matchId: liveResolution?.matchId ?? null, seq: liveResolution?.globalSeq ?? 0 });
  const said = useRef(new Set<string>());
  const lastAt = useRef(Number.NEGATIVE_INFINITY);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousClock = useRef(clockMs);

  const say = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    const wait = lastAt.current + RATE_MS - Date.now();
    const speak = () => {
      lastAt.current = Date.now();
      setLine(next);
    };
    if (wait <= 0) speak();
    else timer.current = setTimeout(speak, wait);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  useEffect(() => {
    const r = liveResolution;
    if (!r || r.playerId !== opponentId || r.status !== "resolved" || revealingOwn) return;
    if ((r.matchId === floor.current.matchId && r.globalSeq <= floor.current.seq) || said.current.has(`${r.matchId}:${r.globalSeq}`)) return;
    said.current.add(`${r.matchId}:${r.globalSeq}`);
    say(lineFor(r, opponentName, opponentSlot, copy));
  }, [liveResolution, opponentId, opponentName, opponentSlot, revealingOwn, copy, say]);

  useEffect(() => {
    const before = previousClock.current;
    previousClock.current = clockMs;
    const crossed = CLOCK_MARKS.filter((mark) => before >= mark && clockMs < mark);
    if (crossed.length > 0) say(copy.clockMarkLeft(formatClock(crossed[crossed.length - 1])));
  }, [clockMs, copy, say]);

  return line;
}
