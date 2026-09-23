import "server-only";

import type { cookies } from "next/headers";

import { deviceCookieOptions, DEVICE_COOKIE_NAME, SIGNED_OUT_COOKIE_NAME } from "./cookies";
import { newDeviceKey } from "./deviceKey";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** The key this browser holds, or a new one to claim with (it is kept only if entering succeeds). */
export function deviceKeyFor(store: CookieStore): string {
  return store.get(DEVICE_COOKIE_NAME)?.value || newDeviceKey();
}

/** This browser entered as a player: keep its key a year from now, and it is signed in again. */
export function rememberEntry(store: CookieStore, deviceKey: string): void {
  store.set(DEVICE_COOKIE_NAME, deviceKey, deviceCookieOptions());
  store.delete(SIGNED_OUT_COOKIE_NAME);
}
