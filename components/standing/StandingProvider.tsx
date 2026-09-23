"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { SignOutState } from "@/components/page/PageMenu";

/**
 * The viewer's standing machinery (spec 070 R11), mounted once in the locale
 * layout when a session exists, so it runs on every page and on the match
 * page: the tab's heartbeat, the player channel, the standing read, the
 * search, the tab title, the favicon, the cue and notifications. Pages read
 * what the masthead and the line slot need through `useStandingSlot`.
 */
export interface StandingSlotApi {
  /** How many are in the other lobby, for the masthead switch (S10). */
  otherLobbyHere: number | null;
  /** The line slot's content. */
  slot: ReactNode;
  signOut: SignOutState;
  /** Extra `⋯` items (notifications). */
  menuExtra: ReactNode;
}

const EMPTY: StandingSlotApi = { otherLobbyHere: null, slot: null, signOut: {}, menuExtra: null };

const StandingContext = createContext<StandingSlotApi>(EMPTY);

export function StandingProvider({ children }: { children: ReactNode }) {
  const value = useMemo<StandingSlotApi>(() => EMPTY, []);
  return <StandingContext.Provider value={value}>{children}</StandingContext.Provider>;
}

/** Outside a provider (signed out, a fixture, a unit test) the slot is empty. */
export function useStandingSlot(): StandingSlotApi {
  return useContext(StandingContext);
}
