import "server-only";

import type { LinkCall } from "@/lib/types/link";

import { readLink } from "./linkService";
import { hashLinkToken, parseLinkToken } from "./linkToken";

export interface LinkSeed {
  call: LinkCall | null;
  own: LinkCall | null;
}

const NONE: LinkSeed = { call: null, own: null };

/**
 * The lobby's `?invite=` (spec 072 US3, research R6): someone else's valid
 * link is a call in the slot; the sender's own is their own link. Reads only;
 * an invalid link drops without a word.
 */
export async function readLinkSeed(invite: string | undefined, viewerId: string): Promise<LinkSeed> {
  const token = parseLinkToken(invite);
  if (!token) return NONE;
  const view = await readLink(hashLinkToken(token));
  if (!view?.valid) return NONE;
  const seed = { token, view };
  return view.senderId === viewerId ? { call: null, own: seed } : { call: seed, own: null };
}
