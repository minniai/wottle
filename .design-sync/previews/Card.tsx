import { Avatar, Badge, Button, Card } from "wottle";

export function Elevations() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 220px))",
        gap: 16,
      }}
    >
      <Card elevation={0}>
        <p className="font-semibold">Elevation 0</p>
        <p className="text-sm text-ink-soft">Flush with the page paper.</p>
      </Card>
      <Card elevation={1}>
        <p className="font-semibold">Elevation 1</p>
        <p className="text-sm text-ink-soft">Default lobby surface.</p>
      </Card>
      <Card elevation={2}>
        <p className="font-semibold">Elevation 2</p>
        <p className="text-sm text-ink-soft">Raised panels and rails.</p>
      </Card>
      <Card elevation={3}>
        <p className="font-semibold">Elevation 3</p>
        <p className="text-sm text-ink-soft">Overlays and popovers.</p>
      </Card>
    </div>
  );
}

export function LobbyPlayerCard() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Card elevation={1}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar playerId="player-kari-02" displayName="Kári Stefánsson" size="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="font-semibold">Kári</p>
            <p className="text-sm text-ink-soft">1487 Elo · 12 matches</p>
          </div>
          <Badge variant="available" pulse>
            Available
          </Badge>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <Button size="sm">Challenge</Button>
          <Button size="sm" variant="ghost">
            View profile
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function InteractiveCard() {
  return (
    <div style={{ maxWidth: 340 }}>
      <Card elevation={2} interactive tabIndex={0}>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Recent game
        </p>
        <p className="font-semibold" style={{ marginTop: 6 }}>
          Birna vs Elín — 214 : 187
        </p>
        <p className="text-sm text-ink-soft" style={{ marginTop: 2 }}>
          Best word: VINUR (+18) · 5 rounds
        </p>
      </Card>
    </div>
  );
}
