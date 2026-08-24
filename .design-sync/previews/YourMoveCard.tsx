import { YourMoveCard } from "wottle";

export function EmptySelection() {
  return (
    <div style={{ maxWidth: 280 }}>
      <YourMoveCard selection={null} submittedMove={null} />
    </div>
  );
}

export function FirstTilePicked() {
  return (
    <div style={{ maxWidth: 280 }}>
      <YourMoveCard selection={{ x: 3, y: 4 }} submittedMove={null} />
    </div>
  );
}

export function MoveSubmitted() {
  return (
    <div style={{ maxWidth: 280 }}>
      <YourMoveCard
        selection={null}
        submittedMove={[
          { x: 3, y: 4 },
          { x: 4, y: 4 },
        ]}
      />
    </div>
  );
}
