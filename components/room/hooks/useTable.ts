"use client";

import { useEffect, useRef, useState } from "react";

import type { Copy } from "@/lib/i18n/copy/types";
import type { ScoreboardTable } from "@/lib/room/scoreboard";
import type { MatchState, PlayerSlot } from "@/lib/types/match";

/** A beat past the table's deadline, so the server's lazy void has run when we read (spec 069 SC-005). */
const DEADLINE_READ_SLACK_MS = 150;

function keysOf(viewerSlot: PlayerSlot) {
  return viewerSlot === "player_a" ? { you: "a", opp: "b", youKey: "playerA", oppKey: "playerB" } as const : { you: "b", opp: "a", youKey: "playerB", oppKey: "playerA" } as const;
}

/** Who has sat down, and at a void, why there was none (spec 069 C1, C3). */
export function tableFacts(match: MatchState, viewerSlot: PlayerSlot): ScoreboardTable {
  const k = keysOf(viewerSlot);
  const { table } = match;
  const youId = match.players[k.youKey].playerId;
  const oppId = match.players[k.oppKey].playerId;
  const youSeated = table.seats[k.you] !== null;
  const oppVoid = table.voidedBy === oppId ? (table.voidReason === "left" ? "left" : "notSeated") : null;
  const youRequeued = table.voidReason !== null && table.origin === "queue" && youSeated && table.voidedBy !== youId;
  return { youSeated, oppSeated: table.seats[k.opp] !== null, oppVoid, youRequeued };
}

/** The opponent sitting down is said politely, once (spec 069 FR-030). */
export function useSeatAnnouncement(match: MatchState, viewerSlot: PlayerSlot, opponentName: string, copy: Copy): string | null {
  const oppSeated = match.state === "pending" && match.table.seats[keysOf(viewerSlot).opp] !== null;
  const was = useRef(oppSeated);
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (oppSeated && !was.current) setLine(`${opponentName} · ${copy.table.READY}`);
    was.current = oppSeated;
  }, [oppSeated, opponentName, copy]);
  return line;
}

/** When the time to sit down runs out, read the table once: the loader voids it then (spec 069 SC-005). */
export function useTableDeadlineRead(match: MatchState, serverDrift: number, refresh: () => void): void {
  const deadline = match.state === "pending" ? match.table.deadlineAt : null;
  useEffect(() => {
    if (!deadline) return;
    const wait = Math.max(0, Date.parse(deadline) - (Date.now() + serverDrift)) + DEADLINE_READ_SLACK_MS;
    const timer = setTimeout(refresh, wait);
    return () => clearTimeout(timer);
  }, [deadline, serverDrift, refresh]);
}

/**
 * Back from the table or the count leaves it (spec 069 FR-019, game flow T28):
 * one guard entry is pushed while the match has not gone, and popping it calls
 * `onLeave`. After go the guard is inert; Back in a live match is a later stage's.
 */
export function useTableBackGuard(beforeGo: boolean, onLeave: () => void): void {
  const armed = useRef(beforeGo);
  const leave = useRef(onLeave);
  useEffect(() => {
    armed.current = beforeGo;
    leave.current = onLeave;
  }, [beforeGo, onLeave]);
  const pushed = useRef(false);
  useEffect(() => {
    if (!beforeGo || pushed.current) return;
    pushed.current = true;
    window.history.pushState({ kind: "table-guard" }, "");
  }, [beforeGo]);
  useEffect(() => {
    const onPop = () => {
      if (armed.current) leave.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
