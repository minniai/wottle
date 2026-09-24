/**
 * The `?next=` a door redirect carries (spec 070 FR-004; game flow §7.5
 * invariant 12). Only a same-origin relative path to a known page survives:
 * it starts with `/` but not `//`, holds no backslash or dot segment, and,
 * with its locale prefix stripped, names the lobby, a profile, the rules or a
 * match. Anything else is dropped, and the player lands in the lobby.
 */
const LOCALE_PREFIX = /^\/en(?=\/|$)/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KNOWN_PAGES = [/^\/$/, /^\/rules$/, /^\/profile$/, /^\/profile\/[^/]+$/, new RegExp(`^/match/${UUID}$`, "i")];

function isSafeShape(raw: string): boolean {
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  if (raw.includes("\\")) return false;
  return !raw.split(/[?#]/)[0].split("/").some((segment) => segment === ".." || segment === ".");
}

export function nextParam(raw: string | null | undefined): string | null {
  if (!raw || !isSafeShape(raw)) return null;
  const path = raw.split(/[?#]/)[0].replace(LOCALE_PREFIX, "") || "/";
  return KNOWN_PAGES.some((page) => page.test(path)) ? raw : null;
}
