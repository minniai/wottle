import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileWordCloud } from "@/components/profile/ProfileWordCloud";

describe("ProfileWordCloud", () => {
  test("renders one tag per word", () => {
    render(
      <ProfileWordCloud
        words={[
          { word: "KAFFI", points: 42 },
          { word: "BRAUÐ", points: 31 },
        ]}
      />,
    );
    expect(screen.getAllByTestId("word-cloud-item")).toHaveLength(2);
  });

  test("applies ochre-deep class to top-3 words", () => {
    render(
      <ProfileWordCloud
        words={[
          { word: "A", points: 40 },
          { word: "B", points: 30 },
          { word: "C", points: 20 },
          { word: "D", points: 10 },
        ]}
      />,
    );
    const items = screen.getAllByTestId("word-cloud-item");
    expect(items[0].className).toContain("ochre-deep");
    expect(items[2].className).toContain("ochre-deep");
    expect(items[3].className).not.toContain("ochre-deep");
  });

  test("clamps font-size to 40px for high-points words", () => {
    render(<ProfileWordCloud words={[{ word: "HUGE", points: 999 }]} />);
    const item = screen.getByTestId("word-cloud-item");
    expect(item.style.fontSize).toBe("40px");
  });

  test("renders empty state when words list is empty", () => {
    render(<ProfileWordCloud words={[]} />);
    expect(screen.getByText(/No scored words/i)).toBeInTheDocument();
    expect(screen.queryAllByTestId("word-cloud-item")).toHaveLength(0);
  });

  test("renders a mono point-value subscript beside each word", () => {
    render(<ProfileWordCloud words={[{ word: "KAFFI", points: 42 }]} />);
    const item = screen.getByTestId("word-cloud-item");
    expect(item.textContent).toContain("+42");
    expect(item.querySelector("sub")).not.toBeNull();
  });
});
