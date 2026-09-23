import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { HereNowTable, type RowOverlay } from "@/components/page/lobby/HereNowTable";
import type { LobbyRow } from "@/lib/types/standing";

const row = (n: number, name: string, rating: number): LobbyRow => ({
  playerId: `00000000-0000-4000-8000-00000000000${n}`,
  displayName: name,
  handle: name.toLowerCase(),
  rating,
  state: "here",
  movesPlayed: null,
  record: null,
});
const EMBLA = row(1, "Embla", 1342);
const KARI = row(2, "Kári", 1265);

function renderTable(props: Partial<React.ComponentProps<typeof HereNowTable>> = {}) {
  const onSend = vi.fn(async () => ({ status: "sent" as const, inviteId: "i" }));
  const utils = render(
    <LocaleProvider locale="en">
      <HereNowTable
        rows={[EMBLA, KARI]}
        here={2}
        playing={0}
        onFreeze={vi.fn()}
        composer={{ viewer: { rating: 1310, gamesPlayed: 22 }, searching: false, outgoing: false, callUp: false }}
        overlays={new Map()}
        onSend={onSend}
        {...props}
      />
    </LocaleProvider>,
  );
  return { ...utils, onSend };
}

/** Spec 070 US3 (T064): the composer opens its row in place and states the stakes before you send. */
describe("the composer row", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens Embla's row in place with the terms and stakes, and focuses send", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Embla · challenge" }));
    const composer = screen.getByTestId("composer");
    expect(within(composer).getByText(/^every match rated · win \+\d+/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "send challenge ▸" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "not now" })).toBeTruthy();
  });

  it("closes on Esc or not now and gives focus back to the row's challenge", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Embla · challenge" }));
    fireEvent.keyDown(screen.getByTestId("composer"), { key: "Escape" });
    expect(screen.queryByTestId("composer")).toBeNull();
    expect(screen.getByRole("button", { name: "Embla · challenge" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Embla · challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "not now" }));
    expect(screen.queryByTestId("composer")).toBeNull();
  });

  it("keeps one row open at a time", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Embla · challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Kári · challenge" }));
    expect(screen.getAllByTestId("composer")).toHaveLength(1);
    expect(within(screen.getByTestId("composer")).getByText(/english words/)).toBeTruthy();
  });

  it("says what sending cancels", () => {
    renderTable({ composer: { viewer: { rating: 1310, gamesPlayed: 22 }, searching: true, outgoing: false, callUp: false } });
    fireEvent.click(screen.getByRole("button", { name: "Embla · challenge" }));
    expect(screen.getByText("sending cancels your search")).toBeTruthy();
  });

  it("sends Embla's challenge and closes; a refusal is written on the row", async () => {
    const { onSend } = renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Embla · challenge" }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(600)));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "send challenge ▸" }));
    });
    expect(onSend).toHaveBeenCalledWith(EMBLA.playerId);
    expect(screen.queryByTestId("composer")).toBeNull();

    onSend.mockResolvedValueOnce({ status: "in_match" } as never);
    fireEvent.click(screen.getByRole("button", { name: "Kári · challenge" }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(600)));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "send challenge ▸" }));
    });
    expect(screen.getByText("that player is in a match")).toBeTruthy();
  });

  it("while a call is up, draws send as a secondary and ignores it for 500ms after it changes", async () => {
    const { onSend, rerender } = renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Embla · challenge" }));
    rerender(
      <LocaleProvider locale="en">
        <HereNowTable rows={[EMBLA, KARI]} here={2} playing={0} onFreeze={vi.fn()} composer={{ viewer: { rating: 1310, gamesPlayed: 22 }, searching: false, outgoing: false, callUp: true }} overlays={new Map()} onSend={onSend} />
      </LocaleProvider>,
    );
    const send = screen.getByRole("button", { name: "send challenge ▸" });
    expect(send.className).toContain("page-link");
    fireEvent.click(send);
    expect(onSend).not.toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(600)));
    await act(async () => {
      fireEvent.click(send);
    });
    expect(onSend).toHaveBeenCalled();
  });

  it("writes a sent challenge, an outcome, a cooldown and an incoming call on the row, with no action", () => {
    const overlays = new Map<string, RowOverlay>([
      [EMBLA.playerId, { status: "sent · 0:52", action: "none" }],
      [KARI.playerId, { status: "declined", action: { againUntilMs: Date.now() + 41_000 } }],
    ]);
    renderTable({ overlays });
    expect(screen.getByText("sent · 0:52")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Embla · challenge" })).toBeNull();
    expect(screen.getByText(/^again in 0:4\d$/)).toBeTruthy();
  });
});
