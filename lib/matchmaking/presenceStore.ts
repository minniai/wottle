"use client";

import { create } from "zustand";

import { subscribeToLobbyPresence } from "../realtime/presenceChannel";
import { subscribeToLobbyPresencePollingOnly } from "../realtime/presenceChannel.polling";
import type { PresenceSubscription } from "../realtime/presenceChannel";
import { getBrowserSupabaseClient } from "../supabase/browser";
import type { LobbyStatus, PlayerIdentity } from "../types/match";

// Feature flag: disable Realtime and use polling only
const USE_POLLING_ONLY = typeof process !== "undefined" && 
  process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true";

export type LobbyPresenceEvent =
  | { type: "sync"; players: PlayerIdentity[] }
  | { type: "join"; player: PlayerIdentity }
  | { type: "leave"; playerId: string };

type ConnectionStatus = "idle" | "connecting" | "ready" | "error";
type ConnectionMode = "realtime" | "polling";

interface ConnectOptions {
  self: PlayerIdentity | null;
  initialPlayers?: PlayerIdentity[];
}

interface LobbyPresenceState {
  players: PlayerIdentity[];
  status: ConnectionStatus;
  connectionMode: ConnectionMode;
  error: string | null;
  reconnecting: boolean;
  lastEventAt: number | null;
  connect: (options: ConnectOptions) => Promise<void>;
  disconnect: () => void;
  setInitialPlayers: (players: PlayerIdentity[]) => void;
  updateSelfStatus: (status: LobbyStatus) => void;
}

let activeSubscription: PresenceSubscription | null = null;
let trackedPlayerId: string | null = null;
let trackedPlayer: PlayerIdentity | null = null;
let trackedConnectionId: string | null = null;

export const useLobbyPresenceStore = create<LobbyPresenceState>((set, get) => ({
  players: [],
  status: "idle",
  connectionMode: "realtime",
  error: null,
  reconnecting: false,
  lastEventAt: null,
  async connect({ self, initialPlayers }) {
    console.log("[presenceStore] connect() called", {
      hasSelf: Boolean(self),
      hasInitialPlayers: Boolean(initialPlayers),
      initialPlayersCount: initialPlayers?.length,
    });

    if (initialPlayers) {
      console.log("[presenceStore] Setting initial players:", initialPlayers.map(p => p.username));
      set({
        players: normalizePlayers(initialPlayers),
        lastEventAt: Date.now(),
      });
    }

    if (!self) {
      console.log("[presenceStore] No self provided, disconnecting");
      disconnectActiveSubscription();
      set({
        status: "idle",
        connectionMode: "realtime",
        reconnecting: false,
        error: null,
      });
      trackedPlayerId = null;
      trackedPlayer = null;
      trackedConnectionId = null;
      return;
    }

    if (trackedPlayerId === self.id && get().status === "ready") {
      console.log("[presenceStore] Already connected for this player, skipping");
      return;
    }

    console.log("[presenceStore] Starting connection for player:", self.username);
    set({
      status: "connecting",
      reconnecting: Boolean(activeSubscription),
      error: null,
    });

    disconnectActiveSubscription();

    try {
      const client = getBrowserSupabaseClient();
      
      // Choose implementation based on feature flag
      const subscribeFunction = USE_POLLING_ONLY 
        ? subscribeToLobbyPresencePollingOnly 
        : subscribeToLobbyPresence;
      
      console.log("[presenceStore] Using", USE_POLLING_ONLY ? "polling-only" : "realtime", "mode");
      
      const subscription = subscribeFunction<PlayerIdentity>(
        client,
        {
          onSync: (payload, source) => {
            set((state) => {
              // If Realtime sync has fewer players than we already have, it might be incomplete
              // Merge with existing players instead of replacing
              const currentPlayerCount = state.players.length;
              const newPlayerCount = payload.length;
              
              let finalPlayers = payload;
              
              // If Realtime sync has fewer players and we have existing players, merge them
              if (source === "realtime" && newPlayerCount < currentPlayerCount && currentPlayerCount > 0) {
                console.log(`[presenceStore] Realtime sync has ${newPlayerCount} players but we have ${currentPlayerCount}, merging...`);
                // Merge: keep existing players, add/update with Realtime data
                const existingPlayerIds = new Set(state.players.map(p => p.id));
                const newPlayerIds = new Set(payload.map((p: PlayerIdentity) => p.id));
                
                // Start with existing players
                const merged = [...state.players];
                
                // Update existing players with Realtime data
                payload.forEach((newPlayer: PlayerIdentity) => {
                  const index = merged.findIndex(p => p.id === newPlayer.id);
                  if (index >= 0) {
                    merged[index] = newPlayer; // Update
                  } else {
                    merged.push(newPlayer); // Add new
                  }
                });
                
                finalPlayers = merged;
              }
              
              return {
                players: applyLobbyEvent(state.players, {
                  type: "sync",
                  players: finalPlayers,
                }),
                status: "ready",
                connectionMode: source === "poller" ? "polling" : "realtime",
                lastEventAt: Date.now(),
              };
            });
          },
          onJoin: (player) => {
            set({
              players: applyLobbyEvent(get().players, {
                type: "join",
                player,
              }),
              lastEventAt: Date.now(),
            });
          },
          onLeave: (player) => {
            set({
              players: applyLobbyEvent(get().players, {
                type: "leave",
                playerId: player.id,
              }),
              lastEventAt: Date.now(),
            });
          },
          onError: (error) => {
            console.warn("Lobby presence channel error", error);
            set({
              status: "error",
              connectionMode: "polling",
              error:
                error instanceof Error
                  ? error.message
                  : "Realtime connection lost. Showing snapshot data.",
            });
          },
        },
        {
          key: self.id,
          poller: fetchPollingSnapshot,
          pollIntervalMs: 500,
        }
      );

      activeSubscription = subscription;
      trackedPlayerId = self.id;
      trackedConnectionId = createConnectionId();
      trackedPlayer = self;

      subscription.updatePresence({
        ...self,
        connectionId: trackedConnectionId,
        lastSeenAt: new Date().toISOString(),
      });

      set({
        status: "ready",
        connectionMode: "realtime",
        reconnecting: false,
        error: null,
        lastEventAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to initialize lobby presence", error);
      set({
        status: "error",
        connectionMode: "polling",
        error:
          error instanceof Error
            ? error.message
            : "Unable to join the lobby right now.",
      });
    }
  },
  disconnect() {
    console.log("[presenceStore] disconnect() called, trackedPlayerId:", trackedPlayerId);
    disconnectActiveSubscription();

    // Clean up presence record from database
    // Use keepalive to ensure request completes even if page is unloading
    if (trackedPlayerId) {
      console.log("[presenceStore] Sending DELETE request to /api/lobby/presence");
      fetch("/api/lobby/presence", {
        method: "DELETE",
        keepalive: true,
      }).then(() => {
        console.log("[presenceStore] DELETE request completed successfully");
      }).catch((error) => {
        console.warn("Failed to clean up presence on disconnect", error);
      });
    }

    set({
      status: "idle",
      reconnecting: false,
      connectionMode: "realtime",
    });
    trackedPlayerId = null;
    trackedPlayer = null;
    trackedConnectionId = null;
  },
  setInitialPlayers(players) {
    set({
      players: normalizePlayers(players),
      lastEventAt: Date.now(),
    });
  },
  updateSelfStatus(status) {
    if (!trackedPlayerId || !trackedPlayer || !activeSubscription || !trackedConnectionId) {
      return;
    }

    trackedPlayer = {
      ...trackedPlayer,
      status,
      lastSeenAt: new Date().toISOString(),
    };

    activeSubscription.updatePresence({
      ...trackedPlayer,
      connectionId: trackedConnectionId,
    });

    set({
      players: applyLobbyEvent(get().players, {
        type: "join",
        player: trackedPlayer,
      }),
      lastEventAt: Date.now(),
    });
  },
}));

// Expose store to window for testing
if (typeof window !== "undefined") {
  (window as any).useLobbyPresenceStore = useLobbyPresenceStore;
}

export function applyLobbyEvent(
  players: PlayerIdentity[],
  event: LobbyPresenceEvent
): PlayerIdentity[] {
  switch (event.type) {
    case "sync":
      return normalizePlayers(event.players);
    case "join":
      return normalizePlayers(upsert(players, event.player));
    case "leave":
      return players.filter((player) => player.id !== event.playerId);
    default:
      return players;
  }
}

function normalizePlayers(players: PlayerIdentity[]): PlayerIdentity[] {
  return sortPlayers(dedupe(players));
}

function dedupe(players: PlayerIdentity[]): PlayerIdentity[] {
  const map = new Map<string, PlayerIdentity>();
  players.forEach((player) => {
    map.set(player.id, player);
  });
  return Array.from(map.values());
}

function sortPlayers(players: PlayerIdentity[]): PlayerIdentity[] {
  return [...players].sort((a, b) => a.username.localeCompare(b.username));
}

function upsert(
  collection: PlayerIdentity[],
  next: PlayerIdentity
): PlayerIdentity[] {
  const existingIndex = collection.findIndex((player) => player.id === next.id);
  if (existingIndex === -1) {
    return [...collection, next];
  }
  const clone = [...collection];
  clone[existingIndex] = next;
  return clone;
}

async function fetchPollingSnapshot(): Promise<PlayerIdentity[]> {
  console.log("[presenceStore] Polling /api/lobby/players...");
  const response = await fetch("/api/lobby/players", {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[presenceStore] Polling failed with status:", response.status);
    throw new Error(`Snapshot request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { players?: PlayerIdentity[] };
  const players = payload.players ?? [];
  console.log("[presenceStore] Polling returned", players.length, "players:", players.map(p => p.username));
  return players;
}

function disconnectActiveSubscription() {
  if (!activeSubscription) {
    return;
  }

  activeSubscription.stopPolling();
  activeSubscription = null;
}

function createConnectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `conn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}



