import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { LoginActionState } from "@/app/actions/auth/login";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

vi.mock("@/app/actions/auth/login", () => ({
  loginAction: vi.fn(async () => ({ status: "idle" })),
}));

const mockState: { current: LoginActionState } = { current: { status: "idle" } };
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: vi.fn(() => [mockState.current, vi.fn(), false]),
  };
});

import { LandingScreen } from "@/components/landing/LandingScreen";

describe("LandingScreen", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    mockState.current = { status: "idle" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders the Warm Editorial hero headline and sub-copy", () => {
    render(<LandingScreen />);
    expect(screen.getByText(/A real-time word duel/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Play with\s+letters\./i,
    );
    expect(screen.getByText(/Two players\. Ten rounds\./i)).toBeInTheDocument();
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

  test("renders a server error when loginAction returns status='error'", () => {
    mockState.current = { status: "error", message: "Username already taken" };
    render(<LandingScreen />);
    expect(screen.getByTestId("landing-login-error").textContent).toContain(
      "Username already taken",
    );
  });

  test("calls router.refresh when loginAction returns status='success'", () => {
    mockState.current = { status: "success" };
    render(<LandingScreen />);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
