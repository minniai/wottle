import { ProfileSparkline } from "wottle";

const climbing = [
  1180, 1195, 1188, 1204, 1219, 1211, 1230, 1247, 1239, 1258, 1266, 1284,
];

const volatile = [
  1320, 1298, 1311, 1287, 1265, 1281, 1296, 1274, 1252, 1268, 1244, 1229,
];

export function ClimbingForm() {
  return (
    <div style={{ maxWidth: 320 }}>
      <ProfileSparkline ratings={climbing} peak={1284} current={1284} />
    </div>
  );
}

export function SlidingForm() {
  return (
    <div style={{ maxWidth: 320 }}>
      <ProfileSparkline ratings={volatile} peak={1320} current={1229} />
    </div>
  );
}
