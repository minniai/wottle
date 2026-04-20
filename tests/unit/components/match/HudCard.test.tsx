import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { HudCard } from "@/components/match/HudCard";

describe("HudCard", () => {
  test("renders name, meta, score, clock", () => {
    render(
      <HudCard
        slot="you"
        avatar={<div data-testid="avatar" />}
        name="Ásta Kristín"
        meta="White · 1728"
        clock="2:00"
        score={198}
      />,
    );
    expect(screen.getByText("Ásta Kristín")).toBeInTheDocument();
    expect(screen.getByText("White · 1728")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("198")).toBeInTheDocument();
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
  });

  test("applies hud-card--you for current player", () => {
    render(
      <HudCard
        slot="you"
        avatar={<div />}
        name="You"
        meta="m"
        clock="0:00"
        score={0}
      />,
    );
    const card = screen.getByTestId("hud-card");
    expect(card.className).toContain("hud-card--you");
    expect(card.className).not.toContain("hud-card--opp");
  });

  test("applies hud-card--opp for opponent", () => {
    render(
      <HudCard
        slot="opp"
        avatar={<div />}
        name="Them"
        meta="m"
        clock="0:00"
        score={0}
      />,
    );
    const card = screen.getByTestId("hud-card");
    expect(card.className).toContain("hud-card--opp");
  });

  test("supports active/low clock states", () => {
    const { rerender } = render(
      <HudCard
        slot="you"
        avatar={<div />}
        name="Y"
        meta="m"
        clock="2:00"
        clockState="active"
        score={0}
      />,
    );
    expect(screen.getByTestId("hud-card-clock").className).toContain(
      "hud-card__clock--active",
    );

    rerender(
      <HudCard
        slot="you"
        avatar={<div />}
        name="Y"
        meta="m"
        clock="0:30"
        clockState="low"
        score={0}
      />,
    );
    expect(screen.getByTestId("hud-card-clock").className).toContain(
      "hud-card__clock--low",
    );

    rerender(
      <HudCard
        slot="you"
        avatar={<div />}
        name="Y"
        meta="m"
        clock="1:22"
        clockState="waiting"
        score={0}
      />,
    );
    expect(screen.getByTestId("hud-card-clock").className).toContain(
      "hud-card__clock--waiting",
    );
  });

  test("renders children below identity block when provided", () => {
    render(
      <HudCard
        slot="you"
        avatar={<div />}
        name="Y"
        meta="m"
        clock="0:00"
        score={0}
      >
        <button data-testid="extra">Resign</button>
      </HudCard>,
    );
    expect(screen.getByTestId("extra")).toBeInTheDocument();
  });
});
