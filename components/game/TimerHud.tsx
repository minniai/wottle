"use client";

import { useEffect, useState } from "react";

interface TimerHudProps {
    timeLeft: number; // in seconds
    isPaused: boolean;
    roundNumber: number;
    hasSubmitted?: boolean;
}

export function TimerHud({ timeLeft, isPaused, roundNumber, hasSubmitted = false }: TimerHudProps) {
    const [displayTime, setDisplayTime] = useState(timeLeft);

    useEffect(() => {
        setDisplayTime(timeLeft);
    }, [timeLeft]);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setDisplayTime((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused]);

    const minutes = Math.floor(displayTime / 60);
    const seconds = displayTime % 60;

    return (
        <div className="flex items-center justify-between bg-paper-2 p-4 rounded-lg text-ink w-full max-w-md mx-auto mb-4" data-testid="timer-hud">
            <div className="text-xl font-bold" data-testid="round-indicator">
                Round {roundNumber}
            </div>
            <div className={`text-2xl font-mono ${!hasSubmitted ? "text-emerald-400" : "text-ink-soft"}`} data-testid="timer-display">
                {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            {isPaused && (
                <div className="text-sm text-yellow-400" data-testid="waiting-indicator">
                    Waiting for opponent...
                </div>
            )}
        </div>
    );
}
