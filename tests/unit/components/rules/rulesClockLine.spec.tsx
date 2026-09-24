import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RulesEn } from "@/components/rules/content/en";
import { RulesIs } from "@/components/rules/content/is";
import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";

/** Spec 072 T086 (FR-062): the rules describe the clock as it is drawn today, and have no `10moves`. */
describe("the rules' clock line", () => {
  it.each([
    ["en", () => render(<RulesEn clock="5:00" totalMoves={10} copy={copyEn} />), /darkens/, /it blinks/],
    ["is", () => render(<RulesIs clock="5:00" totalMoves={10} copy={copyIs} />), /dökknar/, /blikkar hún/],
  ])("%s: the clock darkens under a minute and never blinks", (_lang, renderRules, darkens, blinks) => {
    const { container } = renderRules();
    const text = container.textContent ?? "";
    expect(text).toMatch(darkens);
    expect(text).not.toMatch(blinks);
    expect(text).not.toMatch(/\d+moves/);
  });
});
