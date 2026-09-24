import { z } from "zod";

import { outgoingLinkSchema } from "./link";

/**
 * Spec 070: presence, the lobby's rows, the viewer's standing facts and the
 * line slot. Server responses are parsed with these schemas; the slot state
 * is derived on the client by `lib/pages/standingSlot.ts`, never stored.
 */

export const lobbyLanguageSchema = z.enum(["is", "en"]);
export type LobbyLanguage = z.infer<typeof lobbyLanguageSchema>;

export const presenceStateSchema = z.enum(["here", "searching", "in_match", "away"]);
export type PresenceState = z.infer<typeof presenceStateSchema>;

export const presencePageSchema = z.enum(["lobby", "profile", "rules", "match", "other"]);
export type PresencePage = z.infer<typeof presencePageSchema>;

export const recordSchema = z.object({ wins: z.number().int(), losses: z.number().int(), draws: z.number().int() });
export type HeadToHead = z.infer<typeof recordSchema>;

export const lobbyRowSchema = z.object({
  playerId: z.string().uuid(),
  displayName: z.string(),
  handle: z.string(),
  rating: z.number(),
  state: presenceStateSchema,
  movesPlayed: z.number().int().nullable(),
  record: recordSchema.nullable(),
});
export type LobbyRow = z.infer<typeof lobbyRowSchema>;

export const inviteStatusSchema = z.enum(["pending", "accepted", "declined", "expired", "withdrawn", "superseded", "left"]);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

/** What the sender reads for 4s after a challenge ends (spec US3.4). */
export type Outcome = "accepted" | "declined" | "no_answer" | "withdrawn" | "started_another" | "left";

export function outcomeOf(status: InviteStatus): Outcome | null {
  switch (status) {
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "expired":
      return "no_answer";
    case "withdrawn":
      return "withdrawn";
    case "superseded":
      return "started_another";
    case "left":
      return "left";
    default:
      return null;
  }
}

export const challengeStatusSchema = z.enum([
  "sent",
  "crossed",
  "in_match",
  "gone",
  "away",
  "other_lobby",
  "cooldown",
  "declined_recently",
  "rate_limited",
  "self",
  "busy_sender",
]);
export type ChallengeStatus = z.infer<typeof challengeStatusSchema>;

const incomingSchema = z.object({ inviteId: z.string().uuid(), from: lobbyRowSchema, expiresAt: z.string() });

const outgoingSchema = z.object({
  inviteId: z.string().uuid(),
  to: lobbyRowSchema,
  status: inviteStatusSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  respondedAt: z.string().nullable(),
  matchId: z.string().uuid().nullable(),
});

const matchFactSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["table", "running"]),
    matchId: z.string().uuid(),
    opponent: z.string(),
    movesPlayed: z.number().int(),
    moveLimit: z.number().int(),
    deadlineAt: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("over"),
    matchId: z.string().uuid(),
    opponent: z.string(),
    winner: z.enum(["you", "opponent", "draw"]),
    winnerName: z.string().nullable(),
    you: z.number(),
    them: z.number(),
    endedReason: z.string().nullable(),
  }),
]);
export type MatchFact = z.infer<typeof matchFactSchema>;

export const switchPendingSchema = z.object({
  to: lobbyLanguageSchema,
  from: lobbyLanguageSchema,
  pending: z.array(z.enum(["search", "outgoing", "incoming", "link"])),
});
export type SwitchPending = z.infer<typeof switchPendingSchema>;

export const standingFactsSchema = z.object({
  now: z.string(),
  topic: z.string(),
  lobbyLanguage: lobbyLanguageSchema.nullable(),
  incoming: z.array(incomingSchema),
  outgoing: outgoingSchema.nullable(),
  cooldowns: z.array(z.object({ playerId: z.string().uuid(), until: z.string() })),
  search: z.object({ queuedAt: z.string(), paused: z.boolean() }).nullable(),
  tableCooldownUntil: z.string().nullable(),
  match: matchFactSchema.nullable(),
  switchPending: switchPendingSchema.nullable(),
  /** Spec 072: the viewer's invite link, pending or its outcome for 10s. Absent in older fixtures. */
  link: outgoingLinkSchema.nullish(),
  /** Spec 069: said once after a table the viewer did not sit down at. */
  notice: z.enum(["table_missed"]).nullable(),
  /** The viewer's lobby's numbers and the other lobby's here count (S10): the slot, the search line and the masthead switch. */
  counts: z.object({ here: z.number().int(), searching: z.number().int(), playing: z.number().int(), otherHere: z.number().int() }),
  /** The viewer's rating and matches in their lobby's language: the stakes on a sent challenge. */
  viewer: z.object({ rating: z.number(), gamesPlayed: z.number().int() }),
});
export type StandingFacts = z.infer<typeof standingFactsSchema>;
export type IncomingCall = StandingFacts["incoming"][number];
export type OutgoingChallenge = NonNullable<StandingFacts["outgoing"]>;

export const lobbyCountsSchema = z.object({
  here: z.number().int(),
  searching: z.number().int(),
  playersInMatch: z.number().int(),
  matchesOn: z.number().int(),
  other: z.object({ language: lobbyLanguageSchema, here: z.number().int() }),
});
export type LobbyCounts = z.infer<typeof lobbyCountsSchema>;

export const formResultSchema = z.enum(["W", "L", "D"]);
export type FormResult = z.infer<typeof formResultSchema>;

export const bandSchema = z.object({
  tiles: z.array(z.object({ x: z.number().int(), y: z.number().int() })),
  seat: z.enum(["you", "opp"]),
});
export type Band = z.infer<typeof bandSchema>;

export const lastMatchSchema = z.object({
  matchId: z.string().uuid(),
  opponent: z.string(),
  you: z.number(),
  them: z.number(),
  durationMs: z.number().nullable(),
  completedAt: z.string(),
  youWon: z.boolean().nullable(),
  bands: z.array(bandSchema),
});
export type LastMatch = z.infer<typeof lastMatchSchema>;

export const overviewSchema = z.object({
  counts: lobbyCountsSchema,
  here: z.array(z.object({ displayName: z.string(), rating: z.number(), state: z.enum(["here", "searching"]) })).optional(),
  more: z.number().int().optional(),
  lastMatch: lastMatchSchema.nullable().optional(),
  form: z.array(formResultSchema).optional(),
});
export type Overview = z.infer<typeof overviewSchema>;
