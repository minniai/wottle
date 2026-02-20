"use client";

import { useEffect, useRef } from "react";
import type { RoundSummary, WordScore } from "@/lib/types/match";

interface RoundSummaryPanelProps {
    summary: RoundSummary | null;
    currentPlayerId: string;
    onDismiss?: () => void;
    autoDismissMs?: number;
}

export function RoundSummaryPanel({
    summary,
    currentPlayerId,
    onDismiss,
    autoDismissMs = 3000,
}: RoundSummaryPanelProps) {
    const summaryIdRef = useRef<string | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const liveRegionRef = useRef<HTMLDivElement | null>(null);
    const currentSummaryId = summary ? `${summary.matchId}-${summary.roundNumber}` : null;
    const words = summary?.words ?? [];
    const firstPlayerId = words[0]?.playerId ?? null;
    const playerAWords =
        firstPlayerId !== null ? words.filter((word) => word.playerId === firstPlayerId) : [];
    const playerBWords =
        firstPlayerId !== null ? words.filter((word) => word.playerId !== firstPlayerId) : words;
    const currentPlayerIsPlayerA =
        firstPlayerId !== null ? firstPlayerId === currentPlayerId : true;
    const currentPlayerWords = currentPlayerIsPlayerA ? playerAWords : playerBWords;
    const opponentWords = currentPlayerIsPlayerA ? playerBWords : playerAWords;
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
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm"
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
                <h2 id="round-summary-title" className="text-xl font-bold text-white">
                    Round {summary.roundNumber} Summary
                </h2>
                {onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="text-white/60 hover:text-white"
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
                <div className="text-center py-4 text-white/70">
                    <p className="text-sm">No new words scored this round</p>
                </div>
            ) : (
                <div className="space-y-6 mt-4">
                    {/* Words List */}
                    {currentPlayerWords.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-white mb-3">Your Words</h3>
                            <div className="space-y-2">
                                {currentPlayerWords.map((word, idx) => (
                                    <WordScoreRow key={`${word.word}-${idx}`} wordScore={word} />
                                ))}
                            </div>
                        </div>
                    )}

                    {opponentWords.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-white/70 mb-3">
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
    const isDuplicate = wordScore.isDuplicate === true;
    const baseClasses = isOpponent
        ? "border-white/10 bg-white/5 text-white/80"
        : "border-emerald-500/30 bg-emerald-500/10 text-white";
    const duplicateClasses = "border-white/10 bg-white/5 text-white/60 opacity-75";

    return (
        <div
            className={`rounded-lg border p-3 ${isDuplicate ? duplicateClasses : baseClasses}`}
            data-testid={isDuplicate ? "word-previously-scored" : undefined}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold">{wordScore.word.toUpperCase()}</span>
                    <span className="text-xs text-white/60">({wordScore.length} letters)</span>
                    {isDuplicate && (
                        <span className="text-xs italic text-white/70">— previously scored</span>
                    )}
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">{isDuplicate ? "0" : `+${wordScore.totalPoints}`}</p>
                    {!isDuplicate && (
                        <p className="text-xs text-white/60">
                            {wordScore.lettersPoints} + {wordScore.bonusPoints} bonus
                        </p>
                    )}
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


