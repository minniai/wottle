"use server";

import "server-only";

import type { ErrorCode } from "@/lib/i18n/copy/types";
import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import { signInWithName } from "@/lib/auth/signIn";
import type { PlayerIdentity } from "@/lib/types/match";

export interface LoginActionState {
  status: "idle" | "success" | "error";
  /** What the room shows, in the page's language (spec 060); `message` stays English for logs and tests. */
  code?: ErrorCode;
  message?: string;
  player?: PlayerIdentity;
}

/** Spec 067: the door's name form. The steps live in `lib/auth/signIn.ts`, shared with the invite door (spec 072). */
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const username = formData.get("username");
  const language = playableLanguageSchema.safeParse(formData.get("language") ?? undefined);
  // No revalidatePath("/"): the same URL reads again as the lobby on the client's refresh (spec 070).
  return signInWithName(typeof username === "string" ? username : "", language.success ? language.data : "is");
}
