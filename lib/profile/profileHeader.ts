import type { Copy } from "@/lib/i18n/copy/types";
import type { ProfileView } from "@/lib/types/profile";

const signed = (n: number): string => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/**
 * A profile's two sub-lines (spec 072 E1, E2): who, since when and how many
 * matches; then the rating in this language, its peak and the week's change.
 * A player with no match here reads `1200 · rating · english · no matches yet`.
 */
export function profileHeader(view: ProfileView, copy: Copy, languageName: string): { subLeft: string; subRight: string } {
  const handle = `@${view.handle}`;
  if (view.matches === 0 || !view.firstPlayedAt) {
    return { subLeft: handle, subRight: copy.pages.blockSubNew(view.rating, languageName) };
  }
  const first = new Date(view.firstPlayedAt);
  const since = copy.playingSince(copy.monthYear(first.getUTCMonth(), first.getUTCFullYear()));
  return {
    subLeft: `${handle} · ${since} · ${copy.matchesPlayed(view.matches)}`,
    subRight: copy.pages.profileRatingLine(languageName, view.peak, view.weekChange === 0 ? null : signed(view.weekChange)),
  };
}
