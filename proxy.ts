import { NextResponse, type NextRequest } from "next/server";

import { applyRenewal, renewSession } from "@/lib/auth/renewal";
import { decideLocaleRoute } from "@/lib/i18n/routing";

/**
 * Renews a lapsed session from the device key (spec 067), then serves the default
 * locale unprefixed and every other locale under its segment (spec 060).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const renewal = await renewSession(request);
  const response = routeOf(request);
  applyRenewal(renewal, response);
  return response;
}

function routeOf(request: NextRequest): NextResponse {
  // A renewed session was set on the request's cookies; passing its headers on
  // lets the page, action or route behind this read it in the same request.
  const forward = { request: { headers: request.headers } };
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next(forward);
  const decision = decideLocaleRoute(request.nextUrl.pathname);
  if (decision.kind === "next") return NextResponse.next(forward);
  const url = request.nextUrl.clone();
  url.pathname = decision.to;
  return decision.kind === "redirect" ? NextResponse.redirect(url, decision.status) : NextResponse.rewrite(url, forward);
}

export const config = {
  // Every page, server action and API route, so a lapsed session renews wherever it is noticed.
  matcher: ["/((?!_next|.*\\..*).*)"],
};
