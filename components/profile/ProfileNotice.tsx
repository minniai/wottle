import Link from "next/link";

import { getCopy } from "@/lib/i18n/getCopy";
import { localePath, type Locale } from "@/lib/i18n/locales";

/** A profile that cannot be shown (not found, or the read failed): one sentence on the page, and the way back. */
export function ProfileNotice({ locale, text, testId }: { locale: Locale; text: string; testId: string }) {
  const copy = getCopy(locale);
  return (
    <section className="profile-notice">
      <p className="page-sentence" data-testid={testId}>
        {text}
      </p>
      <Link className="page-link page-link--ink" href={localePath(locale, "/")}>
        {copy.BACK_LOBBY}
      </Link>
    </section>
  );
}
