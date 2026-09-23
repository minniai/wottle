"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { respondChallengeAction } from "@/app/actions/challenge/respond";
import { withdrawChallengeAction } from "@/app/actions/challenge/withdraw";
import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { useAttention } from "@/components/room/hooks/useAttention";
import { useIsPhone } from "@/components/room/hooks/useIsPhone";
import { useNowTick } from "@/components/room/hooks/useNowTick";
import { useWakeLock } from "@/components/room/hooks/useWakeLock";
import { useSoundEffects } from "@/lib/audio/useSoundEffects";
import { pagePrimary, type PagePrimaryModel } from "@/lib/pages/pagePrimary";
import { pageTitle } from "@/lib/pages/pageTitle";
import { challengesClosed, rowOverlays, type RowOverlay } from "@/lib/pages/rowOverlays";
import { slotLines, type SlotAction, type SlotModel } from "@/lib/pages/slotLines";
import { standingSlot, type SlotState } from "@/lib/pages/standingSlot";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { OUTCOME_HOLD_MS } from "@/lib/presence/constants";
import type { MatchmakingApi } from "@/lib/room/useMatchmaking";
import type { Language } from "@/lib/types/game-config";
import type { StandingFacts } from "@/lib/types/standing";

import { useFavicon } from "./hooks/useFavicon";
import { useHeldOutcome, type HeldOutcome } from "./hooks/useHeldOutcome";
import { useNotifications, type NotificationsApi } from "./hooks/useNotifications";
import { useStandingFacts, type PokeListener } from "./hooks/useStandingFacts";
import { pageOf, useTabPresence } from "./hooks/useTabPresence";
import { useTabTitle } from "./hooks/useTabTitle";

export interface SearchRun {
  id: number;
  startedAt: number;
}

export interface StandingMachine {
  facts: StandingFacts | null;
  slot: SlotState;
  model: SlotModel;
  announcement: string;
  held: HeldOutcome | null;
  overlays: Map<string, RowOverlay>;
  closed: boolean;
  primaryFor: (composing: boolean) => PagePrimaryModel;
  onAction: (action: SlotAction) => void;
  search: { run: SearchRun | null; language: Language; start: () => void; onState: (api: MatchmakingApi) => void };
  notifications: NotificationsApi;
  announceArrival: (name: string) => void;
  onPoke: (listener: PokeListener) => () => void;
  /** Read the standing now (after the viewer's own act, which pokes only the other side). */
  refresh: () => void;
}

const TICKING = new Set<SlotState["kind"]>(["call", "match", "sent", "search"]);

/** Plays the cue and notifies for each call that arrives after the first read (a reload does not ring again). */
function useCallSignals(facts: StandingFacts | null, notifications: NotificationsApi, copy: ReturnType<typeof useCopy>) {
  const sound = usePreferencesStore((s) => s.soundEnabled);
  const { playChallenge } = useSoundEffects(sound);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!facts) return;
    const ids = facts.incoming.map((c) => c.inviteId);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = facts.incoming.filter((c) => !seen.current!.has(c.inviteId));
    fresh.forEach((c) => seen.current!.add(c.inviteId));
    if (fresh.length === 0) return;
    playChallenge();
    notifications.notify(copy.pages.callLine1(fresh[0].from.displayName));
  }, [facts, playChallenge, notifications, copy]);
  return playChallenge;
}

/** A polite line on a call's arrival and again at 10s left, and on each held outcome (§8 item 14). */
function useAnnouncement(slot: SlotState, held: HeldOutcome | null, nowMs: number, copy: ReturnType<typeof useCopy>): string {
  const [line, setLine] = useState("");
  const said = useRef(new Set<string>());
  const callId = slot.kind === "call" ? slot.call.inviteId : null;
  const leftS = slot.kind === "call" ? Math.max(0, Math.round((Date.parse(slot.call.expiresAt) - nowMs) / 1000)) : 0;
  const tenLeft = leftS > 0 && leftS <= 10;
  useEffect(() => {
    if (slot.kind !== "call" || !callId) return;
    const key = `${callId}:${tenLeft ? "ten" : "arrive"}`;
    if (said.current.has(key)) return;
    said.current.add(key);
    setLine(copy.pages.callAnnounce(slot.call.from.displayName, leftS));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- said once per call and once at 10s left
  }, [callId, tenLeft]);
  useEffect(() => {
    if (held) setLine(copy.pages.outcomeAnnounce(held.name, copy.pages.OUTCOMES[held.outcome]));
  }, [held, copy]);
  return line;
}

/**
 * The viewer's standing, composed once for every page (spec 070 R11): the
 * tab's heartbeat, the standing read and its player channel, the search, the
 * slot's state and words, the cue, notifications, the tab title and favicon,
 * and the slot's actions. It never navigates on a broadcast; it navigates on
 * facts it read: a table waiting, an accepted challenge, a pairing.
 */
export function useStandingMachine(): StandingMachine {
  const copy = useCopy();
  const locale = useLocale();
  const to = useLocalePath();
  const router = useRouter();
  const page = pageOf(usePathname() ?? "/");
  const phone = useIsPhone();
  useTabPresence(page);
  const attention = useAttention();
  const { facts, refresh, onPoke } = useStandingFacts(attention);
  const notifications = useNotifications();
  const playChallenge = useCallSignals(facts, notifications, copy);

  const [run, setRun] = useState<SearchRun | null>(null);
  const [searchApi, setSearchApi] = useState<MatchmakingApi | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const language = (facts?.lobbyLanguage ?? locale.language) as Language;

  // A search already running (another tab, a reload, a requeue after a void) is picked up where it
  // stands; one this tab ended is not, until the server's read has caught up with the end.
  const running = facts?.search ?? null;
  const ended = useRef<{ at: number } | null>(null);
  const readAt = facts ? Date.parse(facts.now) : 0;
  useEffect(() => {
    if (!running || run) return;
    // A read taken before this tab ended its search still shows it: wait for a fresh one.
    if (ended.current && readAt <= ended.current.at) return;
    setRun({ id: Date.now(), startedAt: Date.parse(running.queuedAt) });
  }, [running, run, readAt]);
  const endSearch = useCallback(() => {
    ended.current = { at: Date.now() };
    setRun(null);
    setSearchApi(null);
  }, []);
  const start = useCallback(() => {
    ended.current = null;
    setSearchApi(null);
    setRun({ id: Date.now(), startedAt: Date.now() });
  }, []);
  const onSearchState = useCallback((api: MatchmakingApi) => setSearchApi(api), []);
  const found = searchApi?.state.kind === "found" ? searchApi.state.matchId : null;
  useEffect(() => {
    if (!found) return;
    endSearch();
    router.push(to(`/match/${found}`));
  }, [found, router, to, endSearch]);

  const held = useHeldOutcome(facts?.outgoing ?? null, (matchId) => router.push(to(`/match/${matchId}`)));
  const search = run && searchApi ? searchApi.state : null;
  const slot = standingSlot({ facts, held, search });
  const nowMs = useNowTick(TICKING.has(slot.kind));
  const viewer = facts?.viewer ?? { rating: 1200, gamesPlayed: 0 };
  const base = slotLines(slot, copy, { nowMs, phone, viewer, searchingCount: facts?.counts.searching ?? 0 });
  const model: SlotModel = note ? { style: "status", square: "you", line1: note, line2: "", primary: null, secondaries: [], bar: null } : base;
  const announcement = useAnnouncement(slot, held, nowMs, copy);

  // A table waiting for the viewer takes them to it from any page (spec 069 FR-025a, now pushed).
  const tableId = facts?.match?.kind === "table" ? facts.match.matchId : null;
  const tableRef = useRef<string | null>(null);
  useEffect(() => {
    if (!tableId || tableRef.current === tableId || page === "match") return;
    tableRef.current = tableId;
    if (document.visibilityState === "hidden") {
      playChallenge();
      notifications.notify(copy.table.titleTable(facts?.match?.opponent ?? ""));
    }
    router.push(to(`/match/${tableId}`));
  }, [tableId, page, router, to, playChallenge, notifications, copy, facts?.match?.opponent]);

  useWakeLock(Boolean(search && (search.kind === "searching" || search.kind === "stillSearching")) || facts?.outgoing?.status === "pending");
  useFavicon(locale.id, (facts?.incoming.length ?? 0) > 0);
  useTabTitle(page === "match" ? null : pageTitle(slot, copy, { nowMs, calls: facts?.incoming.length ?? 0, arrival }));

  const flash = useCallback((line: string) => {
    setNote(line);
    setTimeout(() => setNote(null), OUTCOME_HOLD_MS);
  }, []);

  const accept = useCallback(async () => {
    if (slot.kind !== "call") return;
    const name = slot.call.from.displayName;
    const r = await respondChallengeAction({ inviteId: slot.call.inviteId, answer: "accept" });
    if (r.status === "accepted") {
      endSearch();
      router.push(to(`/match/${r.matchId}`));
    } else if (r.status === "sender_busy") flash(copy.pages.cantPlay(name));
    else if (r.status === "sender_gone") flash(copy.pages.senderLeft(name));
    refresh();
  }, [slot, router, to, flash, copy, refresh, endSearch]);

  const onAction = useCallback(
    (action: SlotAction) => {
      const matchId = slot.kind === "match" ? slot.match.matchId : null;
      switch (action) {
        case "accept":
          return void accept();
        case "decline":
          return void (slot.kind === "call" && respondChallengeAction({ inviteId: slot.call.inviteId, answer: "decline" }).then(refresh));
        case "withdraw":
          return void (slot.kind === "sent" && slot.outgoing && withdrawChallengeAction({ inviteId: slot.outgoing.inviteId }).then(refresh));
        case "cancelSearch":
          void searchApi?.cancel();
          return endSearch();
        case "resume":
          return searchApi?.resume();
        case "keepSearching":
          return searchApi?.keepSearching();
        case "findAgain":
          return start();
        case "backToMatch":
        case "result":
          return void (matchId && router.push(to(`/match/${matchId}`)));
        case "switch":
          return refresh();
      }
    },
    [slot, accept, refresh, searchApi, start, router, to, endSearch],
  );

  const announceArrival = useCallback(
    (name: string) => {
      playChallenge();
      notifications.notify(copy.pages.arrived(name));
      setArrival(name);
      setTimeout(() => setArrival(null), 10_000);
    },
    [playChallenge, notifications, copy],
  );

  const overlays = useMemo(() => rowOverlays(facts, held, nowMs, copy), [facts, held, nowMs, copy]);
  return {
    facts,
    slot,
    model,
    announcement,
    held,
    overlays,
    closed: challengesClosed(facts),
    primaryFor: (composing) => pagePrimary(slot, copy, { composing }),
    onAction,
    search: { run, language, start, onState: onSearchState },
    notifications,
    announceArrival,
    onPoke,
    refresh,
  };
}
