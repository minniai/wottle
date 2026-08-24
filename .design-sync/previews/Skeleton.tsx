import { Card, Skeleton } from "wottle";

export function TextLines() {
  return (
    <div style={{ maxWidth: 300, display: "grid", gap: 10 }}>
      <Skeleton style={{ height: 16, width: "70%" }} />
      <Skeleton style={{ height: 12, width: "100%" }} />
      <Skeleton style={{ height: 12, width: "85%" }} />
      <Skeleton style={{ height: 12, width: "55%" }} />
    </div>
  );
}

export function Shapes() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Skeleton shape="circle" style={{ height: 48, width: 48 }} />
      <Skeleton shape="circle" style={{ height: 32, width: 32 }} />
      <Skeleton style={{ height: 40, width: 120, borderRadius: 9999 }} />
      <Skeleton style={{ height: 40, width: 96 }} />
    </div>
  );
}

export function LobbyCardLoading() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Card elevation={1}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Skeleton shape="circle" style={{ height: 48, width: 48 }} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}>
            <Skeleton style={{ height: 14, width: "50%" }} />
            <Skeleton style={{ height: 11, width: "75%" }} />
          </div>
          <Skeleton style={{ height: 24, width: 76, borderRadius: 9999 }} />
        </div>
      </Card>
    </div>
  );
}
