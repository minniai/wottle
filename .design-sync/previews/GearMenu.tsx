import { GearMenu } from "wottle";

export function Trigger() {
  return (
    <div style={{ display: "inline-flex", padding: 8 }}>
      <GearMenu />
    </div>
  );
}

export function InTopBarRow() {
  return (
    <div style={{ maxWidth: 360 }}>
      <div
        className="border-hair bg-paper"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: "1px solid var(--hair)",
          padding: "8px 16px",
        }}
      >
        <span className="font-display text-lg font-semibold">Wottle</span>
        <GearMenu />
      </div>
    </div>
  );
}
