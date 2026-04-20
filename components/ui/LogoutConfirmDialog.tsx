"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export interface LogoutConfirmDialogProps {
  open: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({
  open,
  pending = false,
  onCancel,
  onConfirm,
}: LogoutConfirmDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      ariaLabelledBy="logout-confirm-title"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2
          id="logout-confirm-title"
          className="font-display text-[22px] italic leading-tight text-ink"
        >
          Sign out now?
        </h2>
        <p className="text-[14px] leading-[1.5] text-ink-3">
          You&rsquo;ll forfeit your current match. Your opponent will be
          awarded the win.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Stay signed in
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Signing out…" : "Sign out & forfeit"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
