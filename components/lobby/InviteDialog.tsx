"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  respondInviteAction,
  sendInviteAction,
} from "@/app/actions/matchmaking/sendInvite";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";

interface Opponent {
  id: string;
  username: string;
  displayName: string;
}

export interface IncomingInvite {
  id: string;
  sender: Opponent;
  expiresAt: string;
}

interface BaseProps {
  open: boolean;
  onClose: () => void;
}

interface SendInviteDialogProps extends BaseProps {
  variant: "send";
  opponent: Opponent;
}

interface ReceiveInviteDialogProps extends BaseProps {
  variant: "receive";
  invite: IncomingInvite;
}

type InviteDialogProps = SendInviteDialogProps | ReceiveInviteDialogProps;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "soon";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function InviteDialog(props: InviteDialogProps) {
  const titleId = useId();
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      ariaLabelledBy={titleId}
    >
      {props.variant === "send" ? (
        <SendBody
          titleId={titleId}
          opponent={props.opponent}
          onClose={props.onClose}
        />
      ) : (
        <ReceiveBody
          titleId={titleId}
          invite={props.invite}
          onClose={props.onClose}
        />
      )}
    </Dialog>
  );
}

function SendBody({
  titleId,
  opponent,
  onClose,
}: {
  titleId: string;
  opponent: Opponent;
  onClose: () => void;
}) {
  const { enqueue } = useToast();
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await sendInviteAction(opponent.id);
      if (result.status === "sent") {
        enqueue({
          tone: "success",
          title: `Invite sent to ${opponent.displayName}`,
        });
        onClose();
        return;
      }
      enqueue({
        tone: "error",
        title: "Invite failed",
        description: result.message ?? "Try again in a moment.",
      });
    });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2
          id={titleId}
          className="font-display text-lg font-semibold text-text-primary"
        >
          Challenge {opponent.displayName}
        </h2>
        <p className="text-sm text-text-secondary">
          They&apos;ll get 30 seconds to accept or decline.
        </p>
      </header>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={confirm}
          disabled={pending}
          data-testid="invite-dialog-confirm"
        >
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </div>
  );
}

function ReceiveBody({
  titleId,
  invite,
  onClose,
}: {
  titleId: string;
  invite: IncomingInvite;
  onClose: () => void;
}) {
  const router = useRouter();
  const { enqueue } = useToast();
  const [pending, startTransition] = useTransition();

  const respond = (decision: "accepted" | "declined") => {
    startTransition(async () => {
      const result = await respondInviteAction(invite.id, decision);
      if (result.status === "accepted" && result.matchId) {
        onClose();
        router.push(`/match/${result.matchId}`);
        return;
      }
      if (result.status === "declined") {
        enqueue({ tone: "info", title: "Invite declined." });
        onClose();
        return;
      }
      enqueue({
        tone: "error",
        title: "Could not update invite",
        description: result.message ?? "Try again in a moment.",
      });
    });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2
          id={titleId}
          className="font-display text-lg font-semibold text-text-primary"
        >
          {invite.sender.displayName} wants to play
        </h2>
        <p className="text-sm text-text-secondary">
          Respond before {formatTime(invite.expiresAt)}.
        </p>
      </header>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={() => respond("declined")}
          disabled={pending}
          data-testid="matchmaker-invite-decline"
        >
          Decline
        </Button>
        <Button
          onClick={() => respond("accepted")}
          disabled={pending}
          data-testid="matchmaker-invite-accept"
        >
          {pending ? "Joining…" : "Accept"}
        </Button>
      </div>
    </div>
  );
}
