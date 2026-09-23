import type { ReactNode } from "react";

import { FramedPage } from "@/components/page/FramedPage";
import { readLobbySession } from "@/lib/matchmaking/profile";

/**
 * Profile and rules (spec 070 FR-002): pages on the room's grid under the
 * masthead and, signed in, the line slot. The session is read once here.
 */
export default async function FramedLayout({ children }: { children: ReactNode }) {
  const session = await readLobbySession();
  const viewer = session ? { displayName: session.player.displayName, handle: session.player.username } : null;
  return <FramedPage viewer={viewer}>{children}</FramedPage>;
}
