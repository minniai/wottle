"use client";

import { useEffect, useRef } from "react";
import type { RoundSummary, WordScore } from "@/lib/types/match";

interface RoundSummaryPanelProps {
    summary: RoundSummary | null;
    currentPlayerId: string;
    playerAId: string;
    onDismiss?: () => void;
    autoDismissMs?: number;
}

export function RoundSummaryPanel({
    summary,
    currentPlayerId,
    playerAId,
    onDismiss,
    autoDismissMs = 3000,
}: RoundSummaryPanelProps) {
    const summaryIdRef = useRef<string | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const liveRegionRef = useRef<HTMLDivElement | null>(null);
    const currentSummaryId = summary ? `${summary.matchId}-${summary.roundNumber}` : null;
    const words = summary?.words ?? [];
    const currentPlayerIsPlayerA = playerAId === currentPlayerId;
    const currentPlayerWords = words.filter((w) => w.playerId === currentPlayerId);
    const opponentWords = words.filter((w) => w.playerId !== currentPlayerId);
    const yourScore = summary
        ? currentPlayerIsPlayerA
            ? summary.totals.playerA
            : summary.totals.playerB
        : 0;
    const yourDelta = summary
        ? currentPlayerIsPlayerA
            ? summary.deltas.playerA
            : summary.deltas.playerB
        : 0;
    const opponentScore = summary
        ? currentPlayerIsPlayerA
            ? summary.totals.playerB
            : summary.totals.playerA
        : 0;
    const opponentDelta = summary
        ? currentPlayerIsPlayerA
            ? summary.deltas.playerB
            : summary.deltas.playerA
        : 0;
    const hasWords = words.length > 0;

    // Auto-dismiss timer
    useEffect(() => {
        if (!summary || autoDismissMs <= 0) {
            return;
        }

        // Reset timer if summary changed
        if (summaryIdRef.current !== currentSummaryId) {
            summaryIdRef.current = currentSummaryId;
        }

        const timer = setTimeout(() => {
            onDismiss?.();
        }, autoDismissMs);

        return () => clearTimeout(timer);
    }, [summary, currentSummaryId, autoDismissMs, onDismiss]);

    useEffect(() => {
        if (!summary || typeof window === "undefined") {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            panelRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [summary, summary?.matchId, summary?.roundNumber]);

    useEffect(() => {
        if (!summary || !liveRegionRef.current) {
            return;
        }
        liveRegionRef.current.textContent = buildSummaryAnnouncement(
            summary.roundNumber,
            yourDelta,
            opponentDelta,
        );
    }, [summary, yourDelta, opponentDelta]);

    if (!summary) {
        return null;
    }

    return (
        <div
            ref={panelRef}
            className="w-full overflow-y-auto rounded-2xl border border-hair-strong bg-paper/95 p-6 shadow-2xl shadow-paper-3/60 backdrop-blur-sm lg:max-h-[calc(100vh-8rem)] lg:sticky lg:top-4"
            data-testid="round-summary-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="round-summary-title"
            tabIndex={-1}
        >
            <div
                ref={liveRegionRef}
                data-testid="round-summary-live-region"
                className="sr-only"
                aria-live="polite"
                aria-atomic="true"
                role="status"
            />
            <div className="flex items-start justify-between mb-4">
                <h2 id="round-summary-title" className="text-xl font-bold text-ink">
                    Round {summary.roundNumber} Summary
                </h2>
                {onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="text-ink-soft hover:text-ink"
                        aria-label="Close summary"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Score Totals -- always shown */}
            <div className="grid grid-cols-2 gap-4" role="group" aria-label="Score summary">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4" aria-live="polite">
                    <p className="text-xs uppercase tracking-wide text-emerald-200/80 mb-1">
                        Your Score
                    </p>
                    <p className="text-2xl font-bold text-emerald-200">
                        {yourScore}
                    </p>
                    <p
                        className="text-sm text-emerald-300/80 mt-1"
                        data-testid="round-summary-player-a-delta"
                    >
                        {formatDeltaLabel(yourDelta)} this round
                    </p>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4" aria-live="polite">
                    <p className="text-xs uppercase tracking-wide text-sky-200/80 mb-1">
                        Opponent Score
                    </p>
                    <p className="text-2xl font-bold text-sky-200">
                        {opponentScore}
                    </p>
                    <p
                        className="text-sm text-sky-300/80 mt-1"
                        data-testid="round-summary-player-b-delta"
                    >
                        {formatDeltaLabel(opponentDelta)} this round
                    </p>
                </div>
            </div>

            {!hasWords ? (
                <div className="text-center py-4 text-ink-3">
                    <p className="text-sm">No new words scored this round</p>
                </div>
            ) : (
                <div className="space-y-6 mt-4">
                    {/* Words List */}
                    {currentPlayerWords.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-ink mb-3">Your Words</h3>
                            <div className="space-y-2">
                                {currentPlayerWords.map((word, idx) => (
                                    <WordScoreRow key={`${word.word}-${idx}`} wordScore={word} />
                                ))}
                            </div>
                        </div>
                    )}

                    {opponentWords.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-ink-soft mb-3">
                                Opponent&apos;s Words
                            </h3>
                            <div className="space-y-2">
                                {opponentWords.map((word, idx) => (
                                    <WordScoreRow
                                        key={`${word.word}-${idx}`}
                                        wordScore={word}
                                        isOpponent
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {onDismiss && (
                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                        data-testid="round-summary-continue"
                    >
                        Continue
                    </button>
                </div>
            )}
        </div>
    );
}

function WordScoreRow({ wordScore, isOpponent = false }: { wordScore: WordScore; isOpponent?: boolean }) {
    const baseClasses = isOpponent
        ? "border-hair bg-paper-2 text-ink-3"
        : "border-emerald-500/30 bg-emerald-500/10 text-white";

    return (
        <div className={`rounded-lg border p-3 ${baseClasses}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold">{wordScore.word.toUpperCase()}</span>
                    <span className="text-xs text-ink-soft">({wordScore.length} letters)</span>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">+{wordScore.totalPoints}</p>
                    <p className="text-xs text-ink-soft">
                        {wordScore.lettersPoints} + {wordScore.bonusPoints} bonus
                    </p>
                </div>
            </div>
        </div>
    );
}

function formatDeltaLabel(delta: number): string {
    if (delta === 0) {
        return "0";
    }
    const prefix = delta > 0 ? "+" : "-";
    return `${prefix}${Math.abs(delta)}`;
}

function describeDelta(delta: number): string {
    if (delta === 0) {
        return "scored 0 points";
    }
    const verb = delta > 0 ? "gained" : "lost";
    const magnitude = Math.abs(delta);
    const noun = magnitude === 1 ? "point" : "points";
    return `${verb} ${magnitude} ${noun}`;
}

function buildSummaryAnnouncement(roundNumber: number, playerDelta: number, opponentDelta: number): string {
    return `Round ${roundNumber} complete. You ${describeDelta(playerDelta)}. Opponent ${describeDelta(opponentDelta)}.`;
}


