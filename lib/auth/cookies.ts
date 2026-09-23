import "server-only";

/** The three cookies identity rests on (spec 067, data-model.md § Cookies). */
export const SESSION_COOKIE_NAME = "wottle-playtest-session";
export const DEVICE_COOKIE_NAME = "wottle-device";
export const SIGNED_OUT_COOKIE_NAME = "wottle-signed-out";

export const SESSION_TTL_SECONDS = 4 * 60 * 60;
const YEAR_SECONDS = 365 * 24 * 60 * 60;

export interface IdentityCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
  path: "/";
}

export function sessionCookieOptions(): IdentityCookieOptions {
  return optionsFor(SESSION_TTL_SECONDS);
}

export function deviceCookieOptions(): IdentityCookieOptions {
  return optionsFor(YEAR_SECONDS);
}

export function signedOutCookieOptions(): IdentityCookieOptions {
  return optionsFor(YEAR_SECONDS);
}

function optionsFor(maxAge: number): IdentityCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: shouldUseSecureCookies(), maxAge, path: "/" };
}

const TRUTHY = ["1", "true", "on", "yes", "enabled"];
const FALSY = ["0", "false", "off", "no", "disabled"];

/** `PLAYTEST_SESSION_SECURE` decides when set; CI serves plain http; otherwise production only. */
function shouldUseSecureCookies(): boolean {
  const raw = process.env.PLAYTEST_SESSION_SECURE?.trim().toLowerCase();
  if (raw && TRUTHY.includes(raw)) return true;
  if (raw && FALSY.includes(raw)) return false;
  if (process.env.CI === "true" || process.env.CI === "1") return false;
  return process.env.NODE_ENV === "production";
}
