import type { Locale } from "@/lib/i18n/locales";

const rules = new Map<Locale, Intl.PluralRules>();

/** The form of a count in a locale; Icelandic is singular for numbers ending in 1, except 11. */
export function plural(locale: Locale, n: number, forms: { one: string; other: string }): string {
  let rule = rules.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(locale);
    rules.set(locale, rule);
  }
  return rule.select(n) === "one" ? forms.one : forms.other;
}
