import type { Copy } from "@/lib/i18n/copy/types";
import type { IncomingCall } from "@/lib/types/standing";

import type { Notice } from "./ledgerTypes";

/**
 * The line a call takes on the result screen once the slip is lifted (spec 070
 * T089, game flow B6). A rematch outranks a third party's call; until stage 5
 * brings the rematch here, it is always null.
 */
export function ledgerCallLine(rematch: Notice | null, call: IncomingCall | null, copy: Copy): Notice | null {
  if (rematch) return rematch;
  if (!call) return null;
  return { kind: "call", inviteId: call.inviteId, text: copy.pages.callLine1(call.from.displayName) };
}
