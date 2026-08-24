import { ProfileRatingChart } from "wottle";

const day = (n: number) =>
  new Date(Date.UTC(2026, 6, 20 + n, 18, 30)).toISOString();

const monthOfMatches = [
  1204, 1219, 1211, 1198, 1214, 1230, 1247, 1239, 1226, 1241, 1258, 1250,
  1266, 1281, 1273, 1284,
].map((rating, i) => ({ recordedAt: day(i * 2), rating }));

export function ThirtyDayHistory() {
  return (
    <div style={{ maxWidth: 620 }}>
      <ProfileRatingChart history={monthOfMatches} />
    </div>
  );
}

export function NoRatedMatches() {
  return (
    <div style={{ maxWidth: 620 }}>
      <ProfileRatingChart history={[]} />
    </div>
  );
}
