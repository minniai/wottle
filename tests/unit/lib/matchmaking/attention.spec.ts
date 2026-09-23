import { describe, expect, it, vi } from "vitest";

import { attentionFromQuery, recordAttention } from "@/lib/matchmaking/attention";

/** Spec 069 R5: a tab reports whether it is visible and how long since its last input. */
describe("attention", () => {
  it("reads a report from a query, or nothing", () => {
    expect(attentionFromQuery(new URLSearchParams("visible=1&inputAgoMs=900"))).toEqual({ visible: true, inputAgoMs: 900 });
    expect(attentionFromQuery(new URLSearchParams("visible=0&inputAgoMs=900"))).toEqual({ visible: false, inputAgoMs: 900 });
    expect(attentionFromQuery(new URLSearchParams(""))).toBeNull();
    expect(attentionFromQuery(new URLSearchParams("visible=1&inputAgoMs=soon"))).toBeNull();
  });

  it("writes the report with the server's clock, the input age clamped to 0–10 minutes", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ update })) };
    const now = Date.parse("2026-09-23T12:00:00.000Z");
    vi.useFakeTimers({ now });
    await recordAttention(client as never, "p1", { visible: true, inputAgoMs: 99_999_999 });
    vi.useRealTimers();
    expect(client.from).toHaveBeenCalledWith("players");
    expect(update).toHaveBeenCalledWith({
      attention_visible: true,
      attention_input_at: new Date(now - 600_000).toISOString(),
      attention_at: new Date(now).toISOString(),
    });
    expect(eq).toHaveBeenCalledWith("id", "p1");
  });
});
