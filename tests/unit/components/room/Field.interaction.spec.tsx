import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { copyEn } from "@/lib/i18n/copy/en";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/match/previewSwap", () => ({ previewSwap: vi.fn() }));

import { previewSwap } from "@/app/actions/match/previewSwap";
import { Field } from "@/components/room/Field";
import { useFieldInteraction, type FieldInteractionApi, type FieldInteractionOptions } from "@/components/room/hooks/useFieldInteraction";
import { liveText } from "@/lib/room/ledgerRows";
import { liveStateFor } from "@/lib/room/liveState";
import type { Coordinate } from "@/lib/types/board";

function board(): string[][] {
  return Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => "ABCDEFGHIJ"[(x + y) % 10]));
}

const cell = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

/** Exposes the hook's dispatch so a test can play the server's resolutions into it (spec 050). */
let api: FieldInteractionApi | null = null;

function Harness(props: Partial<FieldInteractionOptions> & { frozen?: Record<string, { owner: "player_a" | "player_b" }> }) {
  const frozen = props.frozen ?? {};
  const field = useFieldInteraction({
    matchId: "m1",
    board: board(),
    previewEnabled: props.previewEnabled ?? false,
    frozenKeys: new Set(Object.keys(frozen)),
    canPick: props.canPick ?? true,
    onPick: props.onPick ?? (() => undefined),
    onCommitted: props.onCommitted ?? (() => undefined),
    onRejected: props.onRejected ?? (() => undefined),
    onNotice: props.onNotice ?? (() => undefined),
  });
  useEffect(() => {
    api = field;
  });
  // Spec 047 amendment P1: the field state becomes the live row's two lines.
  const live = liveText(liveStateFor(field.interaction, () => ({ letter: "B", value: 1 })), copyEn);
  return (
    <>
      <div data-testid="live">{live.line2 ? `${live.line1} / ${live.line2}` : live.line1}</div>
      <div data-testid="kind">{field.interaction.kind}</div>
      <Field board={board()} frozenTiles={frozen} viewerSlot="player_a" cellStateFor={field.cellStateFor} seatFor={field.seatFor} shakeAt={field.shakeAt} focusAt={field.focusAt} onActivate={(at: Coordinate) => field.dispatch({ type: "tap", at })} onDrag={(from: Coordinate, to: Coordinate) => field.dispatch({ type: "drag", from, to })} onKeyDown={field.onKeyDown} exchange={field.ownPins} />
    </>
  );
}

describe("Field interaction (spec 044 US2, spec 050)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    api = null;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ status: "accepted", moveId: "mv-1", globalSeq: 1, receivedAt: "2026-01-01T00:00:00Z" }) });
    vi.mocked(previewSwap).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("default: first tap picks (your colour, sound), second tap commits and posts the move with the two letters seen", async () => {
    const onPick = vi.fn();
    const onCommitted = vi.fn();
    render(<Harness onPick={onPick} onCommitted={onCommitted} />);
    fireEvent.click(cell(1, 1));
    expect(cell(1, 1)).toHaveAttribute("data-state", "picked");
    expect(cell(1, 1)).toHaveAttribute("data-seat", "you");
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("live")).toHaveTextContent("picking · B (1) / tap a second letter");
    fireEvent.click(cell(4, 1));
    // Nothing is pinned any more (spec 050): the two letters exchange in place while the move is in flight.
    expect(screen.getByTestId("kind")).toHaveTextContent("committed");
    expect(cell(1, 1)).toHaveAttribute("data-state", "free");
    expect(screen.getByTestId("live")).toHaveTextContent("scoring");
    expect(fetchMock).toHaveBeenCalledWith("/api/match/m1/move", expect.objectContaining({ method: "POST", body: JSON.stringify({ fromX: 1, fromY: 1, toX: 4, toY: 1, fromLetter: "C", toLetter: "F" }) }));
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
    expect(screen.getByTestId("live")).toHaveTextContent("previewing / tap again to play · esc cancels");
    await waitFor(() => expect(screen.getByTestId("live")).toHaveTextContent("24 · hestur / tap again to play · esc cancels"));
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

  // Spec 050 FR-014: the opponent's resolution clears a pick it touched, and only that.
  it("an opponent's resolved move clears a pick it touched with a notice, and leaves an untouched pick alone", () => {
    const onNotice = vi.fn();
    render(<Harness onNotice={onNotice} />);
    fireEvent.click(cell(5, 5));
    expect(screen.getByTestId("kind")).toHaveTextContent("picked");
    act(() => api!.dispatch({ type: "opponentResolved", tiles: [{ x: 8, y: 8 }] }));
    expect(screen.getByTestId("kind")).toHaveTextContent("picked");
    act(() => api!.dispatch({ type: "opponentResolved", tiles: [{ x: 5, y: 5 }, { x: 6, y: 5 }] }));
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
    expect(onNotice).toHaveBeenCalledWith("pickCleared", undefined);
  });

  it("a refused post returns to idle and reports the reason", async () => {
    fetchMock.mockResolvedValue({ status: 400, json: async () => ({ status: "rejected", reason: "in_flight", error: "Your previous move is still being scored" }) });
    const onRejected = vi.fn();
    render(<Harness onRejected={onRejected} />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(cell(2, 1));
    await waitFor(() => expect(onRejected).toHaveBeenCalledWith("move_in_flight"));
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

  // Spec 050: a commit is unwound by its own resolution, never by the opponent's.
  it("the move's own resolution clears a committed pair; a refusal too; the opponent's never", () => {
    render(<Harness />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(cell(2, 1));
    expect(screen.getByTestId("kind")).toHaveTextContent("committed");
    act(() => api!.dispatch({ type: "opponentResolved", tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }] }));
    expect(screen.getByTestId("kind")).toHaveTextContent("committed");
    act(() => api!.dispatch({ type: "moveResolved" }));
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
    fireEvent.click(cell(3, 3));
    fireEvent.click(cell(4, 3));
    act(() => api!.dispatch({ type: "moveRejected", reason: "frozen" }));
    expect(screen.getByTestId("kind")).toHaveTextContent("idle");
  });

  /**
   * Spec 045 US5 (FR-024). A pointer that goes down on one letter and up on
   * another is a swap, and must not also read as a tap.
   */
  describe("pointer drag", () => {
    /** jsdom implements no hit testing at all, so the API has to be supplied. */
    let under: Element | null = null;
    beforeEach(() => {
      under = null;
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => under,
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(document, "elementFromPoint");
    });

    function releaseOver(target: Element | null) {
      under = target;
    }

    it("down on A, up on B commits that swap once and registers no tap", async () => {
      const onCommitted = vi.fn();
      render(<Harness onCommitted={onCommitted} />);

      fireEvent.pointerDown(cell(1, 1));
      releaseOver(cell(2, 1));
      fireEvent.pointerUp(cell(2, 1));
      // The browser fires a click after pointerup; it must not become a pick.
      fireEvent.click(cell(2, 1));

      await waitFor(() => expect(onCommitted).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId("kind")).toHaveTextContent("committed");
    });

    it("down and up on the same letter is a tap, not a drag", () => {
      render(<Harness />);
      fireEvent.pointerDown(cell(3, 3));
      releaseOver(cell(3, 3));
      fireEvent.pointerUp(cell(3, 3));
      fireEvent.click(cell(3, 3));

      expect(cell(3, 3)).toHaveAttribute("data-state", "picked");
      expect(screen.getByTestId("kind")).toHaveTextContent("picked");
    });

    it("releasing outside the field cancels and dispatches nothing", () => {
      render(<Harness />);
      fireEvent.pointerDown(cell(4, 4));
      releaseOver(document.body);
      fireEvent.pointerUp(cell(4, 4));

      expect(screen.getByTestId("kind")).toHaveTextContent("idle");
      expect(cell(4, 4)).not.toHaveAttribute("data-state", "picked");
    });

    // A drag's click lands on the grid, not on a letter, so the flag that
    // swallows it must not outlive the gesture and eat the next real tap.
    it("the tap after a drag is a tap", async () => {
      vi.mocked(previewSwap).mockResolvedValue({ status: "ok", words: [], total: 0 });
      render(<Harness previewEnabled />);
      fireEvent.pointerDown(cell(1, 1));
      releaseOver(cell(2, 1));
      fireEvent.pointerUp(cell(2, 1));
      expect(screen.getByTestId("kind")).toHaveTextContent("preview");

      fireEvent.pointerDown(cell(2, 1));
      releaseOver(cell(2, 1));
      fireEvent.pointerUp(cell(2, 1));
      fireEvent.click(cell(2, 1));
      expect(screen.getByTestId("kind")).toHaveTextContent("committed");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("a drag onto a frozen letter shakes it rather than swapping", () => {
      render(<Harness frozen={{ "5,5": { owner: "player_b" } }} />);
      fireEvent.pointerDown(cell(4, 5));
      releaseOver(cell(5, 5));
      fireEvent.pointerUp(cell(5, 5));

      expect(screen.getByTestId("kind")).toHaveTextContent("idle");
    });
  });

  /**
   * Spec 045 US5 (FR-025). `tapOutside` is reduced but was never dispatched:
   * only Escape and re-tapping the first letter cancelled a pick.
   */
  describe("tap outside", () => {
    it("cancels a pick when the pointer goes down outside the field", () => {
      render(<Harness />);
      fireEvent.click(cell(6, 6));
      expect(screen.getByTestId("kind")).toHaveTextContent("picked");

      fireEvent.pointerDown(document.body);
      expect(screen.getByTestId("kind")).toHaveTextContent("idle");
    });

    it("leaves the pick alone for a control marked safe, so the ledger still acts", () => {
      render(
        <>
          <button type="button" data-field-safe data-testid="safe">rules</button>
          <Harness />
        </>,
      );
      fireEvent.click(cell(6, 6));
      fireEvent.pointerDown(screen.getByTestId("safe"));
      expect(screen.getByTestId("kind")).toHaveTextContent("picked");
    });

    it("listens only while a letter is picked", () => {
      const add = vi.spyOn(document, "addEventListener");
      render(<Harness />);
      const before = add.mock.calls.filter(([type]) => type === "pointerdown").length;
      expect(before).toBe(0);

      fireEvent.click(cell(7, 7));
      expect(add.mock.calls.filter(([type]) => type === "pointerdown").length).toBeGreaterThan(before);
      add.mockRestore();
    });
  });

  /**
   * Spec 045 FR-027. The letters used to teleport: `applyLetterSwaps` changed
   * the board and React re-rendered two different characters in place.
   */
  describe("the exchange", () => {
    function Swapper({ swapped }: { swapped: boolean }) {
      const grid = board();
      if (swapped) {
        const a = grid[0][0];
        grid[0][0] = grid[0][1];
        grid[0][1] = a;
      }
      return <Field board={grid} viewerSlot="player_a" exchange={swapped ? [{ x: 0, y: 0 }, { x: 1, y: 0 }] : null} />;
    }

    it("marks exactly the two exchanged letters and gives each the other's offset", () => {
      const { rerender } = render(<Swapper swapped={false} />);
      expect(document.querySelectorAll(".field__cell--exchange")).toHaveLength(0);

      rerender(<Swapper swapped />);
      const moving = [...document.querySelectorAll<HTMLElement>(".field__cell--exchange")];
      expect(moving).toHaveLength(2);
      for (const el of moving) {
        expect(el.style.getPropertyValue("--dx")).not.toBe("");
        expect(el.style.getPropertyValue("--dy")).not.toBe("");
      }
    });

    // Production 2026-09-22: every clock tick re-rendered the room with a new
    // pair array and the previewed letters flew again, so a tap on one landed
    // on the other's travelling letter and never committed.
    it("runs once per pair: a re-render with the same two letters does not start it again", () => {
      const pair = (): [Coordinate, Coordinate] => [{ x: 0, y: 0 }, { x: 1, y: 0 }];
      const { rerender } = render(<Field board={board()} viewerSlot="player_a" exchange={pair()} />);
      for (const el of document.querySelectorAll(".field__cell--exchange span")) fireEvent.animationEnd(el);
      expect(document.querySelectorAll(".field__cell--exchange")).toHaveLength(0);

      rerender(<Field board={board()} viewerSlot="player_a" exchange={pair()} />);
      expect(document.querySelectorAll(".field__cell--exchange")).toHaveLength(0);
    });

    it("clears the mark when the animation ends, so it can run again", () => {
      const { rerender } = render(<Swapper swapped={false} />);
      rerender(<Swapper swapped />);
      // Each letter clears on its own animation, so both must end.
      const moving = [...document.querySelectorAll<HTMLElement>(".field__cell--exchange")];
      fireEvent.animationEnd(moving[0].querySelector("span")!);
      expect(document.querySelectorAll(".field__cell--exchange")).toHaveLength(1);

      fireEvent.animationEnd(document.querySelector(".field__cell--exchange span")!);
      expect(document.querySelectorAll(".field__cell--exchange")).toHaveLength(0);
    });
  });
});
