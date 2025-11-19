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
    // Track summary ID to reset timer when summary changes
    const summaryIdRef = useRef<string | null>(null);
    const currentSummaryId = summary ? `${summary.matchId}-${summary.roundNumber}` : null;

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

    if (!summary) {
        return null;
    }

    // Group words by player
    const playerAWords = summary.words.filter((w) => {
        // For now, assume first word's playerId is playerA
        // In a real implementation, we'd get this from match state
        return summary.words.length > 0 && w.playerId === summary.words[0]?.playerId;
    });
    const playerBWords = summary.words.filter((w) => w.playerId !== playerAWords[0]?.playerId);

    const currentPlayerWords =
        playerAWords[0]?.playerId === currentPlayerId ? playerAWords : playerBWords;
    const opponentWords =
        playerAWords[0]?.playerId === currentPlayerId ? playerBWords : playerAWords;

    const hasWords = summary.words.length > 0;

    return (
        <div
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm"
            data-testid="round-summary-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="round-summary-title"
        >
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

            {!hasWords ? (
                <div className="text-center py-8 text-white/70">
                    <p className="text-lg">No new words scored this round</p>
                    <p className="text-sm mt-2">Scores remain unchanged</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Score Totals */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                            <p className="text-xs uppercase tracking-wide text-emerald-200/80 mb-1">
                                Your Score
                            </p>
                            <p className="text-2xl font-bold text-emerald-200">
                                {summary.totals.playerA}
                            </p>
                            <p className="text-sm text-emerald-300/80 mt-1">
                                +{summary.deltas.playerA} this round
                            </p>
                        </div>
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                            <p className="text-xs uppercase tracking-wide text-sky-200/80 mb-1">
                                Opponent Score
                            </p>
                            <p className="text-2xl font-bold text-sky-200">
                                {summary.totals.playerB}
                            </p>
                            <p className="text-sm text-sky-300/80 mt-1">
                                +{summary.deltas.playerB} this round
                            </p>
                        </div>
                    </div>

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
        </div>
    );
}

function WordScoreRow({ wordScore, isOpponent = false }: { wordScore: WordScore; isOpponent?: boolean }) {
    return (
        <div
            className={`rounded-lg border p-3 ${
                isOpponent
                    ? "border-white/10 bg-white/5 text-white/80"
                    : "border-emerald-500/30 bg-emerald-500/10 text-white"
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold">{wordScore.word.toUpperCase()}</span>
                    <span className="text-xs text-white/60">({wordScore.length} letters)</span>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">+{wordScore.totalPoints}</p>
                    <p className="text-xs text-white/60">
                        {wordScore.lettersPoints} + {wordScore.bonusPoints} bonus
                    </p>
                </div>
            </div>
        </div>
    );
}

