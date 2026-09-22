import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import type { Copy } from "@/lib/i18n/copy/types";
import type { Locale } from "@/lib/i18n/locales";

const COPY: Record<Locale, Copy> = { is: copyIs, en: copyEn };

export function getCopy(locale: Locale): Copy {
  return COPY[locale];
}
