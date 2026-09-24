import { z } from "zod";

import type { ErrorCode } from "@/lib/i18n/copy/types";

/** The link's language; not `lobbyLanguageSchema`, which `standing.ts` builds on this module. */
const linkLanguageSchema = z.enum(["is", "en"]);
type LinkLanguage = z.infer<typeof linkLanguageSchema>;

/**
 * Spec 072: invite links. A link has no recipient until it is used; the
 * sender sees it as their one outgoing challenge, a visitor sees a `LinkView`.
 * Nothing here ever carries the token's hash.
 */
export const linkStatusSchema = z.enum(["pending", "used", "cancelled", "expired", "withdrawn", "superseded"]);
export type LinkStatus = z.infer<typeof linkStatusSchema>;

/** The sender's link, as `/api/standing` reports it: pending, or its outcome for 10s. */
export const outgoingLinkSchema = z.object({
  id: z.string().uuid(),
  status: linkStatusSchema,
  expiresAt: z.string(),
  respondedAt: z.string().nullable(),
});
export type OutgoingLink = z.infer<typeof outgoingLinkSchema>;

/** What the invite door and the link call show. */
export const linkViewSchema = z.object({
  valid: z.boolean(),
  senderId: z.string().uuid(),
  senderName: z.string(),
  senderHandle: z.string(),
  senderRating: z.number(),
  language: linkLanguageSchema,
  expiresAt: z.string(),
});
export type LinkView = z.infer<typeof linkViewSchema>;

/** A link opened by a signed-in player: held by their tab, never by the server (research R6). */
export interface LinkCall {
  token: string;
  view: LinkView;
}

export type CreateLinkResult =
  | { status: "created"; linkId: string; url: string; expiresAt: string }
  | { status: "busy_sender" | "rate_limited" | "unauthenticated" | "error" }
  | { status: "cooldown"; until: string };

export type AcceptLinkResult =
  | { status: "created"; matchId: string; language: LinkLanguage }
  | { status: "expired" | "own" | "busy" | "unauthenticated" | "error" }
  | { status: "sign_in_failed"; code: ErrorCode };
