"use server";

import "server-only";

import { z } from "zod";

import { signInAsReturning, signInWithName } from "@/lib/auth/signIn";
import { LINK_ACCEPT_LIMIT } from "@/lib/constants/links";
import { acceptLink, readLink } from "@/lib/matchmaking/linkService";
import { hashLinkToken, parseLinkToken } from "@/lib/matchmaking/linkToken";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit, RateLimitExceededError } from "@/lib/rate-limiting/middleware";
import type { AcceptLinkResult, LinkView } from "@/lib/types/link";

const inputSchema = z.discriminatedUnion("mode", [
  z.object({ token: z.string(), mode: z.literal("session") }),
  z.object({ token: z.string(), mode: z.literal("name"), name: z.string().max(64) }),
  z.object({ token: z.string(), mode: z.literal("returning") }),
]);

export type AcceptLinkInput = z.input<typeof inputSchema>;

type Actor = { id: string } | { status: "unauthenticated" } | Extract<AcceptLinkResult, { status: "sign_in_failed" }>;

/** Who is accepting: the session, a typed name, or this browser's returning player, in the link's language. */
async function actorFor(input: z.infer<typeof inputSchema>, view: LinkView): Promise<Actor> {
  if (input.mode === "session") {
    const session = await readLobbySession();
    return session ? { id: session.player.id } : { status: "unauthenticated" };
  }
  const signedIn = input.mode === "name" ? await signInWithName(input.name, view.language) : await signInAsReturning(view.language);
  return signedIn.status === "success" ? { id: signedIn.player.id } : { status: "sign_in_failed", code: signedIn.code };
}

/**
 * `accept ▸` on an invite link (spec 072 FR-020–FR-026, research R5): a POST,
 * never a GET. A visitor is signed in first (a failed sign-in leaves the link
 * unused); then the link is used by compare-and-set and the table made through
 * `create_match_between`.
 *
 * @param input the link's token and how the accepter is known: `session`
 * (the slot), `name` (the invite door's field) or `returning` (this browser).
 * @returns `created` with the match and its language; `expired` for any link
 * that cannot be used; `own`, `busy`, `unauthenticated`, `sign_in_failed`, `error`.
 */
export async function acceptLinkAction(input: AcceptLinkInput): Promise<AcceptLinkResult> {
  const parsed = inputSchema.safeParse(input);
  const token = parsed.success ? parseLinkToken(parsed.data.token) : null;
  if (!parsed.success || !token) return { status: "expired" };
  try {
    const hash = hashLinkToken(token);
    const view = await readLink(hash);
    if (!view?.valid) return { status: "expired" };
    const actor = await actorFor(parsed.data, view);
    if (!("id" in actor)) return actor;
    assertWithinRateLimit({ identifier: actor.id, scope: "link:accept", ...LINK_ACCEPT_LIMIT, errorMessage: "Too many accepts." });
    const accepted = await acceptLink(hash, actor.id, view.senderId);
    return accepted.status === "created" ? { status: "created", matchId: accepted.matchId, language: view.language } : { status: accepted.status };
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { status: "sign_in_failed", code: "rate_limited" };
    console.error(JSON.stringify({ event: "link.accept.failed", error: error instanceof Error ? error.message : String(error) }));
    return { status: "error" };
  }
}
