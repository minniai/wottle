import { beforeEach, describe, expect, it } from "vitest";
import { useTimerStore } from "@/lib/match/timerStore";
import type { TimerState } from "@/lib/types/match";

describe("TimerStore", () => {
  beforeEach(() => {
    // Reset store state before each test to ensure isolation
    useTimerStore.setState({
      playerATimer: null,
      playerBTimer: null,
      isPlayerAPaused: false,
      isPlayerBPaused: false,
    });
  });
  it("should initialize with null timers", () => {
    const store = useTimerStore.getState();
    expect(store.playerATimer).toBeNull();
    expect(store.playerBTimer).toBeNull();
    expect(store.isPlayerAPaused).toBe(false);
    expect(store.isPlayerBPaused).toBe(false);
  });

  it("should set timers for both players", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "running",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);

    const state = useTimerStore.getState();
    expect(state.playerATimer).toEqual(playerA);
    expect(state.playerBTimer).toEqual(playerB);
    expect(state.isPlayerAPaused).toBe(false);
    expect(state.isPlayerBPaused).toBe(false);
  });

  it("should pause player A timer", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "running",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);
    useTimerStore.getState().pausePlayerA();

    const state = useTimerStore.getState();
    expect(state.playerATimer?.status).toBe("paused");
    expect(state.isPlayerAPaused).toBe(true);
    expect(state.playerBTimer?.status).toBe("running");
    expect(state.isPlayerBPaused).toBe(false);
  });

  it("should pause player B timer", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "running",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);
    useTimerStore.getState().pausePlayerB();

    const state = useTimerStore.getState();
    expect(state.playerBTimer?.status).toBe("paused");
    expect(state.isPlayerBPaused).toBe(true);
    expect(state.playerATimer?.status).toBe("running");
    expect(state.isPlayerAPaused).toBe(false);
  });

  it("should resume player A timer", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "paused",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);
    useTimerStore.getState().resumePlayerA();

    const state = useTimerStore.getState();
    expect(state.playerATimer?.status).toBe("running");
    expect(state.isPlayerAPaused).toBe(false);
  });

  it("should resume player B timer", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "running",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "paused",
    };

    useTimerStore.getState().setTimers(playerA, playerB);
    useTimerStore.getState().resumePlayerB();

    const state = useTimerStore.getState();
    expect(state.playerBTimer?.status).toBe("running");
    expect(state.isPlayerBPaused).toBe(false);
  });

  it("should not resume expired timer", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 0,
      status: "expired",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);
    useTimerStore.getState().resumePlayerA();

    const state = useTimerStore.getState();
    expect(state.playerATimer?.status).toBe("expired");
    expect(state.isPlayerAPaused).toBe(false); // Expired is not paused
  });

  it("should update timer by player ID", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "running",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);
    useTimerStore.getState().updateTimer("player-a", 250_000, "paused");

    const state = useTimerStore.getState();
    expect(state.playerATimer?.remainingMs).toBe(250_000);
    expect(state.playerATimer?.status).toBe("paused");
    expect(state.isPlayerAPaused).toBe(true);
  });

  it("should get player timer by ID", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "running",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);

    const timerA = useTimerStore.getState().getPlayerTimer("player-a");
    const timerB = useTimerStore.getState().getPlayerTimer("player-b");
    const timerC = useTimerStore.getState().getPlayerTimer("player-c");

    expect(timerA).toEqual(playerA);
    expect(timerB).toEqual(playerB);
    expect(timerC).toBeNull();
  });

  it("should get pause status by player ID", () => {
    const playerA: TimerState = {
      playerId: "player-a",
      remainingMs: 300_000,
      status: "paused",
    };
    const playerB: TimerState = {
      playerId: "player-b",
      remainingMs: 300_000,
      status: "running",
    };

    useTimerStore.getState().setTimers(playerA, playerB);

    expect(useTimerStore.getState().getIsPaused("player-a")).toBe(true);
    expect(useTimerStore.getState().getIsPaused("player-b")).toBe(false);
    expect(useTimerStore.getState().getIsPaused("player-c")).toBe(false);
  });

  it("should handle pause when timer is null", () => {
    useTimerStore.getState().pausePlayerA();
    useTimerStore.getState().pausePlayerB();

    const state = useTimerStore.getState();
    expect(state.playerATimer).toBeNull();
    expect(state.playerBTimer).toBeNull();
    // Pause operations should not crash when timers are null
  });

  it("should handle resume when timer is null", () => {
    useTimerStore.getState().resumePlayerA();
    useTimerStore.getState().resumePlayerB();

    const state = useTimerStore.getState();
    expect(state.playerATimer).toBeNull();
    expect(state.playerBTimer).toBeNull();
    // Resume operations should not crash when timers are null
  });
});
