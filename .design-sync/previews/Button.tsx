import { Button } from "wottle";

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Button variant="primary">Play now</Button>
      <Button variant="secondary">Invite</Button>
      <Button variant="ghost">View profile</Button>
      <Button variant="danger">Resign</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Button size="sm">Rematch</Button>
      <Button size="md">Play now</Button>
      <Button size="lg">Find a match</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Button disabled>Play now</Button>
      <Button variant="secondary" disabled>
        Invite
      </Button>
    </div>
  );
}
