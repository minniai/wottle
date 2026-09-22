import { notFound } from "next/navigation";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";

export type LocaleParams = Promise<{ locale?: string }> | { locale?: string } | undefined;

/**
 * The `[locale]` segment of a page or layout. A call without params (a test
 * rendering a page directly) is the default locale; an unregistered segment is
 * a page that does not exist.
 */
export async function readLocaleParam(params: LocaleParams): Promise<Locale> {
  const resolved = (await params) ?? {};
  const value = resolved.locale ?? DEFAULT_LOCALE;
  if (!isLocale(value)) notFound();
  return value;
}
