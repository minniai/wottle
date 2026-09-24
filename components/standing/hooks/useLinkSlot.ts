"use client";

import { useCallback, useState } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { localePath } from "@/lib/i18n/locales";
import { formatClock } from "@/lib/room/clock";
import type { LinkInputs, SlotState } from "@/lib/pages/standingSlot";
import type { SlotAction } from "@/lib/pages/slotLines";
import type { LinkCall, OutgoingLink } from "@/lib/types/link";

import { useLinkOut, type KeptLink } from "./useLinkOut";

export interface LinkSeed {
  call?: LinkCall | null;
  own?: LinkCall | null;
}

export interface LinkSlotApi {
  inputs: LinkInputs;
  text: KeptLink | null;
  clipboardRefused: boolean;
  /** `invite a friend ▸`: resolves to a line to say when no link was made. */
  invite: () => Promise<string | null>;
  /** The lobby page hands over a link opened here (research R6). */
  seed: (seed: LinkSeed) => void;
  /** Handles the link's slot actions; false for any other action. */
  handle: (action: SlotAction, slot: SlotState) => boolean;
  /** The link call, for its accept (US3). */
  call: LinkCall | null;
  dismissCall: () => void;
}

const ownUrl = (own: LinkCall) => `${window.location.origin}${localePath(own.view.language, `/c/${own.token}`)}`;

/** Spec 072: the viewer's link out, a link opened here, and the sender's own link, for the slot. */
export function useLinkSlot(link: OutgoingLink | null, refresh: () => void): LinkSlotApi {
  const copy = useCopy();
  const out = useLinkOut(link);
  const [call, setCall] = useState<LinkCall | null>(null);
  const [own, setOwn] = useState<LinkCall | null>(null);

  const invite = useCallback(async (): Promise<string | null> => {
    const made = await out.create();
    refresh();
    if (made.status === "created") return null;
    if (made.status === "cooldown") return copy.table.findAgainIn(formatClock(Math.max(0, Date.parse(made.until) - Date.now())));
    if (made.status === "busy_sender" || made.status === "rate_limited") return copy.pages.LINK_ERRORS[made.status];
    return copy.pages.LINK_ERRORS.failed;
  }, [out, refresh, copy]);

  const seed = useCallback((s: LinkSeed) => {
    if (s.call !== undefined) setCall(s.call);
    if (s.own !== undefined) setOwn(s.own);
  }, []);

  const handle = useCallback(
    (action: SlotAction, slot: SlotState): boolean => {
      const pending = slot.kind === "link" ? slot.link : null;
      switch (action) {
        case "copyLink":
          out.copyAgain();
          return true;
        case "newLink":
          void (pending ? out.cancel(pending.id) : Promise.resolve()).then(() => out.create()).then(refresh);
          return true;
        case "cancelLink":
          if (pending) void out.cancel(pending.id).then(refresh);
          return true;
        case "copyOwnLink":
          if (slot.kind === "link" && slot.own) out.copy(ownUrl(slot.own));
          return true;
        case "dismissLink":
          setCall(null);
          return true;
        default:
          return false;
      }
    },
    [out, refresh],
  );

  return {
    inputs: { call, own, held: out.held },
    text: out.text,
    clipboardRefused: out.clipboardRefused,
    invite,
    seed,
    handle,
    call,
    dismissCall: () => setCall(null),
  };
}
