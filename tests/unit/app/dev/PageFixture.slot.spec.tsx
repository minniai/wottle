import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en",
}));

import { PageFixture } from "@/app/[locale]/dev/page/PageFixture";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

const renderPhase = (phase: Parameters<typeof PageFixture>[0]["phase"], locale: "en" | "is" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <PageFixture phase={phase} />
    </LocaleProvider>,
  );
const slotLine1 = () => within(screen.getByTestId("line-slot-desktop")).getByTestId("line-slot-line1").textContent;

/** Spec 070 T074, T090, T095, T099: the line slot's states as page fixtures. */
describe("page fixtures with a standing", () => {
  it("challenge-sent: the slot counts Kári's challenge; Hekla's row reads declined with its cooldown", () => {
    renderPhase("challenge-sent");
    expect(slotLine1()).toBe("Challenge sent · Kári · 0:52");
    expect(screen.getByText("sent · 0:52")).toBeTruthy();
    expect(screen.getByText("declined")).toBeTruthy();
  });

  it("is-challenge-in: the call, its skip link first, and the caller's row", () => {
    renderPhase("is-challenge-in", "is");
    expect(slotLine1()).toBe("Kári skorar á þig");
    expect(screen.getByTestId("skip-to-call").textContent).toContain("Kári");
  });

  it("match-running, match-over-away, searching and switch-confirm write their slot", () => {
    for (const [phase, line1] of [
      ["match-running", "Your match · Kári"],
      ["match-over-away", "Your match is over · Birna wins 128–117"],
      ["searching", "Searching for an opponent · 0:07"],
      ["switch-confirm", "you are in the Icelandic lobby"],
    ] as const) {
      const view = renderPhase(phase);
      expect(slotLine1(), phase).toBe(line1);
      view.unmount();
    }
  });
});
