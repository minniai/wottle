import { Badge } from "wottle";

export function LobbyStatuses() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <Badge variant="available">Available</Badge>
      <Badge variant="matchmaking">Matchmaking</Badge>
      <Badge variant="in_match">In match</Badge>
      <Badge variant="offline">Offline</Badge>
    </div>
  );
}

export function InfoAndWarning() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <Badge variant="info">Series 2–1</Badge>
      <Badge variant="info">1512 Elo</Badge>
      <Badge variant="warning">Reconnecting…</Badge>
    </div>
  );
}

export function WithPulse() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <Badge variant="available" pulse>
        Birna is online
      </Badge>
      <Badge variant="matchmaking" pulse>
        Searching for opponent
      </Badge>
    </div>
  );
}
