"use client";

import { ProfileNotice } from "@/components/profile/ProfileNotice";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getCopy } from "@/lib/i18n/getCopy";

/** An unknown handle (spec 072 FR-046): one sentence, the way back, and a 404. */
export default function NoSuchPlayer() {
  const { id: locale } = useLocale();
  return <ProfileNotice locale={locale} text={getCopy(locale).pages.NO_SUCH_PLAYER} testId="profile-not-found" />;
}
