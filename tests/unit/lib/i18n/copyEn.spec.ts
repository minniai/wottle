import { describe, expect, test } from "vitest";

import { copyEn as copy } from "@/lib/i18n/copy/en";

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") {
    // Exercise formatters with representative arguments.
    const fn = value as (...args: unknown[]) => unknown;
    const sample = fn("Kári", 2, "1:29", 170, 127);
    if (typeof sample === "string") out.push(sample);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
  return out;
}

describe("copy (design system §8)", () => {
  const strings = collectStrings(copy);

  test("exports at least the fixed strings", () => {
    expect(strings.length).toBeGreaterThan(15);
  });

  test("no exclamation marks anywhere", () => {
    for (const s of strings) expect(s, s).not.toContain("!");
  });

  test("the name is capitalised: Wottle (spec 068)", () => {
    expect(copy.WORDMARK).toBe("Wottle");
  });

  test("clock budget copy reads 5:00", () => {
    expect(copy.QUEUE_CONTEXT).toBe("10 moves each · one 5:00 clock");
  });

  test("formatters interpolate", () => {
    expect(copy.frozenNotice("Kári", 2)).toBe("frozen · Kári M2 · pick another");
    expect(copy.picking("T", 2)).toBe("picking · T (2)");
    expect("moveContext" in copy).toBe(false);
    expect(copy.rematchRequest("Kári")).toBe("Kári asks for a rematch · accept ▸ · decline");
    expect(copy.verdictLine("Kári", 170, 127)).toBe("Kári wins 170–127");
    expect(copy.reconnecting("0:42")).toBe("reconnecting · 0:42 left");
  });

  test("names a missing match in the room's own voice (spec 045 B10)", () => {
    expect(copy.NO_SUCH_MATCH).toBe("that match does not exist");
    expect(copy.NO_SUCH_MATCH).toBe(copy.NO_SUCH_MATCH.toLowerCase());
    expect(copy.NO_SUCH_MATCH).not.toContain("!");
  });
});

describe("the match-over label counts the match (spec 048, spec 050)", () => {
  test("the duration alone; why it ended is the verdict's detail line", () => {
    expect(copy.matchOverLabel("4:52")).toBe("match over · 4:52");
    expect(copy.incompleteDetail("Kári", 8)).toBe("Kári played 8 of 10");
    expect(copy.NEITHER_FINISHED).toBe("neither finished");
  });
});
