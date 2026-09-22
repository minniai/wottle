"use client";

import Link from "next/link";

import { useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";

/** Any path the router cannot place, including an unregistered language prefix. */
export default function NotFound() {
  const { wordmark } = useLocale();
  const home = useLocalePath()("/");
  return (
    <main className="room">
      <div className="ledger__live-row">
        <Link href={home}>{wordmark} ▸</Link>
      </div>
    </main>
  );
}
