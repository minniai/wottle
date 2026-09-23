import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test } from "vitest";

import { LocaleProvider, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";

function wrap(locale: "is" | "en") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
  };
}

describe("LocaleProvider", () => {
  test("useLocale returns the provided locale's config", () => {
    const { result } = renderHook(() => useLocale(), { wrapper: wrap("en") });
    expect(result.current).toMatchObject({ id: "en", wordmark: "Wottle", language: "en" });
  });

  test("useLocalePath prefixes for English and not for Icelandic", () => {
    const en = renderHook(() => useLocalePath(), { wrapper: wrap("en") });
    const is = renderHook(() => useLocalePath(), { wrapper: wrap("is") });
    expect(en.result.current("/lobby")).toBe("/en/lobby");
    expect(is.result.current("/lobby")).toBe("/lobby");
  });

  test("children render inside the provider", () => {
    render(
      <LocaleProvider locale="is">
        <span>inni</span>
      </LocaleProvider>,
    );
    expect(screen.getByText("inni")).toBeInTheDocument();
  });

  test("outside a provider (a component rendered alone in a test) it reads English", () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.id).toBe("en");
  });
});
