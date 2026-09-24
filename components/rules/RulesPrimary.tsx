"use client";

import { useRouter } from "next/navigation";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { useStandingSlot } from "@/components/standing/standingContext";
import { rulesPrimary } from "@/lib/pages/pagePrimary";

const CLOSE_FALLBACK_MS = 150;

/**
 * The rules page's one primary (spec 072 FR-061): `close this tab ▸` when
 * opened from a match (and, if the browser keeps the tab open, back to the
 * match), `find an opponent ▸`, or `enter the lobby ▸`.
 */
export function RulesPrimary({ signedIn, from }: { signedIn: boolean; from: string | null }) {
  const copy = useCopy();
  const to = useLocalePath();
  const router = useRouter();
  const { machine } = useStandingSlot();
  const model = rulesPrimary(machine?.slot ?? { kind: "empty" }, copy, { signedIn, from });
  if (model.kind === "none") return null;
  const press = () => {
    if (model.kind === "closeTab") {
      window.close();
      setTimeout(() => router.push(model.back), CLOSE_FALLBACK_MS);
    } else if (model.kind === "find") {
      machine?.search.start();
      router.push(to("/"));
    } else {
      router.push(to("/"));
    }
  };
  return (
    <div className="rules__primary">
      <button type="button" className="action-primary page-primary" onClick={press} data-testid={`rules-${model.kind}`}>
        {model.label}
      </button>
    </div>
  );
}
