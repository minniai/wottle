"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cancelLinkAction } from "@/app/actions/link/cancel";
import { createLinkAction } from "@/app/actions/link/create";
import { LINK_STORAGE_KEY } from "@/lib/constants/links";
import type { LinkHeld } from "@/lib/pages/standingSlot";
import { OUTCOME_HOLD_MS } from "@/lib/presence/constants";
import type { CreateLinkResult, OutgoingLink } from "@/lib/types/link";

export interface KeptLink {
  linkId: string;
  url: string;
}

export interface LinkOutApi {
  /** The link text this browser kept (research R2); null elsewhere. */
  text: KeptLink | null;
  clipboardRefused: boolean;
  held: LinkHeld | null;
  create: () => Promise<CreateLinkResult>;
  copyAgain: () => void;
  copy: (url: string) => void;
  cancel: (linkId: string) => Promise<void>;
}

function readKept(): KeptLink | null {
  try {
    const raw = localStorage.getItem(LINK_STORAGE_KEY);
    if (!raw) return null;
    const kept = JSON.parse(raw) as KeptLink & { expiresAt: string };
    return Date.parse(kept.expiresAt) > Date.now() ? { linkId: kept.linkId, url: kept.url } : null;
  } catch {
    return null;
  }
}

function keep(value: (KeptLink & { expiresAt: string }) | null): void {
  try {
    if (value) localStorage.setItem(LINK_STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(LINK_STORAGE_KEY);
  } catch {
    // Storage is a convenience: without it the slot offers `new link ▸`.
  }
}

/** Copies, or reports that the browser refused; a phone falls back to its share sheet. */
async function copyText(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/** A link that ends while seen holds its outcome 4s; a used one hands over to the table instead. */
function useLinkHeld(link: OutgoingLink | null, onEnded: () => void): LinkHeld | null {
  const [held, setHeld] = useState<LinkHeld | null>(null);
  const shown = useRef(new Set<string>());
  const ended = link && (link.status === "cancelled" || link.status === "expired") ? link.status : null;
  const key = link && ended ? `${link.id}:${ended}` : null;
  const respondedAt = link?.respondedAt ?? null;
  useEffect(() => {
    if (link && link.status !== "pending") onEnded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per status change
  }, [link?.id, link?.status]);
  useEffect(() => {
    if (!key || !ended || shown.current.has(key)) return;
    shown.current.add(key);
    if (respondedAt && Date.now() - Date.parse(respondedAt) > OUTCOME_HOLD_MS) return;
    setHeld(ended);
    const id = setTimeout(() => setHeld(null), OUTCOME_HOLD_MS);
    return () => clearTimeout(id);
  }, [key, ended, respondedAt]);
  return held;
}

/**
 * The viewer's invite link (spec 072 US1): made and copied in one press,
 * copied again from what this browser kept, cancelled, and its end held 4s.
 */
export function useLinkOut(link: OutgoingLink | null): LinkOutApi {
  const [text, setText] = useState<KeptLink | null>(() => (typeof window === "undefined" ? null : readKept()));
  const [clipboardRefused, setRefused] = useState(false);
  const forget = useCallback(() => {
    keep(null);
    setText(null);
    setRefused(false);
  }, []);
  const held = useLinkHeld(link, forget);

  const copy = useCallback((url: string) => {
    void copyText(url).then((ok) => setRefused(!ok));
  }, []);

  const create = useCallback(async (): Promise<CreateLinkResult> => {
    const made = await createLinkAction();
    if (made.status !== "created") return made;
    keep({ linkId: made.linkId, url: made.url, expiresAt: made.expiresAt });
    setText({ linkId: made.linkId, url: made.url });
    setRefused(!(await copyText(made.url)));
    return made;
  }, []);

  const copyAgain = useCallback(() => {
    if (text) copy(text.url);
  }, [text, copy]);

  const cancel = useCallback(
    async (linkId: string) => {
      await cancelLinkAction({ linkId });
      forget();
    },
    [forget],
  );

  return { text, clipboardRefused, held, create, copyAgain, copy, cancel };
}
