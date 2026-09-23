"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { useCopy } from "@/components/i18n/LocaleProvider";
import { generateBoard } from "@/lib/game-engine/boardGenerator";
import { getLanguagePack } from "@/lib/game-engine/languagePack";
import { formatClock } from "@/lib/room/clock";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import { useMatchmaking, type MatchmakingState } from "@/lib/room/useMatchmaking";
import type { Copy } from "@/lib/i18n/copy/types";
import type { PlayerIdentity } from "@/lib/types/match";
import { Field } from "./Field";
import { QueueRoomView } from "./QueueRoomView";
import { useRoomHotkeys } from "./hooks/useRoomHotkeys";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useWakeLock } from "./hooks/useWakeLock";

export const LETTER_LAND_MS = 100;

interface SearchControls {
  resume: () => void;
  keepSearching: () => void;
  findAgain: () => void;
}

function control(label: string, testId: string, onClick: () => void, className = "action-primary") {
  return (
    <button type="button" className={className} data-testid={testId} onClick={onClick}>
      {label}
    </button>
  );
}

/** The search's lines when it is not simply searching (spec 069, game flow B7). */
function searchLines(state: MatchmakingState, copy: Copy, on: SearchControls): { name: string; subline: string; action?: ReactNode } | null {
  const { table, FINDING_OPPONENT } = copy;
  switch (state.kind) {
    case "paused":
      return { name: FINDING_OPPONENT, subline: table.SEARCH_PAUSED, action: control(table.RESUME, "queue-resume", on.resume) };
    case "stillSearching":
      return { name: table.stillSearching(formatClock(state.elapsedSeconds * 1000)), subline: "", action: control(table.KEEP_SEARCHING, "queue-keep-searching", on.keepSearching) };
    case "stopped":
      return { name: table.SEARCH_STOPPED, subline: "", action: control(table.FIND_AGAIN, "queue-find-again", on.findAgain) };
    case "cooldown":
      return { name: FINDING_OPPONENT, subline: table.findAgainIn(formatClock(state.leftMs)) };
    default:
      return null;
  }
}

interface QueueRoomControllerProps {
  viewer: PlayerIdentity;
}

/**
 * The queue as the /matchmaking page renders it: one controller per
 * search, remounted when `new opponent ▸` asks for a fresh one.
 */
export function QueueRoom({ viewer }: QueueRoomControllerProps) {
  const searchId = useRoomStore((s) => s.searchId);
  return <QueueRoomController key={searchId} viewer={viewer} />;
}

/**
 * The queue (spec 044 US8): a placeholder field sets itself letter by letter
 * while the search runs. A pairing goes to the table at the match's own
 * address, as a new page (spec 069 FR-023): Back from the table leaves it.
 */
export function QueueRoomController({ viewer }: QueueRoomControllerProps) {
  const copy = useCopy();
  const { searchingSubline, settingField } = copy;
  const router = useRouter();
  const to = useLocalePath();
  const { language } = useLocale();
  const reducedMotion = useReducedMotion();
  const phase = useRoomStore((s) => s.phase);
  const queue = useRoomStore((s) => s.queue);
  const board = useRoomStore((s) => s.board);
  const startQueue = useRoomStore((s) => s.startQueue);
  const cancelQueue = useRoomStore((s) => s.cancelQueue);
  const setBoard = useRoomStore((s) => s.setBoard);
  const setLettersLanded = useRoomStore((s) => s.setLettersLanded);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    startQueue(startedAt);
    setBoard(generateBoard({ seed: `queue:${viewer.id}:${startedAt}`, weights: getLanguagePack(language).letterWeights }));
  }, [startQueue, setBoard, viewer.id, startedAt, language]);

  const { state, cancel, resume, keepSearching } = useMatchmaking(phase === "queue", startedAt, language);
  // A phone stays awake while searching (spec 069 FR-029).
  useWakeLock(state.kind === "searching" || state.kind === "stillSearching");

  // Letters land ~100 ms apart (all at once under reduced motion).
  const landed = queue?.lettersLanded ?? 100;
  useEffect(() => {
    if (phase !== "queue") return;
    if (reducedMotion) {
      setLettersLanded(100);
      return;
    }
    if (landed >= 100) return;
    const id = setTimeout(() => setLettersLanded(landed + 1), LETTER_LAND_MS);
    return () => clearTimeout(id);
  }, [phase, landed, reducedMotion, setLettersLanded]);

  // Paired: the table is the match's own page (spec 069 FR-023).
  const matchId = state.kind === "found" ? state.matchId : null;
  useEffect(() => {
    if (matchId) router.push(to(`/match/${matchId}`));
  }, [matchId, router, to]);

  const handleAction = useCallback(
    (action: LedgerAction) => {
      if (action === "cancelQueue") {
        void cancel();
        cancelQueue();
        router.replace(to("/"));
      }
    },
    [cancel, cancelQueue, router, to],
  );

  // `?` opens the rules, `M` mutes (design system §9, FR-026).
  useRoomHotkeys(handleAction);

  const opponent = useRoomStore.getState().opponent;
  const elapsed = state.kind === "searching" || state.kind === "stillSearching" ? formatClock(state.elapsedSeconds * 1000) : "0:00";
  // The tab says how long the search has run (spec 069 FR-026).
  const title = state.kind === "searching" ? `${copy.table.titleSearching(elapsed)} · ${copy.WORDMARK}` : copy.WORDMARK;
  useEffect(() => {
    document.title = title;
  }, [title]);
  const search = searchLines(state, copy, { resume, keepSearching, findAgain: () => useRoomStore.getState().requestNewSearch() });
  return (
    <QueueRoomView
      viewer={viewer}
      opponent={opponent}
      elapsed={elapsed}
      live={settingField(Math.min(landed, 100))}
      search={search}
      hint={searchingSubline(elapsed)}
      onAction={handleAction}
    >
      <Field board={board} viewerSlot="player_a" disabled landedCount={phase === "queue" ? landed : null} />
    </QueueRoomView>
  );
}
