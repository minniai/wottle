import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { EmptyLobbyState } from "@/components/lobby/EmptyLobbyState";

describe("EmptyLobbyState", () => {
  test("renders italic headline and sub-copy", () => {
    render(<EmptyLobbyState onJoinQueue={vi.fn()} />);
    expect(
      screen.getByText("The library is empty tonight."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No challengers online/i),
    ).toBeInTheDocument();
  });

  test("renders a primary 'Join the queue' button", () => {
    const onJoinQueue = vi.fn();
    render(<EmptyLobbyState onJoinQueue={onJoinQueue} />);
    const btn = screen.getByRole("button", { name: /Join the queue/i });
    btn.click();
    expect(onJoinQueue).toHaveBeenCalledOnce();
  });

  test("renders a disabled 'Play a bot' ghost button", () => {
    render(<EmptyLobbyState onJoinQueue={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Play a bot/i });
    expect(btn).toBeDisabled();
  });
});
