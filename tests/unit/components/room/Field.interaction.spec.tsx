import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/match/previewSwap", () => ({ previewSwap: vi.fn() }));

import { previewSwap } from "@/app/actions/match/previewSwap";
import { Field } from "@/components/room/Field";
import { useFieldInteraction, type FieldInteractionOptions } from "@/components/room/hooks/useFieldInteraction";
import type { Coordinate } from "@/lib/types/board";

function board(): string[][] {
  return Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => "ABCDEFGHIJ"[(x + y) % 10]));
}

const cell = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

function Harness(props: Partial<FieldInteractionOptions> & { frozen?: Record<string, { owner: "player_a" | "player_b" }> }) {
  const frozen = props.frozen ?? {};
  const field = useFieldInteraction({
    matchId: "m1",
    previewEnabled: props.previewEnabled ?? false,
    frozenKeys: new Set(Object.keys(frozen)),
    opponentPins: props.opponentPins ?? null,
    canPick: props.canPick ?? true,
    currentRound: props.currentRound ?? 1,
    onPick: props.onPick ?? (() => undefined),
    onCommitted: props.onCommitted ?? (() => undefined),
    onRejected: props.onRejected ?? (() => undefined),
    onNotice: props.onNotice ?? (() => undefined),
  });
  return (
    <>
      <div data-testid="hint">{field.hint}</div>
      <div data-testid="kind">{field.interaction.kind}</div>
      <Field board={board()} frozenTiles={frozen} viewerSlot="player_a" cellStateFor={field.cellStateFor} seatFor={field.seatFor} shakeAt={field.shakeAt} focusAt={field.focusAt} onActivate={(at: Coordinate) => field.dispatch({ type: "tap", at })} onKeyDown={field.onKeyDown} />
    </>
  );
}

describe("Field interaction (spec 044 US2)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ status: "accepted", grid: board() }) });
    vi.mocked(previewSwap).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("default: first tap picks (your colour, sound), second tap commits and posts the move", async () => {
    const onPick = vi.fn();
    const onCommitted = vi.fn();
    render(<Harness onPick={onPick} onCommitted={onCommitted} />);
    fireEvent.click(cell(1, 1));
    expect(cell(1, 1)).toHaveAttribute("data-state", "picked");
    expect(cell(1, 1)).toHaveAttribute("data-seat", "you");
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("hint")).toHaveTextContent("tap a second letter");
    fireEvent.click(cell(4, 1));
    expect(cell(1, 1)).toHaveAttribute("data-state", "pinned");
    expect(cell(4, 1)).toHaveAttribute("data-state", "pinned");
    expect(screen.getByTestId("hint")).toHaveTextContent("played ●");
    expect(fetchMock).toHaveBeenCalledWith("/api/match/m1/move", expect.objectContaining({ method: "POST", body: JSON.stringify({ fromX: 1, fromY: 1, toX: 4, toY: 1 }) }));
    await waitFor(() => expect(onCommitted).toHaveBeenCalled());
    expect(previewSwap).not.toHaveBeenCalled();
  });

  it("preview on: second tap previews with dotted rings and prices via the server; third tap commits", async () => {
    vi.mocked(previewSwap).mockResolvedValue({ status: "ok", words: [{ word: "hestur", points: 24, direction: "ltr" }], total: 24 });
    render(<Harness previewEnabled />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(cell(4, 1));
    expect(cell(1, 1)).toHaveAttribute("data-state", "previewed");
    expect(cell(4, 1)).toHaveAttribute("data-state", "previewed");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(previewSwap).toHaveBeenCalledWith({ kind: "match", matchId: "m1", from: { x: 1, y: 1 }, to: { x: 4, y: 1 } });
    await waitFor(() => expect(screen.getByTestId("hint")).toHaveTextContent("24 · hestur · tap again to play"));
    fireEvent.click(cell(4, 1));
    expect(screen.getByTestId("kind")).toHaveTextContent("committed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Escape reverses a preview; the picked letter tapped again returns to idle", () => {
    vi.mocked(previewSwap).mockResolvedValue({ status: "ok", words: [], total: 0 });
    render(<Harness previewEnabled />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(cell(4, 1));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
    expect(cell(1, 1)).toHaveAttribute("data-state", "free");
    fireEvent.click(cell(2, 2));
    fireEvent.click(cell(2, 2));
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
  });

  it("a frozen letter shakes in place and notifies; nothing is posted", () => {
    const onNotice = vi.fn();
    render(<Harness frozen={{ "3,3": { owner: "player_b" } }} onNotice={onNotice} />);
    fireEvent.click(cell(3, 3));
    expect(onNotice).toHaveBeenCalledWith("frozen", { x: 3, y: 3 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opponent pins render in coral and clear a pick that they cover", () => {
    const onNotice = vi.fn();
    const { rerender } = render(<Harness onNotice={onNotice} />);
    fireEvent.click(cell(5, 5));
    expect(screen.getByTestId("kind")).toHaveTextContent("picked");
    rerender(<Harness onNotice={onNotice} opponentPins={[{ x: 5, y: 5 }, { x: 6, y: 5 }]} />);
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
    expect(cell(5, 5)).toHaveAttribute("data-state", "pinned");
    expect(cell(5, 5)).toHaveAttribute("data-seat", "opp");
    expect(onNotice).toHaveBeenCalledWith("pickCleared", undefined);
  });

  it("a rejected move returns to idle and reports the reason", async () => {
    fetchMock.mockResolvedValue({ status: 400, json: async () => ({ status: "rejected", error: "Move already submitted for this round" }) });
    const onRejected = vi.fn();
    render(<Harness onRejected={onRejected} />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(cell(2, 1));
    await waitFor(() => expect(onRejected).toHaveBeenCalledWith("Move already submitted for this round"));
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
  });

  it("keyboard: arrows move focus, Space picks, Enter commits a preview", async () => {
    vi.mocked(previewSwap).mockResolvedValue({ status: "ok", words: [], total: 0 });
    render(<Harness previewEnabled />);
    const first = cell(0, 0);
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(cell(1, 0)));
    fireEvent.keyDown(cell(1, 0), { key: " " });
    expect(cell(1, 0)).toHaveAttribute("data-state", "picked");
    fireEvent.keyDown(cell(1, 0), { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(cell(1, 1)));
    fireEvent.keyDown(cell(1, 1), { key: " " });
    expect(screen.getByTestId("kind")).toHaveTextContent("preview");
    fireEvent.keyDown(cell(1, 1), { key: "Enter" });
    expect(screen.getByTestId("kind")).toHaveTextContent("committed");
  });

  it("round advance clears a committed pair", () => {
    const { rerender } = render(<Harness currentRound={1} />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(cell(2, 1));
    expect(screen.getByTestId("kind")).toHaveTextContent("committed");
    rerender(<Harness currentRound={2} />);
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
  });
});
