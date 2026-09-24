import { redirect } from "next/navigation";

import { localePath } from "@/lib/i18n/locales";
import { readLocaleParam } from "@/lib/i18n/params";

/** Spec 071 (FR-041): the old summary is the match's review, at its last step. */
export default async function MatchSummaryRedirect({
  params,
}: {
  params: Promise<{ matchId: string; locale?: string }> | { matchId: string; locale?: string };
}) {
  const resolved = await params;
  const locale = await readLocaleParam(resolved);
  redirect(localePath(locale, `/match/${resolved.matchId}?review=last`));
}
