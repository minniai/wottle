"use client";

import { create } from "zustand";

import { subscribeToLobbyPresence } from "../realtime/presenceChannel";
import type { PresenceSubscription } from "../realtime/presenceChannel";
import { getBrowserSupabaseClient } from "../supabase/browser";
import type { PlayerIdentity } from "../types/match";

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
}

let activeSubscription: PresenceSubscription | null = null;
let trackedPlayerId: string | null = null;

export const useLobbyPresenceStore = create<LobbyPresenceState>((set, get) => ({
  players: [],
  status: "idle",
  connectionMode: "realtime",
  error: null,
  reconnecting: false,
  lastEventAt: null,
  async connect({ self, initialPlayers }) {
    if (initialPlayers) {
      set({
        players: normalizePlayers(initialPlayers),
        lastEventAt: Date.now(),
      });
    }

    if (!self) {
      disconnectActiveSubscription();
      set({
        status: "idle",
        connectionMode: "realtime",
        reconnecting: false,
        error: null,
      });
      trackedPlayerId = null;
      return;
    }

    if (trackedPlayerId === self.id && get().status === "ready") {
      return;
    }

    set({
      status: "connecting",
      reconnecting: Boolean(activeSubscription),
      error: null,
    });

    disconnectActiveSubscription();

    try {
      const client = getBrowserSupabaseClient();
      const subscription = subscribeToLobbyPresence<PlayerIdentity>(
        client,
        {
          onSync: (payload) => {
            set({
              players: applyLobbyEvent(get().players, {
                type: "sync",
                players: payload,
              }),
              status: "ready",
              connectionMode: "realtime",
              lastEventAt: Date.now(),
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
        }
      );

      activeSubscription = subscription;
      trackedPlayerId = self.id;

      subscription.channel.track({
        ...self,
        connectionId: createConnectionId(),
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
    disconnectActiveSubscription();
    set({
      status: "idle",
      reconnecting: false,
      connectionMode: "realtime",
    });
    trackedPlayerId = null;
  },
  setInitialPlayers(players) {
    set({
      players: normalizePlayers(players),
      lastEventAt: Date.now(),
    });
  },
}));

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
  const response = await fetch("/api/lobby/players", {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Snapshot request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { players?: PlayerIdentity[] };
  return payload.players ?? [];
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



