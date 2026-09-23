import { describe, expect, test } from "vitest";

import { loginErrorCode, moveErrorCode } from "@/lib/i18n/errorCodes";
import { LoginValidationError } from "@/lib/matchmaking/profile";
import { RateLimitExceededError } from "@/lib/rate-limiting/middleware";

describe("error codes (spec 060 research R4)", () => {
  test("a refused move is named by its reason", () => {
    expect(moveErrorCode(400, { reason: "deadline" })).toBe("move_deadline");
    expect(moveErrorCode(400, { reason: "in_flight" })).toBe("move_in_flight");
    expect(moveErrorCode(400, { reason: "cap" })).toBe("move_cap");
    expect(moveErrorCode(400, { reason: "ended" })).toBe("move_ended");
    expect(moveErrorCode(400, { reason: "not_started" })).toBe("move_not_started");
  });

  test("a throttled move is rate limited; anything else is a plain refusal", () => {
    expect(moveErrorCode(429, {})).toBe("rate_limited");
    expect(moveErrorCode(400, { reason: "something-new" })).toBe("move_failed");
    expect(moveErrorCode(500, {})).toBe("move_failed");
  });

  test("a failed sign-in says why in words the page can translate", () => {
    expect(loginErrorCode(new RateLimitExceededError("auth:login", 30, "x"))).toBe("rate_limited");
    expect(loginErrorCode(new LoginValidationError("too short"))).toBe("invalid_name");
    expect(loginErrorCode(new Error("db down"))).toBe("login_failed");
    // Spec 067: another browser holds the name.
    const taken = Object.assign(new Error("taken"), { name: "NameTakenError" });
    expect(loginErrorCode(taken)).toBe("name_taken");
  });
});
