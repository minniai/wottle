import type { Metadata } from "next";
import Link from "next/link";

import { RulesEn } from "@/components/rules/content/en";
import { RulesIs } from "@/components/rules/content/is";
import type { RulesContentProps } from "@/components/rules/content/types";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, localePath, type Locale } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import { formatClock, MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";
import "@/app/styles/rules.css";

const CONTENT: Record<Locale, (props: RulesContentProps) => React.ReactNode> = { is: RulesIs, en: RulesEn };

export async function generateMetadata({ params }: { params?: LocaleParams } = {}): Promise<Metadata> {
  const locale = await readLocaleParam(params);
  const copy = getCopy(locale);
  return { title: copy.rulesMetaTitle(getLocale(locale).wordmark), description: copy.RULES_DESCRIPTION };
}

/**
 * The rules, outside the room (spec 048 US5): six sections, three figures in the
 * field's grammar, the scoring table. It reads no session itself; the page frame around it carries the line slot (spec 070).
 * The prose is written once per language (spec 060).
 */
export default async function RulesPage({ params }: { params?: LocaleParams } = {}) {
  const locale = await readLocaleParam(params);
  const home = localePath(locale, "/");
  const lobby = localePath(locale, "/");
  const clock = formatClock(MATCH_CLOCK_BUDGET_MS);
  const copy = getCopy(locale);
  const Content = CONTENT[locale];
  return (
    <div className="rules" data-testid="rules-page">
      <header className="rules__header">
        <Link href={home} className="rules__wordmark">{copy.WORDMARK}</Link>
        <Link href={lobby} className="action-secondary" data-testid="rules-back-top">{copy.BACK_TO_LOBBY}</Link>
      </header>

      <Content clock={clock} totalMoves={TOTAL_MOVES} copy={copy} />

      <footer className="rules__footer">
        <Link href={lobby} className="action-primary" data-testid="rules-play">{copy.FIND_OPPONENT}</Link>
        <Link href={lobby} className="action-secondary" data-testid="rules-back-bottom">{copy.BACK_TO_LOBBY}</Link>
      </footer>
    </div>
  );
}
