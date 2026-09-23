"use client";

import Link from "next/link";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";

/** Three numbered lines and the rules, once on the door (A1). */
export function HowItPlays() {
  const copy = useCopy();
  const to = useLocalePath();
  return (
    <section className="door-how" aria-labelledby="door-how-label">
      <h2 id="door-how-label" className="page-caption">{copy.pages.HOW_IT_PLAYS}</h2>
      <ol className="door-how__steps">
        {copy.pages.STEPS.map((step, i) => (
          <li key={step} className="door-how__step">
            <span className="page-label">{i + 1}</span>
            <span className="door-how__text">{step}</span>
          </li>
        ))}
      </ol>
      <Link href={to("/rules")} className="page-link page-link--ink">
        {copy.HOW_TO_PLAY}
      </Link>
    </section>
  );
}
