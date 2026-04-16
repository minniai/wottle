import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  test("renders the asset URL when avatarUrl is provided", () => {
    render(
      <Avatar playerId="p1" displayName="Ari" avatarUrl="https://cdn/x.png" />,
    );
    const img = screen.getByRole("img", { name: /Ari/i }).querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn/x.png");
  });

  test("renders the deterministic gradient fallback when avatarUrl is null", () => {
    render(<Avatar playerId="p1" displayName="Ari" avatarUrl={null} />);
    const el = screen.getByRole("img", { name: /Ari/i });
    expect(el.textContent).toBe("AR");
    expect(el.getAttribute("style") ?? "").toContain("linear-gradient");
  });

  test.each(["sm", "md", "lg"] as const)("renders %s size", (size) => {
    render(
      <Avatar playerId="p1" displayName="Ari" avatarUrl={null} size={size} />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  test("derives aria-label from displayName", () => {
    render(<Avatar playerId="p1" displayName="Hestur" avatarUrl={null} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/Hestur/);
  });
});
