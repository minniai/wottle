"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { acceptLinkAction } from "@/app/actions/link/accept";

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
export interface LinkSlotHandlers {
  /** A link call accepted: the table, in the link's language. */
  onAccepted: (matchId: string, language: "is" | "en") => void;
  /** A line held in the slot for 4s: why nothing happened. */
  flash: (line: string) => void;
  /** The viewer's lobby language: the language of their own link's match. */
  language: "is" | "en";
}

export function useLinkSlot(link: OutgoingLink | null, refresh: () => void, handlers: LinkSlotHandlers): LinkSlotApi {
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

  const { onAccepted, flash } = handlers;
  // The sender's link was used: the friend is at the table, and so is the sender (T63).
  const usedMatch = link?.status === "used" ? (link.matchId ?? null) : null;
  const pendingSeen = useRef(false);
  const linkStatus = link?.status ?? null;
  useEffect(() => {
    if (linkStatus === "pending") pendingSeen.current = true;
  }, [linkStatus]);
  useEffect(() => {
    if (!usedMatch || !pendingSeen.current) return;
    pendingSeen.current = false;
    onAccepted(usedMatch, handlers.language);
  }, [usedMatch, onAccepted, handlers.language]);
  const acceptCall = useCallback(async () => {
    if (!call) return;
    const result = await acceptLinkAction({ token: call.token, mode: "session" });
    setCall(null);
    refresh();
    if (result.status === "created") onAccepted(result.matchId, result.language);
    else if (result.status === "busy") flash(copy.pages.LINK_BUSY);
    else if (result.status !== "own") flash(copy.pages.LINK_EXPIRED_NOTE);
  }, [call, refresh, onAccepted, flash, copy]);

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
        case "acceptLink":
          void acceptCall();
          return true;
        default:
          return false;
      }
    },
    [out, refresh, acceptCall],
  );

  return {
    inputs: { call, own, held: out.held },
    text: out.text ?? (own && link?.status === "pending" ? { linkId: link.id, url: ownUrl(own) } : null),
    clipboardRefused: out.clipboardRefused,
    invite,
    seed,
    handle,
    call,
    dismissCall: () => setCall(null),
  };
}
