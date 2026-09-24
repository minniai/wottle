import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/en/profile/k%C3%A1ri" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions/challenge/send", () => ({ sendChallengeAction: vi.fn(async () => ({ status: "sent", inviteId: "i" })) }));

import { publicProfileView } from "@/app/[locale]/dev/page/fixtures";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { ProfilePublicPage } from "@/components/profile/ProfilePublicPage";
import type { PublicPrimary } from "@/lib/profile/publicPrimary";

const HERE = { state: "here" as const, movesPlayed: null };
const CHALLENGE: PublicPrimary = { kind: "challenge", label: "challenge ▸", stakes: "english words · win +7 · draw −1 · loss −9" };

function renderPublic(model: PublicPrimary = CHALLENGE, signedIn = true, presence = HERE) {
  return render(
    <LocaleProvider locale="en">
      <ProfilePublicPage view={publicProfileView()} signedIn={signedIn} fixture={{ presence, model }} />
    </LocaleProvider>,
  );
}

/** Spec 072 T068: another player's profile (E2). */
describe("ProfilePublicPage", () => {
  it("draws the owner in their seat colour, with a presence word and no time", () => {
    renderPublic();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kári");
    expect(screen.getByTestId("profile-rating").className).toContain("seat-opp");
    expect(screen.getByTestId("profile-page").getAttribute("data-seat")).toBe("opp");
    expect(screen.getByTestId("profile-presence").textContent).toBe("here now");
    expect(screen.getAllByTestId("word-strip")[0].getAttribute("data-seat")).toBe("opp");
  });

  it("makes challenge ▸ the one primary, with the viewer's stakes beneath", () => {
    renderPublic();
    expect(document.querySelectorAll(".page-primary")).toHaveLength(1);
    expect(screen.getByTestId("profile-challenge").textContent).toBe("challenge ▸");
    expect(screen.getByTestId("profile-stakes").textContent).toBe("english words · win +7 · draw −1 · loss −9");
  });

  it("opens the composer in column B, and not now closes it", () => {
    renderPublic();
    fireEvent.click(screen.getByTestId("profile-challenge"));
    expect(screen.getByTestId("composer")).not.toBeNull();
    fireEvent.click(screen.getByTestId("composer-not-now"));
    expect(screen.queryByTestId("composer")).toBeNull();
  });

  it("shows the sent state, and no primary when the player cannot be challenged", () => {
    renderPublic({ kind: "sent", label: "sent · 0:41" });
    expect(screen.getByTestId("profile-sent").textContent).toBe("sent · 0:41");
    expect(document.querySelectorAll(".page-primary")).toHaveLength(0);
  });

  it("lists your matches against them with review, and never a head-to-head, block or report", () => {
    renderPublic();
    const rows = within(screen.getByTestId("profile-matches")).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    expect(screen.queryByText(/you and/i)).toBeNull();
    expect(screen.queryByText(/block|report/i)).toBeNull();
  });

  it("offers a signed-out visitor the lobby, draws the owner in --you, and lists no matches", () => {
    renderPublic({ kind: "enterLobby", label: "enter the lobby ▸" }, false);
    expect(screen.getByTestId("profile-page").getAttribute("data-seat")).toBe("you");
    expect(screen.getByTestId("profile-enter-lobby").getAttribute("href")).toBe("/en?next=%2Fen%2Fprofile%2Fk%25C3%25A1ri");
    expect(screen.queryByTestId("profile-matches")).toBeNull();
  });
});
