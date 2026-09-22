import { readLobbySession } from "@/lib/matchmaking/profile";

import { LobbyRoomPage } from "./LobbyRoomPage";

/**
 * Landing = the lobby room with an empty bottom seat (spec 044 US7). Signed-in
 * visitors get the same room here — no server redirect, so the field survives
 * the router refresh that follows sign-in; the client rewrites the URL to /lobby.
 */
export default async function LandingPage() {
  const session = await readLobbySession();
  return <LobbyRoomPage session={session} />;
}
