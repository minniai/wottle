import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../../app/api/match/[matchId]/rounds/[round]/summary/route";

vi.mock("../../lib/matchmaking/profile", async (importOriginal) => {
    const actual = (await importOriginal()) as typeof import("../../lib/matchmaking/profile");
    return {
        ...actual,
        readLobbySession: vi.fn(),
    };
});

vi.mock("../../lib/supabase/server", () => ({
    getServiceRoleClient: vi.fn(),
}));

import { readLobbySession } from "../../lib/matchmaking/profile";
import { getServiceRoleClient } from "../../lib/supabase/server";

const matchRow = {
    player_a_id: "player-a",
    player_b_id: "player-b",
};

const roundRow = {
    id: "round-1",
    state: "completed",
    completed_at: "2025-01-01T00:00:05Z",
};

const wordEntries = [
    {
        player_id: "player-a",
        word: "WAVE",
        length: 4,
        letters_points: 8,
        bonus_points: 4,
        total_points: 12,
        tiles: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
        ],
    },
];

const snapshotRow = {
    player_a_score: 20,
    player_b_score: 17,
};

function createWordEntriesChain() {
    const chain: any = { eqCalls: 0 };
    chain.eq = vi.fn(function () {
        chain.eqCalls += 1;
        if (chain.eqCalls >= 2) {
            return Promise.resolve({ data: wordEntries, error: null });
        }
        return chain;
    });
    return chain;
}

function createRoundChain() {
    const chain: any = { eqCalls: 0 };
    chain.eq = vi.fn(function () {
        chain.eqCalls += 1;
        return chain;
    });
    chain.single = vi.fn().mockResolvedValue({ data: roundRow, error: null });
    return chain;
}

function createScoreboardChain() {
    const chain: any = { eqCalls: 0 };
    chain.eq = vi.fn(function () {
        chain.eqCalls += 1;
        return chain;
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: snapshotRow, error: null });
    return chain;
}

function createSupabaseStub() {
    return {
        from: vi.fn((table: string) => {
            if (table === "matches") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: matchRow, error: null }),
                        }),
                    })),
                };
            }

            if (table === "rounds") {
                return {
                    select: vi.fn(() => createRoundChain()),
                };
            }

            if (table === "word_score_entries") {
                return {
                    select: vi.fn(() => createWordEntriesChain()),
                };
            }

            if (table === "scoreboard_snapshots") {
                return {
                    select: vi.fn(() => createScoreboardChain()),
                };
            }

            return {};
        }),
    };
}

const sessionA = {
    token: "token-a",
    issuedAt: Date.now(),
    player: {
        id: "player-a",
        username: "round-alpha",
        displayName: "Round Alpha",
        status: "in_match" as const,
        lastSeenAt: new Date().toISOString(),
    },
};

const sessionB = {
    ...sessionA,
    player: {
        ...sessionA.player,
        id: "player-b",
        username: "round-beta",
        displayName: "Round Beta",
    },
};

function createRequest() {
    return new NextRequest("http://localhost/api/match/match-1/rounds/2/summary");
}

describe("GET /api/match/[matchId]/rounds/[round]/summary", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
        vi.mocked(readLobbySession).mockReset();
        vi.mocked(getServiceRoleClient).mockReset();
        vi.mocked(getServiceRoleClient).mockReturnValue(createSupabaseStub() as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns identical summaries for both players (SC-004)", async () => {
        const params = { matchId: "match-1", round: "2" };

        vi.mocked(readLobbySession).mockResolvedValueOnce(sessionA);
        const responseA = await GET(createRequest(), { params: Promise.resolve(params) });
        expect(responseA.status).toBe(200);
        const payloadA = await responseA.json();

        vi.mocked(readLobbySession).mockResolvedValueOnce(sessionB);
        const responseB = await GET(createRequest(), { params: Promise.resolve(params) });
        expect(responseB.status).toBe(200);
        const payloadB = await responseB.json();

        expect(payloadA).toEqual(payloadB);
        expect(payloadA).toEqual(
            expect.objectContaining({
                roundNumber: 2,
                words: expect.arrayContaining([
                    expect.objectContaining({
                        word: "WAVE",
                        totalPoints: 12,
                    }),
                ]),
                totals: expect.objectContaining({
                    playerA: expect.any(Number),
                    playerB: expect.any(Number),
                }),
            }),
        );
    });

    it("conforms to round summary schema (matchId, words, deltas, highlights)", async () => {
        const params = { matchId: "match-1", round: "2" };
        vi.mocked(readLobbySession).mockResolvedValue(sessionA);

        const response = await GET(createRequest(), { params: Promise.resolve(params) });
        expect(response.status).toBe(200);
        const payload = await response.json();

        expect(payload).toMatchObject({
            matchId: "match-1",
            roundNumber: 2,
            words: expect.arrayContaining([
                expect.objectContaining({
                    playerId: expect.any(String),
                    length: expect.any(Number),
                    lettersPoints: expect.any(Number),
                    bonusPoints: expect.any(Number),
                    coordinates: expect.arrayContaining([
                        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
                    ]),
                }),
            ]),
            deltas: {
                playerA: expect.any(Number),
                playerB: expect.any(Number),
            },
            totals: {
                playerA: expect.any(Number),
                playerB: expect.any(Number),
            },
            highlights: expect.arrayContaining([
                expect.arrayContaining([
                    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
                ]),
            ]),
            resolvedAt: expect.stringMatching(/^202\d|203\d|204\d/),
        });
    });
});

