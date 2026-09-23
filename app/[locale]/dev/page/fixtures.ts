import type { Overview } from "@/lib/types/standing";

/**
 * Page fixtures (spec 070 T017, R17): every state of the door and the lobby,
 * from static facts, with no database, no session and no second player. The
 * page twin of `/dev/room`. Each phase names the artboard it reproduces; an
 * `is-` phase renders at the unprefixed (Icelandic) path.
 */
export const PAGE_PHASES = ["door", "is-door", "door-returning"] as const;

export type PagePhase = (typeof PAGE_PHASES)[number];

export function isPagePhase(value: string | undefined): value is PagePhase {
  return (PAGE_PHASES as readonly string[]).includes(value ?? "");
}

/** Game flow §5.0 EN-L: the English lobby, four here at the door (DoorEn). */
export const DOOR_EN: Overview = {
  counts: { here: 4, searching: 1, playersInMatch: 2, matchesOn: 2, other: { language: "is", here: 12 } },
  here: [
    { displayName: "Embla", rating: 1342, state: "here" },
    { displayName: "Kári", rating: 1265, state: "here" },
    { displayName: "Sóley", rating: 1418, state: "here" },
    { displayName: "Ragnar", rating: 1196, state: "searching" },
  ],
  more: 0,
};

/** Game flow §5.0 IS-T1: the Icelandic lobby, four here at the door (DoorIs). */
export const DOOR_IS: Overview = {
  counts: { here: 4, searching: 1, playersInMatch: 2, matchesOn: 2, other: { language: "en", here: 7 } },
  here: [
    { displayName: "Embla", rating: 1242, state: "here" },
    { displayName: "Kári", rating: 1179, state: "here" },
    { displayName: "Sóley", rating: 1318, state: "here" },
    { displayName: "Ragnar", rating: 1096, state: "searching" },
  ],
  more: 0,
};
