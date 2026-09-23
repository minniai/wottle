import type { ErrorCode } from "@/lib/i18n/copy/types";

const MOVE_REFUSALS: Record<string, ErrorCode> = {
  ended: "move_ended",
  not_started: "move_not_started",
  deadline: "move_deadline",
  cap: "move_cap",
  in_flight: "move_in_flight",
};

/** A move the server did not take, as a code the page words in its own language (spec 060 research R4). */
export function moveErrorCode(httpStatus: number, body: { reason?: string }): ErrorCode {
  if (httpStatus === 429) return "rate_limited";
  return (body.reason && MOVE_REFUSALS[body.reason]) || "move_failed";
}

/**
 * Why a sign-in failed. Matched by error name rather than class so the room's
 * client code can share this module without importing server-only code.
 */
export function loginErrorCode(error: unknown): ErrorCode {
  const name = error instanceof Error ? error.name : "";
  if (name === "RateLimitExceededError") return "rate_limited";
  if (name === "LoginValidationError") return "invalid_name";
  if (name === "NameTakenError") return "name_taken";
  return "login_failed";
}
