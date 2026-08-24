import { InviteToast } from "wottle";

const invite = {
  inviteId: "invite-42",
  fromDisplayName: "Kári",
  fromUsername: "kari_ordasmidur",
  fromElo: 1391,
  yourElo: 1284,
};

const noop = () => undefined;

// InviteToast renders `position: fixed`; the transformed wrapper makes it the
// containing block so the toast stays inside the preview cell.
export function IncomingChallenge() {
  return (
    <div
      style={{
        position: "relative",
        transform: "translateZ(0)",
        width: 400,
        height: 300,
      }}
    >
      <InviteToast
        invite={invite}
        onAccept={noop}
        onDecline={noop}
        onClose={noop}
      />
    </div>
  );
}
