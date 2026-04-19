import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TopBar } from "@/components/ui/TopBar";

describe("TopBar", () => {
  test("renders the Wottle wordmark", () => {
    render(<TopBar />);
    expect(screen.getByText("Wottle")).toBeInTheDocument();
  });

  test("renders the tagline", () => {
    render(<TopBar />);
    expect(screen.getByText("word · battle")).toBeInTheDocument();
  });

  test("renders a link to /lobby labelled 'Lobby'", () => {
    render(<TopBar />);
    const lobbyLink = screen.getByRole("link", { name: /lobby/i });
    expect(lobbyLink).toHaveAttribute("href", "/lobby");
  });

  test("renders a link to /profile labelled 'Profile'", () => {
    render(<TopBar />);
    const profileLink = screen.getByRole("link", { name: /profile/i });
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  test("root element is sticky with top-0", () => {
    render(<TopBar />);
    const root = screen.getByTestId("topbar");
    expect(root.className).toContain("sticky");
    expect(root.className).toContain("top-0");
  });

  test("root element uses paper background with backdrop blur", () => {
    render(<TopBar />);
    const root = screen.getByTestId("topbar");
    expect(root.className).toMatch(/bg-paper/);
    expect(root.className).toMatch(/backdrop-blur/);
  });
});
