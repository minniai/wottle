import { describe, expect, test } from "vitest";

import { getSeatColors, resolveSeat, seatForSlot } from "@/lib/constants/seatColors";

describe("seat colours (design system §2)", () => {
  test("viewer's own slot resolves to you, the other to opp", () => {
    expect(resolveSeat("player_a", "player_a")).toBe("you");
    expect(resolveSeat("player_a", "player_b")).toBe("opp");
    expect(resolveSeat("player_b", "player_b")).toBe("you");
    expect(resolveSeat("player_b", "player_a")).toBe("opp");
  });

  test("read-only viewer (no slot) colours player A as you and player B as opp", () => {
    expect(seatForSlot(null, "player_a")).toBe("you");
    expect(seatForSlot(null, "player_b")).toBe("opp");
  });

  test("colours are CSS variable references to the seven-token set", () => {
    expect(getSeatColors("you")).toEqual({
      ink: "var(--you)",
      band: "var(--you-band)",
      live: "var(--you-live)",
    });
    expect(getSeatColors("opp")).toEqual({
      ink: "var(--opp)",
      band: "var(--opp-band)",
      live: "var(--opp-live)",
    });
  });
});
