"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { sendInviteAction, respondInviteAction } from "../../app/actions/matchmaking/sendInvite";
import { startQueueAction } from "../../app/actions/matchmaking/startQueue";
import { useLobbyPresenceStore } from "../../lib/matchmaking/presenceStore";
import type { PlayerIdentity } from "../../lib/types/match";

interface MatchmakerControlsProps {
  self: PlayerIdentity;
}

interface ToastState {
  tone: "success" | "error";
  message: string;
}

interface PendingInvite {
  id: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
  };
  expiresAt: string;
}

export function MatchmakerControls({ self }: MatchmakerControlsProps) {
  const router = useRouter();
  const players = useLobbyPresenceStore((state) => state.players);
  const presenceStatus = useLobbyPresenceStore((state) => state.status);
  const updateSelfStatus = useLobbyPresenceStore((state) => state.updateSelfStatus);
  const [isQueueing, startQueue] = useTransition();
  const [isInviting, startInvite] = useTransition();
  const [isResponding, startRespond] = useTransition();

  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<PendingInvite | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const pendingNavigationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pendingNavigationRef.current) {
        clearTimeout(pendingNavigationRef.current);
      }
    };
  }, []);

  const inviteTargets = useMemo(
    () =>
      players.filter(
        (player) => player.id !== self.id && player.status !== "in_match"
      ),
    [players, self.id]
  );

  const handleMatchReady = useCallback(
    (matchId: string | null | undefined) => {
      if (!matchId || activeMatchId === matchId) {
        return;
      }
      setActiveMatchId(matchId);
      updateSelfStatus("in_match");
      setQueueStatus(null);
      setIncomingInvite(null);
      setShowInviteModal(false);
      setToast({ tone: "success", message: "Match found. Loading…" });
      if (pendingNavigationRef.current) {
        clearTimeout(pendingNavigationRef.current);
      }
      pendingNavigationRef.current = setTimeout(() => {
        router.push(`/match/${matchId}`);
      }, 300);
    },
    [activeMatchId, router, updateSelfStatus]
  );

  useEffect(() => {
    let cancelled = false;

    async function pollMatchmakingState() {
      try {
        const [inviteResponse, matchResponse] = await Promise.all([
          fetch("/api/lobby/invite", { cache: "no-store" }),
          fetch("/api/match/active", { cache: "no-store" }),
        ]);

        if (cancelled) {
          return;
        }

        if (inviteResponse.ok) {
          const payload = (await inviteResponse.json()) as {
            pending?: PendingInvite[];
          };
          setIncomingInvite(payload.pending?.[0] ?? null);
        } else {
          setIncomingInvite(null);
        }

        if (matchResponse.ok) {
          const payload = (await matchResponse.json()) as {
            match?: { id: string | null } | null;
          };
          handleMatchReady(payload.match?.id ?? null);
        }
      } catch {
        if (!cancelled) {
          setIncomingInvite(null);
        }
      }
    }

    pollMatchmakingState();
    const timer = setInterval(pollMatchmakingState, 3_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [handleMatchReady]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 4_000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleStartQueue = () => {
    startQueue(async () => {
      setQueueStatus("looking for an opponent…");
      const result = await startQueueAction();
      if (result.status === "matched" && result.matchId) {
        handleMatchReady(result.matchId);
        return;
      }

      if (result.status === "queued") {
        updateSelfStatus("matchmaking");
        setQueueStatus("looking… we’ll notify you when a match is ready.");
        return;
      }

      if (result.status === "unauthenticated") {
        setToast({ tone: "error", message: result.message ?? "Please log in." });
        setQueueStatus(null);
        return;
      }

      setQueueStatus(null);
      updateSelfStatus("available");
      setToast({
        tone: "error",
        message: result.message ?? "Matchmaking failed. Try again.",
      });
    });
  };

  const handleSendInvite = (targetId: string) => {
    startInvite(async () => {
      const result = await sendInviteAction(targetId);
      if (result.status === "sent") {
        updateSelfStatus("matchmaking");
        setToast({ tone: "success", message: "Invite sent. Waiting for response…" });
        setShowInviteModal(false);
        return;
      }
      if (result.status === "unauthenticated") {
        setToast({ tone: "error", message: result.message ?? "Please log in." });
        return;
      }
      setToast({
        tone: "error",
        message: result.message ?? "Unable to send invite.",
      });
    });
  };

  const handleRespondInvite = (decision: "accepted" | "declined") => {
    const inviteId = incomingInvite?.id;
    if (!inviteId) {
      return;
    }

    startRespond(async () => {
      const result = await respondInviteAction(inviteId, decision);
      if (result.status === "accepted" && result.matchId) {
        handleMatchReady(result.matchId);
        return;
      }
      if (result.status === "declined") {
        updateSelfStatus("available");
        setIncomingInvite(null);
        setToast({ tone: "success", message: "Invite declined." });
        return;
      }
      if (result.status === "unauthenticated") {
        setToast({ tone: "error", message: result.message ?? "Please log in." });
        return;
      }
      setToast({
        tone: "error",
        message: result.message ?? "Unable to update invite.",
      });
    });
  };

  return (
    <div
      className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-white"
      data-testid="matchmaker-controls"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-white">Start a Playtest Match</p>
          <p className="text-xs text-white/60">
            Queue automatically or send a direct invite to someone in the lobby.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full border border-white/20 bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="matchmaker-start-button"
            onClick={handleStartQueue}
            disabled={isQueueing}
          >
            {isQueueing ? "Matching…" : "Start Game"}
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/15 disabled:opacity-50"
            data-testid="matchmaker-invite-button"
            onClick={() => setShowInviteModal(true)}
            disabled={isInviting || presenceStatus !== "ready"}
            title={presenceStatus !== "ready" ? "Connecting to lobby..." : undefined}
          >
            {isInviting ? "Sending…" : "Invite Player"}
          </button>
        </div>
      </div>

      {queueStatus && (
        <p
          className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          data-testid="matchmaker-queue-status"
        >
          {queueStatus}
        </p>
      )}

      {incomingInvite && (
        <div
          className="mt-4 flex flex-col gap-3 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 text-sm text-white"
          data-testid="matchmaker-invite-banner"
        >
          <p className="text-base font-semibold text-white">
            {incomingInvite.sender.displayName} wants to play
          </p>
          <p className="text-white/70">
            Respond before{" "}
            {new Date(incomingInvite.expiresAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 disabled:opacity-50"
              data-testid="matchmaker-invite-accept"
              onClick={() => handleRespondInvite("accepted")}
              disabled={isResponding}
            >
              {isResponding ? "Joining…" : "Accept"}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50"
              data-testid="matchmaker-invite-decline"
              onClick={() => handleRespondInvite("declined")}
              disabled={isResponding}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            toast.tone === "success"
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
              : "border-rose-400/40 bg-rose-500/10 text-rose-100"
          }`}
          data-testid="matchmaker-toast"
        >
          {toast.message}
        </div>
      )}

      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/60">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-white">Invite a tester</p>
                <p className="text-xs text-white/60">Select someone currently online.</p>
              </div>
              <button
                type="button"
                className="text-white/60 hover:text-white"
                onClick={() => setShowInviteModal(false)}
                aria-label="Close invite modal"
              >
                ×
              </button>
            </header>

            <div
              className="mt-4 max-h-72 space-y-3 overflow-y-auto"
              data-testid="matchmaker-invite-modal"
            >
              {inviteTargets.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-white/70">
                  No available testers right now. Try again once someone joins.
                </p>
              )}
              {inviteTargets.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80"
                  data-testid="invite-option"
                >
                  <div>
                    <p className="font-semibold text-white">{player.displayName}</p>
                    <p className="text-xs text-white/60">@{player.username}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    onClick={() => handleSendInvite(player.id)}
                    disabled={isInviting}
                  >
                    Invite
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


