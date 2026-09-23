import "server-only";

import type { NextRequest, NextResponse } from "next/server";

import { getServiceRoleClient } from "@/lib/supabase/server";

import { resolveClaim } from "./claim";
import {
  deviceCookieOptions,
  DEVICE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  SIGNED_OUT_COOKIE_NAME,
} from "./cookies";
import { hashDeviceKey } from "./deviceKey";
import { requireSessionSecret } from "./sessionSecret";
import { signSession, verifySession } from "./sessionToken";

/**
 * Silent renewal (spec 067 FR-007, research R4): a browser whose session lapsed
 * but whose device key claims a name is signed in again without seeing the door,
 * unless it signed out. Runs in the proxy, the one place every page, action and
 * route passes through, and touches the database only when the session is gone.
 */
export type RenewalOutcome =
  | { kind: "pass" }
  | { kind: "renewed"; session: string; deviceKey: string }
  | { kind: "forget-device" };

export function decideRenewal(input: { sessionValid: boolean; deviceKey: string | null; signedOut: boolean }): "pass" | "resolve" {
  return !input.sessionValid && input.deviceKey && !input.signedOut ? "resolve" : "pass";
}

export async function renewSession(request: NextRequest): Promise<RenewalOutcome> {
  const deviceKey = request.cookies.get(DEVICE_COOKIE_NAME)?.value ?? null;
  const decision = decideRenewal({
    sessionValid: hasValidSession(request),
    deviceKey,
    signedOut: request.cookies.has(SIGNED_OUT_COOKIE_NAME),
  });
  if (decision === "pass" || !deviceKey) return { kind: "pass" };
  return renewFromDevice(request, deviceKey);
}

/** Carries the renewal onto the response, so the browser keeps what this request already used. */
export function applyRenewal(outcome: RenewalOutcome, response: NextResponse): void {
  if (outcome.kind === "renewed") {
    response.cookies.set(SESSION_COOKIE_NAME, outcome.session, sessionCookieOptions());
    response.cookies.set(DEVICE_COOKIE_NAME, outcome.deviceKey, deviceCookieOptions());
  } else if (outcome.kind === "forget-device") {
    response.cookies.set(DEVICE_COOKIE_NAME, "", { ...deviceCookieOptions(), maxAge: 0 });
  }
}

function hasValidSession(request: NextRequest): boolean {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return Boolean(raw) && verifySession(raw!, requireSessionSecret(), Date.now()).ok;
}

async function renewFromDevice(request: NextRequest, deviceKey: string): Promise<RenewalOutcome> {
  try {
    const player = await resolveClaim(getServiceRoleClient(), hashDeviceKey(deviceKey));
    if (!player) {
      console.warn(JSON.stringify({ event: "auth.device.unknown" }));
      request.cookies.delete(DEVICE_COOKIE_NAME);
      return { kind: "forget-device" };
    }
    const issuedAt = Date.now();
    const session = signSession(
      { playerId: player.id, username: player.username, displayName: player.displayName, issuedAt, expiresAt: issuedAt + SESSION_TTL_SECONDS * 1000 },
      requireSessionSecret(),
    );
    // The page, action or route behind this proxy reads the renewed session in this same request.
    request.cookies.set(SESSION_COOKIE_NAME, session);
    console.info(JSON.stringify({ event: "auth.session.renewed", playerId: player.id }));
    return { kind: "renewed", session, deviceKey };
  } catch (error) {
    console.warn(JSON.stringify({ event: "auth.session.renew_failed", error: error instanceof Error ? error.message : String(error) }));
    return { kind: "pass" };
  }
}
