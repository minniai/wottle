import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const lobbyCss = readFileSync(
  resolve(__dirname, "../../../app/styles/lobby.css"),
  "utf-8",
);

describe("lobby.css light-mode flip", () => {
  test("does not hard-code the dark navy base colour #0B1220", () => {
    expect(lobbyCss).not.toMatch(/#0B1220/i);
  });

  test("does not hard-code the intermediate navy #0A1220", () => {
    expect(lobbyCss).not.toMatch(/#0A1220/i);
  });

  test("does not hard-code the deep navy #07101B", () => {
    expect(lobbyCss).not.toMatch(/#07101B/i);
  });

  test("references var(--paper) at least once", () => {
    expect(lobbyCss).toMatch(/var\(--paper\)/);
  });

  test("references var(--ochre-tint) for halos", () => {
    expect(lobbyCss).toMatch(/var\(--ochre-tint\)/);
  });
});
