"use client";

import { createContext, useContext, type MouseEvent } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { useActivationGuard } from "@/components/room/hooks/useActivationGuard";

/**
 * The profiles of the room's two seats. While a match is not over (the table, the
 * 3·2·1, a live match) a profile opens in a new tab, so a name never leaves the match.
 */
export interface RoomProfiles {
  you?: string;
  opp?: string;
  newTab: boolean;
}

const RoomProfilesContext = createContext<RoomProfiles>({ newTab: false });

export const RoomProfilesProvider = RoomProfilesContext.Provider;

interface ProfileNameProps {
  name: string;
  href?: string;
  newTab: boolean;
  className?: string;
  testId?: string;
  /** On a slip: ignore a click in the 500ms after it appears (game flow §5.0). */
  guarded?: boolean;
}

/** A player's name: a link to their profile when there is one, else the name. */
export function ProfileName({ name, href, newTab, className, testId, guarded = false }: ProfileNameProps) {
  const { profileOpensInNewTab } = useCopy();
  const ready = useActivationGuard(`profile:${href ?? ""}`);
  if (!href) return <span className={className} data-testid={testId}>{name}</span>;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (guarded && !ready()) event.preventDefault();
  };
  return (
    <a
      className={className ? `${className} name-link` : "name-link"}
      data-testid={testId}
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      aria-label={newTab ? profileOpensInNewTab(name) : undefined}
      onClick={onClick}
    >
      {name}
    </a>
  );
}

/** A seat's name in the room, linked to the profile the room provides for that seat. */
export function SeatName({ seat, ...rest }: { seat: "you" | "opp" } & Omit<ProfileNameProps, "href" | "newTab">) {
  const profiles = useContext(RoomProfilesContext);
  return <ProfileName {...rest} href={profiles[seat]} newTab={profiles.newTab} />;
}
