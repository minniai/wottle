import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PlayerAvatar } from "@/components/match/PlayerAvatar";

describe("PlayerAvatar", () => {
  test("renders img when avatarUrl is provided", () => {
    render(
      <PlayerAvatar
        displayName="Alice"
        avatarUrl="https://example.com/alice.png"
        playerColor="#38BDF8"
        size="md"
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/alice.png");
    expect(img).toHaveAttribute("alt", "Alice");
  });

  test("renders first-letter placeholder when avatarUrl is null", () => {
    render(
      <PlayerAvatar
        displayName="Bob"
        avatarUrl={null}
        playerColor="#EF4444"
        size="md"
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  test("applies md size (48px)", () => {
    const { container } = render(
      <PlayerAvatar
        displayName="Alice"
        avatarUrl={null}
        playerColor="#38BDF8"
        size="md"
      />,
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar.style.width).toBe("48px");
    expect(avatar.style.height).toBe("48px");
  });

  test("applies sm size (32px)", () => {
    const { container } = render(
      <PlayerAvatar
        displayName="Alice"
        avatarUrl={null}
        playerColor="#38BDF8"
        size="sm"
      />,
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar.style.width).toBe("32px");
    expect(avatar.style.height).toBe("32px");
  });

  test("uses playerColor as background for placeholder", () => {
    const { container } = render(
      <PlayerAvatar
        displayName="Zara"
        avatarUrl={null}
        playerColor="#EF4444"
        size="md"
      />,
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar.style.backgroundColor).toBe("rgb(239, 68, 68)");
    expect(screen.getByText("Z")).toBeInTheDocument();
  });

  test("handles empty displayName gracefully", () => {
    const { container } = render(
      <PlayerAvatar
        displayName=""
        avatarUrl={null}
        playerColor="#38BDF8"
        size="md"
      />,
    );

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
