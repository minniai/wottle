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

  test("colours are CSS variable references to the palette", () => {
    expect(getSeatColors("you")).toEqual({
      ink: "var(--you)",
      band: "var(--you-band)",
      live: "var(--you-live)",
      text: "var(--you)",
    });
    expect(getSeatColors("opp")).toEqual({
      ink: "var(--opp)",
      band: "var(--opp-band)",
      live: "var(--opp-live)",
      text: "var(--opp-text)",
    });
  });

  test("gives the opponent a text colour that passes AA below 17px (spec 045 decision 2)", () => {
    // Teal is 4.9:1 on paper and needs no variant; coral is 3.4:1 and does.
    expect(getSeatColors("you").text).toBe("var(--you)");
    expect(getSeatColors("opp").text).toBe("var(--opp-text)");
  });

  test("keeps ink for everything that is not small text", () => {
    expect(getSeatColors("opp").ink).toBe("var(--opp)");
    expect(getSeatColors("you").ink).toBe("var(--you)");
  });
});
