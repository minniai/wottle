import { ProfileStat } from "wottle";

export function SingleStat() {
  return (
    <div style={{ maxWidth: 160 }}>
      <ProfileStat label="Rating" value={1284} />
    </div>
  );
}

export function StatRow() {
  return (
    <div style={{ display: "flex", gap: 32, maxWidth: 480 }}>
      <ProfileStat label="Rating" value={1284} />
      <ProfileStat label="Matches" value={47} />
      <ProfileStat label="Win rate" value="62%" />
      <ProfileStat label="Best word" value="SKÁLDSKAPUR" />
    </div>
  );
}
