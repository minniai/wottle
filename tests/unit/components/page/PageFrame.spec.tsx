import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }), usePathname: () => "/en" }));
vi.mock("@/app/actions/auth/logout", () => ({ logoutAction: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { PageFrame } from "@/components/page/PageFrame";

const viewer = { displayName: "Birna", handle: "birna" };

function renderIn(locale: "is" | "en", ui: React.ReactElement) {
  return render(<LocaleProvider locale={locale}>{ui}</LocaleProvider>);
}

/** Spec 070 FR-002, game flow §5.0: a page on the room's grid, with no field. */
describe("PageFrame", () => {
  it("has the three landmarks and names its place in the folio", () => {
    renderIn("en", <PageFrame variant="signedIn" place="lobby" viewer={viewer} otherLobbyHere={12}><h1>Birna</h1></PageFrame>);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("contentinfo").textContent).toBe("Wottle · lobby");
  });

  it("orders the signed-in masthead: the strip home, then how to play, the other lobby, you and ⋯", () => {
    renderIn("is", <PageFrame variant="signedIn" place="lobby" viewer={viewer} otherLobbyHere={7}><h1>Birna</h1></PageFrame>);
    const banner = screen.getByRole("banner");
    const home = within(banner).getByRole("link", { name: /orðusta/i });
    expect(home.getAttribute("href")).toBe("/");
    const nav = within(banner).getByTestId("masthead-nav");
    const labels = Array.from(nav.querySelectorAll("a, button")).map((el) => el.textContent?.trim());
    expect(labels).toEqual(["leiðbeiningar ▸", "english · 7 here ▸", "Birna ▸", "⋯"]);
    const other = within(nav).getByText("english · 7 here ▸");
    expect(other.getAttribute("lang")).toBe("en");
    expect(other.getAttribute("href")).toBe("/en");
    expect(within(nav).getByText("Birna ▸").getAttribute("href")).toBe("/profile");
  });

  it("reserves the line slot's height on signed-in pages even when it is empty", () => {
    renderIn("en", <PageFrame variant="signedIn" place="lobby" viewer={viewer} otherLobbyHere={0}><h1>Birna</h1></PageFrame>);
    const slot = screen.getByTestId("line-slot");
    expect(slot.className).toContain("page-slot");
  });

  it("draws no line slot on the door, and puts the language switch first in tab order", () => {
    renderIn("is", <PageFrame variant="door" place={null} doorCount="4 hér núna · 2 viðureignir í gangi"><h1>Tveir leikmenn</h1></PageFrame>);
    expect(screen.queryByTestId("line-slot")).toBeNull();
    const banner = screen.getByRole("banner");
    expect(within(banner).getByText("4 hér núna · 2 viðureignir í gangi")).toBeTruthy();
    const current = within(banner).getByText("íslenska");
    expect(current.getAttribute("aria-current")).toBe("true");
    const other = within(banner).getByRole("link", { name: "english ▸" });
    expect(other.getAttribute("lang")).toBe("en");
    const focusables = banner.querySelectorAll("a, button");
    expect(focusables[0]).toBe(other);
    expect(screen.getByRole("contentinfo").textContent).toBe("Orðusta");
  });

  it("moves the switch to a preference line when the browser prefers the other language", () => {
    renderIn("is", <PageFrame variant="door" place={null} doorCount={null} preferOther><h1>Tveir leikmenn</h1></PageFrame>);
    const banner = screen.getByRole("banner");
    expect(within(banner).queryByText("íslenska")).toBeNull();
    expect(screen.getByRole("link", { name: "Prefer English? · English ▸" }).getAttribute("href")).toBe("/en");
  });
});
