import type { Copy } from "@/lib/i18n/copy/types";

const DAY_MS = 86_400_000;

function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** `today`, `yesterday`, or the date in the page's language (B1's `í gær`). */
export function whenWord(completedAt: string, nowMs: number, copy: Copy, htmlLang: string): string {
  const days = Math.round((dayStart(nowMs) - dayStart(Date.parse(completedAt))) / DAY_MS);
  if (days <= 0) return copy.pages.TODAY;
  if (days === 1) return copy.pages.YESTERDAY;
  return new Intl.DateTimeFormat(htmlLang, { day: "numeric", month: "short" }).format(new Date(completedAt));
}
