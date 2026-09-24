import "server-only";

import { headers } from "next/headers";

/**
 * The site's origin as the browser reached it, for links a player copies
 * (spec 072). A Server Action POST carries `Origin`; otherwise the forwarded
 * host and protocol, as Vercel sets them.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
