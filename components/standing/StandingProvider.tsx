"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { LineSlot } from "@/components/page/LineSlot";
import type { SignOutState } from "@/components/page/PageMenu";
import { phoneSlotHeight } from "@/lib/pages/slotLines";

import { SearchRunner } from "./SearchRunner";
import { useStandingMachine, type StandingMachine } from "./useStandingMachine";

/**
 * The viewer's standing machinery (spec 070 R11), mounted once in the locale
 * layout when a session exists, so it runs on every page and on the match
 * page. Pages read what the masthead, the line slot and the lobby need
 * through `useStandingSlot`.
 */
export interface StandingSlotApi {
  /** How many are in the other lobby, for the masthead switch (S10). */
  otherLobbyHere: number | null;
  /** The line slot's content (desktop, under the masthead). */
  slot: ReactNode;
  /** The same standing state pinned to a phone's bottom edge (§5.0). */
  bottomSlot: ReactNode;
  /** Pixels the bottom slot takes on a phone: the page pads by them. */
  bottomHeight: number;
  signOut: SignOutState;
  menuExtra: ReactNode;
  /** While a call is up, the page's first focusable element leads to it. */
  skipLabel: string | null;
  machine: StandingMachine | null;
}

const EMPTY: StandingSlotApi = { otherLobbyHere: null, slot: null, bottomSlot: null, bottomHeight: 0, signOut: {}, menuExtra: null, skipLabel: null, machine: null };

const StandingContext = createContext<StandingSlotApi>(EMPTY);


function signOutState(machine: StandingMachine, copy: ReturnType<typeof useCopy>): SignOutState {
  const { facts, slot } = machine;
  if (facts?.match && facts.match.kind !== "over") return { disabledReason: copy.pages.FINISH_FIRST };
  if (slot.kind === "search") return { consequence: copy.pages.SIGN_OUT_CANCELS_SEARCH };
  if (facts?.outgoing?.status === "pending") return { consequence: copy.pages.SIGN_OUT_WITHDRAWS };
  return {};
}

function NotificationsItem({ machine }: { machine: StandingMachine }) {
  const copy = useCopy();
  const n = machine.notifications;
  if (!n.available) return null;
  return (
    <li role="none">
      <button type="button" role="menuitem" className="page-link" onClick={() => (n.enabled ? n.disable() : void n.enable())}>
        {copy.pages.notificationsToggle(n.enabled)}
      </button>
    </li>
  );
}

export function StandingProvider({ children }: { children: ReactNode }) {
  const copy = useCopy();
  const machine = useStandingMachine();
  const { facts, model, slot } = machine;
  const counts = facts ? { here: facts.counts.here, playing: facts.counts.playing } : null;
  const value: StandingSlotApi = {
    otherLobbyHere: facts?.counts.otherHere ?? null,
    slot: <LineSlot model={model} onAction={machine.onAction} announcement={machine.announcement} counts={counts} variant="desktop" />,
    bottomSlot: model.style === "terms" ? null : <LineSlot model={model} onAction={machine.onAction} announcement="" variant="phone" />,
    bottomHeight: phoneSlotHeight(model),
    signOut: signOutState(machine, copy),
    menuExtra: <NotificationsItem machine={machine} />,
    skipLabel: slot.kind === "call" ? copy.pages.skipToCall(slot.call.from.displayName) : slot.kind === "linkCall" ? copy.pages.skipToCall(slot.call.view.senderName) : null,
    machine,
  };
  const run = machine.search.run;
  return (
    <StandingContext.Provider value={value}>
      {run ? <SearchRunner key={run.id} startedAt={run.startedAt} language={machine.search.language} onState={machine.search.onState} /> : null}
      {children}
    </StandingContext.Provider>
  );
}

/** Outside a provider (signed out, a fixture, a unit test) the slot is empty. */
export function useStandingSlot(): StandingSlotApi {
  return useContext(StandingContext);
}
