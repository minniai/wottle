import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/actions/auth/login", () => ({
  loginAction: vi.fn(async () => ({ status: "idle" })),
}));

import { LandingScreen } from "@/components/landing/LandingScreen";

describe("LandingScreen", () => {
  test("renders the Warm Editorial hero headline and sub-copy", () => {
    render(<LandingScreen />);
    expect(
      screen.getByText(/A real-time word duel/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Play with\s+letters\./i,
    );
    expect(
      screen.getByText(/Two players\. Ten rounds\./i),
    ).toBeInTheDocument();
  });

  test("renders a pill-shaped username input and submit button", () => {
    render(<LandingScreen />);
    const input = screen.getByTestId("landing-username-input");
    expect(input).toHaveAttribute("name", "username");
    expect(input).toHaveAttribute("placeholder", "Choose a username");
    expect(
      screen.getByRole("button", { name: /Enter lobby/i }),
    ).toBeInTheDocument();
  });

  test("renders the validation hint row", () => {
    render(<LandingScreen />);
    expect(
      screen.getByText(/3–24 characters · letters, numbers, dashes/i),
    ).toBeInTheDocument();
  });

  test("mounts the decorative tile vignette", () => {
    render(<LandingScreen />);
    expect(screen.getAllByTestId("landing-tile")).toHaveLength(6);
  });
});
