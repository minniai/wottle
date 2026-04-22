import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ProfileActions } from "@/components/player/ProfileActions";

describe("ProfileActions", () => {
  test("renders Challenge {firstName} when not viewing self", () => {
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={false}
        onChallenge={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Challenge Ari/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Later/i })).toBeInTheDocument();
  });

  test("hides Challenge button when viewing self", () => {
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={true}
        onChallenge={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Challenge/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  test("clicking Challenge invokes onChallenge", () => {
    const onChallenge = vi.fn();
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={false}
        onChallenge={onChallenge}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Challenge Ari/i }));
    expect(onChallenge).toHaveBeenCalledTimes(1);
  });

  test("clicking Later invokes onClose", () => {
    const onClose = vi.fn();
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={false}
        onChallenge={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Later/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
