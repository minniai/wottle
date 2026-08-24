import { Avatar, MatchRing } from "wottle";

// MatchRing has no phase props — it is a spinning conic-gradient ring that
// wraps whatever the matchmaking screen puts inside it. These cells mirror the
// searching phase composition from MatchmakingClient.

export function SearchingSelf() {
  return (
    <div style={{ maxWidth: 360, display: "grid", justifyItems: "center", gap: 24 }}>
      <MatchRing>
        <Avatar
          playerId="player-elin"
          displayName="Elín"
          avatarUrl={null}
          size="lg"
        />
      </MatchRing>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
        Elapsed · 7s
      </p>
    </div>
  );
}

export function SearchingAlt() {
  return (
    <div style={{ maxWidth: 360, display: "grid", justifyItems: "center" }}>
      <MatchRing>
        <Avatar
          playerId="player-kari"
          displayName="Kári"
          avatarUrl={null}
          size="lg"
        />
      </MatchRing>
    </div>
  );
}
