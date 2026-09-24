"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { SignOutState } from "@/components/page/PageMenu";

import type { StandingMachine } from "./useStandingMachine";

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

export const StandingContext = createContext<StandingSlotApi>(EMPTY);


/** Outside a provider (signed out, a fixture, a unit test) the slot is empty. */
export function useStandingSlot(): StandingSlotApi {
  return useContext(StandingContext);
}
