"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { MastheadViewer } from "./Masthead";
import { PageFrame } from "./PageFrame";
import type { PagePlace } from "./Folio";
import { useStandingSlot } from "@/components/standing/StandingProvider";

function placeOf(pathname: string): PagePlace {
  return /\/rules$/.test(pathname) ? "rules" : "profile";
}

/** The frame around profile and rules, which share one layout; the folio names the page by its path. */
export function FramedPage({ viewer, children }: { viewer: MastheadViewer | null; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const standing = useStandingSlot();
  return (
    <PageFrame
      variant="signedIn"
      place={placeOf(pathname)}
      viewer={viewer}
      otherLobbyHere={standing.otherLobbyHere}
      slot={standing.slot}
      signOut={standing.signOut}
      menuExtra={standing.menuExtra}
    >
      {children}
    </PageFrame>
  );
}
