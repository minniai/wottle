"use server";

import "server-only";

import { LINK_CREATE_LIMIT } from "@/lib/constants/links";
import { requestOrigin } from "@/lib/http/requestOrigin";
import { localePath } from "@/lib/i18n/locales";
import { createLink } from "@/lib/matchmaking/linkService";
import { makeLinkToken } from "@/lib/matchmaking/linkToken";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit, RateLimitExceededError } from "@/lib/rate-limiting/middleware";
import type { CreateLinkResult } from "@/lib/types/link";

/**
 * `invite a friend ▸` (spec 072 FR-001, B9): a single-use link that lasts ten
 * minutes, in the sender's lobby language. It withdraws the sender's challenge
 * or earlier link and ends their search; the database decides every gate.
 *
 * @returns `created` with the link's URL (the only time its token leaves the
 * server) and its expiry; otherwise why no link was made: `busy_sender`,
 * `cooldown` (with `until`), `rate_limited`, `unauthenticated` or `error`.
 */
export async function createLinkAction(): Promise<CreateLinkResult> {
  const session = await readLobbySession();
  if (!session) return { status: "unauthenticated" };
  try {
    assertWithinRateLimit({ identifier: session.player.id, scope: "link:create", ...LINK_CREATE_LIMIT, errorMessage: "Too many links." });
    const { token, hash } = makeLinkToken();
    const made = await createLink(session.player.id, hash);
    if (made.status === "cooldown") return { status: "cooldown", until: made.until };
    if (made.status !== "created") return { status: made.status === "invalid" ? "error" : made.status };
    const url = `${await requestOrigin()}${localePath(made.language, `/c/${token}`)}`;
    return { status: "created", linkId: made.linkId, url, expiresAt: made.expiresAt };
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { status: "rate_limited" };
    console.error(JSON.stringify({ event: "link.create.failed", error: error instanceof Error ? error.message : String(error) }));
    return { status: "error" };
  }
}
