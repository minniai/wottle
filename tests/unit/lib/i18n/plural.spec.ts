import { describe, expect, test } from "vitest";

import { plural } from "@/lib/i18n/plural";

const forms = { one: "stig", other: "stig·fleir" };

describe("plural", () => {
  test("Icelandic takes the singular for numbers ending in 1, except 11", () => {
    for (const n of [1, 21, 31, 101]) expect(plural("is", n, forms)).toBe("stig");
    for (const n of [0, 2, 5, 11, 111, 12]) expect(plural("is", n, forms)).toBe("stig·fleir");
  });

  test("English takes the singular for 1 only", () => {
    expect(plural("en", 1, forms)).toBe("stig");
    for (const n of [0, 2, 21]) expect(plural("en", n, forms)).toBe("stig·fleir");
  });
});
