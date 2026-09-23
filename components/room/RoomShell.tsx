"use client";

import { useEffect, type ReactNode } from "react";

import { useRoomStore } from "@/lib/room/roomStore";
import type { ReturningPlayer } from "@/lib/types/lobby";
import type { PlayerIdentity } from "@/lib/types/match";

interface RoomShellProps {
  viewer: PlayerIdentity | null;
  /** Who the sign-in slip greets when this browser signed out (spec 067). */
  returning?: ReturningPlayer | null;
  children: ReactNode;
}

/**
 * The one client tree that persists across `/`, `/lobby`, `/matchmaking` and
 * `/match/[id]` (mounted from app/[locale]/(room)/layout.tsx). It seeds the room store
 * with the session read once by the layout; pages hydrate the rest. Realtime
 * and polling move here from MatchClient when the match phase is folded in
 * (spec 044, research R5).
 */
export function RoomShell({ viewer, returning = null, children }: RoomShellProps) {
  const setViewer = useRoomStore((s) => s.setViewer);
  const setReturning = useRoomStore((s) => s.setReturning);

  useEffect(() => {
    setViewer(viewer);
  }, [viewer, setViewer]);
  useEffect(() => {
    setReturning(returning);
  }, [returning, setReturning]);

  return (
    <div data-testid="room-shell" className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
