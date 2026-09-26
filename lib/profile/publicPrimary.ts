import type { Copy } from "@/lib/i18n/copy/types";
import type { RowOverlay } from "@/lib/pages/rowOverlays";
import { stakesFor } from "@/lib/rating/stakes";
import { formatClock } from "@/lib/room/clock";
import type { PresenceWord } from "@/lib/types/profile";

export type PublicPrimary =
  | { kind: "challenge"; label: string; stakes: string }
  | { kind: "sent"; label: string }
  | { kind: "closed"; reason: string | null }
  | { kind: "enterLobby"; label: string };

export interface PublicPrimaryInput {
  signedIn: boolean;
  presence: PresenceWord;
  /** What the viewer's standing writes on this player's lobby row (rowOverlays). */
  overlay: RowOverlay | undefined;
  /** The viewer's own match runs or a lobby switch waits: nobody can be challenged. */
  closed: boolean;
  viewer: { rating: number; gamesPlayed: number };
  owner: { rating: number };
  nowMs: number;
  copy: Copy;
}

/**
 * Another player's profile has one primary (spec 072 FR-042–FR-044): `challenge ▸`
 * with the viewer's stakes while they are here; the sent state while the
 * viewer's challenge is out; otherwise nothing, with the lobby row's reason
 * when there is one. A visitor who is not signed in is offered the lobby.
 */
export function publicPrimary(input: PublicPrimaryInput): PublicPrimary {
  const { copy, overlay } = input;
  if (!input.signedIn) return { kind: "enterLobby", label: copy.ENTER_LOBBY };
  if (input.closed) return { kind: "closed", reason: null };
  if (overlay?.status && overlay.action === "none") {
    // A call from them closes the row (`challenges you`); otherwise it is the viewer's challenge, out.
    return overlay.status === copy.CHALLENGES_YOU ? { kind: "closed", reason: overlay.status } : { kind: "sent", label: overlay.status };
  }
  if (overlay?.action && overlay.action !== "none") {
    const reason = "againUntilMs" in overlay.action ? copy.pages.againIn(formatClock(Math.max(0, overlay.action.againUntilMs - input.nowMs))) : overlay.action.error;
    return { kind: "closed", reason };
  }
  if (input.presence.state !== "here") return { kind: "closed", reason: null };
  const stakes = stakesFor(
    { eloRating: input.viewer.rating, gamesPlayed: input.viewer.gamesPlayed, wins: 0, losses: 0, draws: 0 },
    { eloRating: input.owner.rating, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
  );
  return { kind: "challenge", label: copy.pages.CHALLENGE_PRIMARY, stakes: copy.pages.profileStakes(copy.LANGUAGE_WORDS, stakes.win, stakes.draw, stakes.loss) };
}
