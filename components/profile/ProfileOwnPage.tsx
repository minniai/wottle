"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { FormStrip } from "@/components/page/lobby/FormStrip";
import { useStandingSlot } from "@/components/standing/standingContext";
import { localePath, type Locale } from "@/lib/i18n/locales";
import type { PagePrimaryModel } from "@/lib/pages/pagePrimary";
import type { ProfileView } from "@/lib/types/profile";

import { BestWords, languageNameOf, ProfileChart, ProfileHeader, ProfileMatches, RecordRow } from "./ProfileParts";

/** Column B's primary: `find an opponent ▸`, a secondary while a call is up (E1). */
function FindPrimary({ override }: { override?: PagePrimaryModel }) {
  const copy = useCopy();
  const to = useLocalePath();
  const router = useRouter();
  const machine = useStandingSlot().machine;
  const model = override ?? (machine ? machine.primaryFor(false) : { find: "primary" as const, note: null });
  if (model.find === "hidden") return model.note ? <p className="page-label">{model.note}</p> : null;
  const find = () => {
    machine?.search.start();
    router.push(to("/"));
  };
  return (
    <div className="profile-primary">
      <button type="button" className={model.find === "primary" ? "action-primary page-primary" : "page-link page-link--ink"} onClick={find} data-testid="profile-find">
        {copy.FIND_OPPONENT}
      </button>
      {model.note ? <p className="page-label">{model.note}</p> : null}
    </div>
  );
}

/** The other language's profile, or that there is none yet. */
function OtherLanguage({ view }: { view: ProfileView }) {
  const copy = useCopy();
  const { language, rating, matches } = view.otherLanguage;
  if (matches === 0) return <p className="page-label profile-other">{copy.pages.OTHER_LANGUAGE_EMPTY[language as "is" | "en"]}</p>;
  return (
    <p className="profile-other">
      <span className="page-label">{languageNameOf(language, copy)}</span>
      <Link href={localePath(language as Locale, "/profile")} className="page-link page-link--ink" data-testid="profile-other-language">{`${rating} ▸`}</Link>
    </p>
  );
}

/** `sign out`, with the lobby's consequence line; refused while a match is live (spec 067). */
function SignOut() {
  const copy = useCopy();
  const to = useLocalePath();
  const router = useRouter();
  const { signOut } = useStandingSlot();
  const [refused, setRefused] = useState(false);
  const leave = () =>
    void logoutAction().then((r) => {
      if (r.status === "refused") return setRefused(true);
      router.replace(to("/"));
      router.refresh();
    });
  // Spec 067: during a live match sign-out is not offered here at all; the reason stands in its place.
  if (signOut.disabledReason || refused) return <p className="page-label profile-sign-out">{signOut.disabledReason ?? copy.pages.FINISH_FIRST}</p>;
  return (
    <div className="profile-sign-out">
      <button type="button" className="page-link page-link--ink" onClick={leave} data-testid="profile-sign-out">
        {copy.SIGN_OUT}
      </button>
      {signOut.consequence ? <span className="page-label">{signOut.consequence}</span> : null}
    </div>
  );
}

/**
 * Your profile (spec 072 US5, game flow E1, F9): your rating in this language,
 * how it moved in 30 days, your last ten, your record and your best words;
 * then find, your recent matches, the other language and sign out.
 */
export function ProfileOwnPage({ view, primary }: { view: ProfileView; primary?: PagePrimaryModel }) {
  const copy = useCopy();
  return (
    <div className="page-columns profile" data-seat="you" data-testid="profile-page">
      <div className="page-col-a">
        <ProfileHeader view={view} seat="you" />
        <ProfileChart points={view.chart} empty={view.chartEmpty} seat="you" />
        <FormStrip results={view.lastTen} />
        <RecordRow view={view} />
        <BestWords view={view} seat="you" />
      </div>
      <div className="page-col-b">
        <FindPrimary override={primary} />
        <ProfileMatches rows={view.matchesList} caption={copy.RECENT_MATCHES} dated={false} />
        <OtherLanguage view={view} />
        <SignOut />
      </div>
    </div>
  );
}
