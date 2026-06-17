import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  test("uses the hash-based gradient background by default", () => {
    render(<Avatar playerId="p-1" displayName="Kongó" />);
    const el = screen.getByRole("img");
    expect(el.style.background).toContain("linear-gradient");
  });

  test("colorOverride replaces the background with the given color", () => {
    render(
      <Avatar playerId="p-1" displayName="Kongó" colorOverride="var(--p2)" />,
    );
    const el = screen.getByRole("img");
    expect(el.style.background).toContain("var(--p2)");
    expect(el.style.background).not.toContain("linear-gradient");
  });

  test("still renders the player's initials when overridden", () => {
    render(
      <Avatar playerId="p-1" displayName="Kongó" colorOverride="var(--p2)" />,
    );
    expect(screen.getByText("KO")).toBeInTheDocument();
  });

  test("avatarUrl takes precedence over colorOverride", () => {
    render(
      <Avatar
        playerId="p-1"
        displayName="Kongó"
        avatarUrl="http://example.test/a.png"
        colorOverride="var(--p2)"
      />,
    );
    expect(screen.getByRole("img").querySelector("img")).toBeInTheDocument();
  });
});
