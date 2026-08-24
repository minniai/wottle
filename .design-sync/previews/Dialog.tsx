import { Button, Dialog } from "wottle";

const noop = () => {};

export function InviteChallenge() {
  return (
    <Dialog
      open
      onClose={noop}
      ariaLabelledBy="invite-title"
      ariaDescribedBy="invite-desc"
      bottomSheetOnMobile={false}
    >
      <h2 id="invite-title" className="font-display text-xl font-semibold">
        Challenge Kári?
      </h2>
      <p id="invite-desc" className="text-sm text-ink-soft" style={{ marginTop: 8 }}>
        Kári (1487 Elo) will have 30 seconds to accept your invite before it
        expires.
      </p>
      <div
        style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}
      >
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Send invite</Button>
      </div>
    </Dialog>
  );
}

export function ConfirmResign() {
  return (
    <Dialog
      open
      onClose={noop}
      ariaLabelledBy="resign-title"
      ariaDescribedBy="resign-desc"
      bottomSheetOnMobile={false}
    >
      <h2 id="resign-title" className="font-display text-xl font-semibold">
        Resign this match?
      </h2>
      <p id="resign-desc" className="text-sm text-ink-soft" style={{ marginTop: 8 }}>
        Elín will be awarded the win and your rating will drop. This cannot be
        undone.
      </p>
      <div
        style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}
      >
        <Button variant="ghost">Keep playing</Button>
        <Button variant="danger">Resign</Button>
      </div>
    </Dialog>
  );
}
