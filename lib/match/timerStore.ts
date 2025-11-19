"use client";

import { create } from "zustand";
import type { TimerState } from "@/lib/types/match";

interface TimerStore {
    playerATimer: TimerState | null;
    playerBTimer: TimerState | null;
    isPlayerAPaused: boolean;
    isPlayerBPaused: boolean;
    setTimers: (playerA: TimerState, playerB: TimerState) => void;
    pausePlayerA: () => void;
    pausePlayerB: () => void;
    resumePlayerA: () => void;
    resumePlayerB: () => void;
    updateTimer: (playerId: string, remainingMs: number, status: "running" | "paused" | "expired") => void;
    getPlayerTimer: (playerId: string) => TimerState | null;
    getIsPaused: (playerId: string) => boolean;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
    playerATimer: null,
    playerBTimer: null,
    isPlayerAPaused: false,
    isPlayerBPaused: false,

    setTimers: (playerA, playerB) => {
        set({
            playerATimer: playerA,
            playerBTimer: playerB,
            isPlayerAPaused: playerA.status === "paused",
            isPlayerBPaused: playerB.status === "paused",
        });
    },

    pausePlayerA: () => {
        const current = get().playerATimer;
        if (current) {
            set({
                playerATimer: { ...current, status: "paused" },
                isPlayerAPaused: true,
            });
        }
    },

    pausePlayerB: () => {
        const current = get().playerBTimer;
        if (current) {
            set({
                playerBTimer: { ...current, status: "paused" },
                isPlayerBPaused: true,
            });
        }
    },

    resumePlayerA: () => {
        const current = get().playerATimer;
        if (current && current.status !== "expired") {
            set({
                playerATimer: { ...current, status: "running" },
                isPlayerAPaused: false,
            });
        }
    },

    resumePlayerB: () => {
        const current = get().playerBTimer;
        if (current && current.status !== "expired") {
            set({
                playerBTimer: { ...current, status: "running" },
                isPlayerBPaused: false,
            });
        }
    },

    updateTimer: (playerId, remainingMs, status) => {
        const state = get();
        const isPlayerA = state.playerATimer?.playerId === playerId;
        const isPlayerB = state.playerBTimer?.playerId === playerId;

        if (isPlayerA) {
            set({
                playerATimer: {
                    playerId,
                    remainingMs,
                    status,
                },
                isPlayerAPaused: status === "paused",
            });
        } else if (isPlayerB) {
            set({
                playerBTimer: {
                    playerId,
                    remainingMs,
                    status,
                },
                isPlayerBPaused: status === "paused",
            });
        }
    },

    getPlayerTimer: (playerId) => {
        const state = get();
        if (state.playerATimer?.playerId === playerId) {
            return state.playerATimer;
        }
        if (state.playerBTimer?.playerId === playerId) {
            return state.playerBTimer;
        }
        return null;
    },

    getIsPaused: (playerId) => {
        const state = get();
        if (state.playerATimer?.playerId === playerId) {
            return state.isPlayerAPaused;
        }
        if (state.playerBTimer?.playerId === playerId) {
            return state.isPlayerBPaused;
        }
        return false;
    },
}));

