"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { MastheadViewer } from "./Masthead";
import { PageFrame } from "./PageFrame";
import type { PagePlace } from "./Folio";
import { useStandingSlot } from "@/components/standing/StandingProvider";
import { readHandle } from "@/lib/profile/readHandle";

function placeOf(pathname: string): PagePlace {
  return /\/rules$/.test(pathname) ? "rules" : "profile";
}

/** Whose profile this is, for the folio: the handle in the path, or the viewer's own. */
function folioDetail(pathname: string, viewer: MastheadViewer | null): string | null {
  const handle = /\/profile\/([^/]+)$/.exec(pathname)?.[1];
  if (handle) return readHandle(handle);
  return /\/profile$/.test(pathname) ? (viewer?.handle ?? null) : null;
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
      bottomSlot={standing.bottomSlot}
      bottomHeight={standing.bottomHeight}
      skipLabel={standing.skipLabel}
      folioDetail={folioDetail(pathname, viewer)}
    >
      {children}
    </PageFrame>
  );
}
