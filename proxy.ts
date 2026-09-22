import { NextResponse, type NextRequest } from "next/server";

import { decideLocaleRoute } from "@/lib/i18n/routing";

/** Serves the default locale unprefixed and every other locale under its segment (spec 060). */
export function proxy(request: NextRequest): NextResponse {
  const decision = decideLocaleRoute(request.nextUrl.pathname);
  if (decision.kind === "next") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = decision.to;
  return decision.kind === "redirect"
    ? NextResponse.redirect(url, decision.status)
    : NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
