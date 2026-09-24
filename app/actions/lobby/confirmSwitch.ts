"use server";

import "server-only";

import { confirmLobbySwitch } from "@/lib/matchmaking/lobbyLanguage";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { lobbyLanguageSchema } from "@/lib/types/standing";

export type ConfirmSwitchResult = { status: "switched" | "unauthenticated" | "error" };

/** `switch ▸` in the line slot (spec 070 US7.3–US7.4): the search stops, challenges end, the lobby changes. */
export async function confirmLobbySwitchAction(input: { language: string }): Promise<ConfirmSwitchResult> {
  const session = await readLobbySession();
  if (!session) return { status: "unauthenticated" };
  const language = lobbyLanguageSchema.safeParse(input.language);
  if (!language.success) return { status: "error" };
  try {
    await confirmLobbySwitch(session.player.id, language.data);
    return { status: "switched" };
  } catch (error) {
    console.error(JSON.stringify({ event: "lobby.switch.failed", error: error instanceof Error ? error.message : String(error) }));
    return { status: "error" };
  }
}
