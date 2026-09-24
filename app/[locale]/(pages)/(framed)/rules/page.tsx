import type { Metadata } from "next";

import { RulesEn } from "@/components/rules/content/en";
import { RulesIs } from "@/components/rules/content/is";
import type { RulesContentProps } from "@/components/rules/content/types";
import { RulesPrimary } from "@/components/rules/RulesPrimary";
import { matchPathParam } from "@/lib/auth/nextParam";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, type Locale } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import { formatClock, MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";
import "@/app/styles/rules.css";

const CONTENT: Record<Locale, (props: RulesContentProps) => React.ReactNode> = { is: RulesIs, en: RulesEn };

interface RulesPageProps {
  params?: LocaleParams;
  searchParams?: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: RulesPageProps = {}): Promise<Metadata> {
  const locale = await readLocaleParam(params);
  const copy = getCopy(locale);
  return { title: copy.rulesMetaTitle(getLocale(locale).wordmark), description: copy.RULES_DESCRIPTION };
}

/**
 * The rules (spec 048 US5, spec 072 E3): the one page outside the room that
 * teaches, in the page frame with its line slot. Its primary depends on how
 * you came: from a match (`?from=`) it closes its own tab. The prose is
 * written once per language (spec 060).
 */
export default async function RulesPage({ params, searchParams }: RulesPageProps = {}) {
  const locale = await readLocaleParam(params);
  const [session, query] = await Promise.all([readLobbySession(), searchParams ?? Promise.resolve({ from: undefined })]);
  const Content = CONTENT[locale];
  return (
    <div className="rules" data-testid="rules-page">
      <Content clock={formatClock(MATCH_CLOCK_BUDGET_MS)} totalMoves={TOTAL_MOVES} copy={getCopy(locale)} />
      <RulesPrimary signedIn={Boolean(session)} from={matchPathParam(query.from)} />
    </div>
  );
}
