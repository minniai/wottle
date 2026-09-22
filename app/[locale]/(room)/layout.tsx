import type { ReactNode } from "react";

import { RoomShell } from "@/components/room/RoomShell";
import { readLobbySession } from "@/lib/matchmaking/profile";

/**
 * One persisting shell for every room route (`/`, `/lobby`, `/matchmaking`,
 * `/match/[id]`). The session is read once here; child pages hydrate the room
 * store and never remount the field (spec 044, research R5).
 */
export default async function RoomLayout({ children }: { children: ReactNode }) {
  const session = await readLobbySession();
  return <RoomShell viewer={session?.player ?? null}>{children}</RoomShell>;
}
