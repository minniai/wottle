import { afterEach, describe, expect, it, vi } from "vitest";

import { trackBandRecordMismatch, trackMatchIntegrityFailed } from "@/lib/observability/log";

/** Spec 049 T002: the events, each on the level the contracts name (the stale round-end write went with rounds, spec 050). */
describe("spec 049 observability events", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("an integrity failure is an error event carrying the failures", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    trackMatchIntegrityFailed({ matchId: "m1", globalSeq: 4, failures: [{ kind: "spelling" }] });
    const line = JSON.parse(error.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "error", event: "match.integrity.failed", matchId: "m1" });
    expect(line.globalSeq ?? line.metadata?.globalSeq).toBe(4);
    expect(line.failures ?? line.metadata?.failures).toEqual([{ kind: "spelling" }]);
  });

  it("a band mismatch is a warn-level info event naming the record", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    trackBandRecordMismatch({ matchId: "m1", record: "R9 þaks: board spells ÞKHL" });
    const line = JSON.parse(log.mock.calls[0][0] as string);
    expect(line).toMatchObject({ event: "bands.record-mismatch", matchId: "m1" });
    expect(JSON.stringify(line)).toContain("R9 þaks");
  });
});
