"use client";

import type { ReactNode } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { LineSlot } from "@/components/page/LineSlot";
import type { SignOutState } from "@/components/page/PageMenu";
import { phoneSlotHeight } from "@/lib/pages/slotLines";

import { SearchRunner } from "./SearchRunner";
import { StandingContext, type StandingSlotApi } from "./standingContext";
import { useStandingMachine, type StandingMachine } from "./useStandingMachine";

export { useStandingSlot, type StandingSlotApi } from "./standingContext";

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
  const value: StandingSlotApi = {
    otherLobbyHere: facts?.counts.otherHere ?? null,
    slot: <LineSlot model={model} onAction={machine.onAction} announcement={machine.announcement} variant="desktop" />,
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

