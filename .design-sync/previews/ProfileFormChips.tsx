import { ProfileFormChips } from "wottle";

export function StrongForm() {
  return (
    <div style={{ maxWidth: 280 }}>
      <ProfileFormChips form={["W", "W", "L", "W", "D", "W", "W", "L", "W", "W"]} />
    </div>
  );
}

export function NewPlayer() {
  return (
    <div style={{ maxWidth: 280 }}>
      <ProfileFormChips form={["L", "W", "D"]} />
    </div>
  );
}
