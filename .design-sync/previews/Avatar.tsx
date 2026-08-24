import { Avatar } from "wottle";

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Avatar playerId="player-birna-01" displayName="Birna" size="sm" />
      <Avatar playerId="player-kari-02" displayName="Kári" size="md" />
      <Avatar playerId="player-elin-03" displayName="Elín" size="lg" />
    </div>
  );
}

export function IdentityGradients() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Avatar playerId="player-birna-01" displayName="Birna Jónsdóttir" />
      <Avatar playerId="player-kari-02" displayName="Kári Stefánsson" />
      <Avatar playerId="player-thordis-04" displayName="Þórdís" />
      <Avatar playerId="player-orn-05" displayName="Örn Arnarson" />
      <Avatar playerId="player-anon-06" displayName="" />
    </div>
  );
}

export function MatchSlotColors() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar
        playerId="player-birna-01"
        displayName="Birna"
        colorOverride="var(--p1)"
      />
      <Avatar
        playerId="player-kari-02"
        displayName="Kári"
        colorOverride="var(--p2)"
      />
    </div>
  );
}

export function ProfileHero() {
  return (
    <Avatar playerId="player-elin-03" displayName="Elín Ósk" size="xl" />
  );
}
