import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/link/create", () => ({ createLinkAction: vi.fn() }));
vi.mock("@/app/actions/link/cancel", () => ({ cancelLinkAction: vi.fn(async () => ({ status: "cancelled" })) }));

import { cancelLinkAction } from "@/app/actions/link/cancel";
import { createLinkAction } from "@/app/actions/link/create";
import { useLinkOut } from "@/components/standing/hooks/useLinkOut";
import { LINK_STORAGE_KEY } from "@/lib/constants/links";
import type { OutgoingLink } from "@/lib/types/link";

const ID = "00000000-0000-4000-8000-000000000501";
const URL_ = "https://wottle.test/c/" + "a".repeat(43);
const link = (status: OutgoingLink["status"], extra: Partial<OutgoingLink> = {}): OutgoingLink => ({
  id: ID,
  status,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  respondedAt: status === "pending" ? null : new Date().toISOString(),
  ...extra,
});

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

/** Spec 072 T027: making, copying and cancelling a link, and its held outcome. */
describe("useLinkOut", () => {
  const writeText = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("localStorage", localStorageMock);
    localStorage.clear();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.mocked(createLinkAction).mockReset().mockResolvedValue({ status: "created", linkId: ID, url: URL_, expiresAt: new Date(Date.now() + 600_000).toISOString() });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("makes a link, copies it and keeps its text for copy again", async () => {
    const { result } = renderHook(() => useLinkOut(null));
    await act(async () => void (await result.current.create()));
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(result.current.text).toEqual({ linkId: ID, url: URL_ });
    expect(JSON.parse(localStorage.getItem(LINK_STORAGE_KEY)!)).toMatchObject({ linkId: ID, url: URL_ });
    await act(async () => result.current.copyAgain());
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("marks the clipboard refused and keeps the link to show as text", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { result } = renderHook(() => useLinkOut(null));
    await act(async () => void (await result.current.create()));
    expect(result.current.clipboardRefused).toBe(true);
    expect(result.current.text?.url).toBe(URL_);
  });

  it("returns a refusal for the machine to say", async () => {
    vi.mocked(createLinkAction).mockResolvedValue({ status: "busy_sender" });
    const { result } = renderHook(() => useLinkOut(null));
    let made: unknown;
    await act(async () => void (made = await result.current.create()));
    expect(made).toEqual({ status: "busy_sender" });
    expect(result.current.text).toBeNull();
  });

  it("reads a kept link back after a reload", () => {
    localStorage.setItem(LINK_STORAGE_KEY, JSON.stringify({ linkId: ID, url: URL_, expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    const { result } = renderHook(() => useLinkOut(link("pending")));
    expect(result.current.text).toEqual({ linkId: ID, url: URL_ });
  });

  it("holds a cancelled or expired link 4s, and forgets its text", () => {
    localStorage.setItem(LINK_STORAGE_KEY, JSON.stringify({ linkId: ID, url: URL_, expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    const { result, rerender } = renderHook(({ l }) => useLinkOut(l), { initialProps: { l: link("pending") as OutgoingLink | null } });
    rerender({ l: link("expired") });
    expect(result.current.held).toBe("expired");
    expect(localStorage.getItem(LINK_STORAGE_KEY)).toBeNull();
    act(() => void vi.advanceTimersByTime(4_100));
    expect(result.current.held).toBeNull();
  });

  it("does not hold a withdrawn or used link, or an old outcome read on a reload", () => {
    const { result, rerender } = renderHook(({ l }) => useLinkOut(l), { initialProps: { l: link("pending") as OutgoingLink | null } });
    rerender({ l: link("withdrawn") });
    expect(result.current.held).toBeNull();
    const old = renderHook(() => useLinkOut(link("cancelled", { respondedAt: new Date(Date.now() - 9_000).toISOString() })));
    expect(old.result.current.held).toBeNull();
  });

  it("cancels, and makes a new link in place of an old one", async () => {
    const { result } = renderHook(() => useLinkOut(link("pending")));
    await act(async () => void (await result.current.cancel(ID)));
    expect(cancelLinkAction).toHaveBeenCalledWith({ linkId: ID });
    await act(async () => void (await result.current.create()));
    expect(createLinkAction).toHaveBeenCalledTimes(1);
  });
});
