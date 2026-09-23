/**
 * Page fixtures (spec 070 T017, R17): every state of the door and the lobby,
 * from static facts, with no database, no session and no second player. The
 * page twin of `/dev/room`. Each phase names the artboard it reproduces.
 */
export const PAGE_PHASES = [] as const;

export type PagePhase = (typeof PAGE_PHASES)[number];

export function isPagePhase(value: string | undefined): value is PagePhase {
  return (PAGE_PHASES as readonly string[]).includes(value ?? "");
}
