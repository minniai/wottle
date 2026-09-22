import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { LedgerFoot } from "@/components/room/LedgerFoot";

/** Spec 060 US5: one link in the lobby and final feet to the other language; none during a match. */
describe("LedgerFoot language link", () => {
  it("in the English lobby it offers íslenska ▸ to the same page unprefixed", () => {
    render(<LocaleProvider locale="en"><LedgerFoot variant="lobby" onAction={() => {}} /></LocaleProvider>);
    const link = screen.getByTestId("ledger-language");
    expect(link).toHaveTextContent("íslenska ▸");
    expect(link).toHaveAttribute("href", "/lobby");
    expect(link).toHaveAttribute("lang", "is");
  });

  it("in the Icelandic lobby it offers english ▸ to /en", () => {
    render(<LocaleProvider locale="is"><LedgerFoot variant="lobby" onAction={() => {}} /></LocaleProvider>);
    const link = screen.getByTestId("ledger-language");
    expect(link).toHaveTextContent("english ▸");
    expect(link).toHaveAttribute("href", "/en/lobby");
  });

  it("after a match it leads to the other language's lobby, since a match keeps its own language", () => {
    render(<LocaleProvider locale="en"><LedgerFoot variant="final" onAction={() => {}} /></LocaleProvider>);
    expect(screen.getByTestId("ledger-language")).toHaveAttribute("href", "/lobby");
  });

  it("a live match offers no language link", () => {
    render(<LocaleProvider locale="en"><LedgerFoot variant="match" onAction={() => {}} /></LocaleProvider>);
    expect(screen.queryByTestId("ledger-language")).toBeNull();
  });
});
