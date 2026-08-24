import { EmptyLobbyState } from "wottle";

const noop = () => undefined;

export function Default() {
  return (
    <div style={{ maxWidth: 560 }}>
      <EmptyLobbyState onJoinQueue={noop} />
    </div>
  );
}
