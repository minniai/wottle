import { Toast } from "wottle";

const noop = () => {};

export function Success() {
  return (
    <div style={{ maxWidth: 360 }}>
      <Toast
        message={{
          id: "toast-success",
          tone: "success",
          title: "Invite sent to Kári",
          description: "He has 30 seconds to accept.",
          autoDismissMs: null,
        }}
        onDismiss={noop}
      />
    </div>
  );
}

export function ErrorTone() {
  return (
    <div style={{ maxWidth: 360 }}>
      <Toast
        message={{
          id: "toast-error",
          tone: "error",
          title: "Move rejected",
          description: "That tile is frozen — pick an unfrozen tile.",
          autoDismissMs: null,
        }}
        onDismiss={noop}
      />
    </div>
  );
}

export function InfoTone() {
  return (
    <div style={{ maxWidth: 360 }}>
      <Toast
        message={{
          id: "toast-info",
          tone: "info",
          title: "Birna joined the lobby",
          autoDismissMs: null,
        }}
        onDismiss={noop}
      />
    </div>
  );
}
