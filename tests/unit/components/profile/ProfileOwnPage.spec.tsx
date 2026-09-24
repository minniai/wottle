import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/profile" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions/auth/logout", () => ({ logoutAction: vi.fn() }));

import { profileView, profileViewNew } from "@/app/[locale]/dev/page/fixtures";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { ProfileOwnPage } from "@/components/profile/ProfileOwnPage";

function renderOwn(view = profileView("is"), primary?: React.ComponentProps<typeof ProfileOwnPage>["primary"]) {
  return render(
    <LocaleProvider locale="is">
      <ProfileOwnPage view={view} primary={primary} />
    </LocaleProvider>,
  );
}

/** Spec 072 T060: your profile (E1). */
describe("ProfileOwnPage", () => {
  it("has one h1, your rating in your colour, and the sub-lines", () => {
    renderOwn();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Birna");
    expect(screen.getByTestId("profile-rating").textContent).toBe("1212");
    expect(screen.getByTestId("profile-rating").className).toContain("seat-you");
    expect(screen.getByTestId("profile-sub-left").textContent).toBe("@birna · spilar síðan mars 2026 · 35 viðureignir");
    expect(screen.getByTestId("profile-sub-right").textContent).toBe("elo · íslenska · hæst 1216 · +16 í vikunni");
  });

  it("shows the chart, the form strip, the record and three best words", () => {
    renderOwn();
    expect(screen.getByTestId("profile-chart")).not.toBeNull();
    expect(screen.getByRole("img", { name: "síðustu tíu: 7 sigrar, 3 töp" })).not.toBeNull();
    const record = screen.getByTestId("profile-record");
    expect(within(record).getAllByRole("cell").map((c) => c.textContent)).toEqual(["20sigrar", "15töp", "0jafntefli", "57%sigurhlutfall"]);
    expect(screen.getAllByTestId("word-strip")).toHaveLength(3);
    expect(screen.getByRole("img", { name: "HESTAR, 32" })).not.toBeNull();
  });

  it("puts find as the primary, eight recent matches with review, the other language and sign out in column B", () => {
    renderOwn();
    expect(screen.getByTestId("profile-find").className).toContain("page-primary");
    const rows = within(screen.getByTestId("profile-matches")).getAllByRole("listitem");
    expect(rows).toHaveLength(8);
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toMatch(/\/match\/.+\?review=last$/);
    expect(screen.getByTestId("profile-other-language").getAttribute("href")).toBe("/en/profile");
    expect(screen.getByTestId("profile-sign-out")).not.toBeNull();
  });

  it("steps find down while a call is up", () => {
    renderOwn(profileView("is"), { find: "secondary", note: null });
    expect(screen.getByTestId("profile-find").className).not.toContain("page-primary");
  });

  it("reads a new player plainly", () => {
    renderOwn(profileViewNew());
    expect(screen.getByTestId("profile-sub-right").textContent).toBe("1200 · elo · enska · engin viðureign enn");
    expect(screen.getAllByText("Fyrsta viðureignin þín birtist hér.").length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId("word-strip")).toHaveLength(0);
  });
});
