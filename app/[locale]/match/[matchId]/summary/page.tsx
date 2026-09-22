import { redirect } from "next/navigation";

import { localePath } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";

/** The post-game screen is the room's final state (spec 044 US9); this route only forwards. */
export default async function MatchSummaryRedirect({
  params,
}: {
  params: Promise<{ matchId: string; locale?: string }> | { matchId: string; locale?: string };
}) {
  const resolved = await params;
  const locale = await readLocaleParam(resolved);
  redirect(localePath(locale, `/match/${resolved.matchId}`));
}
