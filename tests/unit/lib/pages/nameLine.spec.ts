import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { nameLine } from "@/lib/pages/nameLine";

const en = getCopy("en");
const is = getCopy("is");

/** The door's name line: the rule until the name breaks it, then what broke it. */
describe("nameLine", () => {
  it("shows the rule, not as an error, while the name is empty or fine", () => {
    expect(nameLine(en, { name: "", blurred: true, serverError: null })).toEqual({ text: "3 to 24 letters, digits, - or _", error: false });
    expect(nameLine(en, { name: "birna", blurred: true, serverError: null })).toEqual({ text: "3 to 24 letters, digits, - or _", error: false });
  });

  it("names a space or a symbol as soon as it is typed", () => {
    expect(nameLine(en, { name: "ari jo", blurred: false, serverError: null })).toEqual({ text: "no spaces or symbols · letters, digits, - and _", error: true });
    expect(nameLine(is, { name: "ari!", blurred: false, serverError: null }).text).toBe("ekkert bil eða tákn · bara stafir, tölur, - og _");
  });

  it("says a name is too short only once the field is left", () => {
    expect(nameLine(en, { name: "ab", blurred: false, serverError: null }).error).toBe(false);
    expect(nameLine(en, { name: "ab", blurred: true, serverError: null })).toEqual({ text: "at least 3 characters", error: true });
  });

  it("names a long name", () => {
    expect(nameLine(is, { name: "a".repeat(25), blurred: false, serverError: null })).toEqual({ text: "mest 24 stafir", error: true });
  });

  it("puts the server's answer first", () => {
    expect(nameLine(en, { name: "birna", blurred: true, serverError: "name_taken" })).toEqual({ text: "that name is taken · pick another", error: true });
  });
});
