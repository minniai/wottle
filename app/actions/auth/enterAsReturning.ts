"use server";

import "server-only";

import type { LoginActionState } from "@/app/actions/auth/login";
import { signInAsReturning } from "@/lib/auth/signIn";
import { playableLanguageSchema } from "@/lib/game-engine/languagePack";

/**
 * `enter the lobby ▸` on the returning door (spec 067 FR-010): this browser's
 * device key alone signs its latest player in, with nothing typed.
 */
export async function enterAsReturningAction(language: string): Promise<LoginActionState> {
  const lobby = playableLanguageSchema.safeParse(language);
  return signInAsReturning(lobby.success ? lobby.data : "is");
}
