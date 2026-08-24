import { LobbyCard } from "wottle";

const now = new Date().toISOString();

const birna = {
  id: "player-birna",
  username: "birna",
  displayName: "Birna",
  avatarUrl: null,
  status: "available",
  lastSeenAt: now,
  eloRating: 1284,
  createdAt: now,
};

const kari = {
  id: "player-kari",
  username: "kari_ordasmidur",
  displayName: "Kári",
  avatarUrl: null,
  status: "in_match",
  lastSeenAt: now,
  eloRating: 1391,
  createdAt: now,
};

const thordis = {
  id: "player-thordis",
  username: "thordis",
  displayName: "Þórdís",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: now,
  eloRating: 1147,
  createdAt: now,
};

const elin = {
  id: "player-elin",
  username: "elin",
  displayName: "Elín",
  avatarUrl: null,
  status: "available",
  lastSeenAt: now,
  eloRating: 1212,
  createdAt: now,
};

const noop = () => undefined;

export function Available() {
  return (
    <div style={{ maxWidth: 360 }}>
      <LobbyCard
        player={birna}
        viewerRating={1212}
        onUsernameClick={noop}
        onChallenge={noop}
      />
    </div>
  );
}

export function InMatch() {
  return (
    <div style={{ maxWidth: 360 }}>
      <LobbyCard
        player={kari}
        viewerRating={1212}
        onUsernameClick={noop}
        onChallenge={noop}
      />
    </div>
  );
}

export function Matchmaking() {
  return (
    <div style={{ maxWidth: 360 }}>
      <LobbyCard
        player={thordis}
        viewerRating={1212}
        onUsernameClick={noop}
        onChallenge={noop}
      />
    </div>
  );
}

export function Self() {
  return (
    <div style={{ maxWidth: 360 }}>
      <LobbyCard player={elin} isSelf onUsernameClick={noop} />
    </div>
  );
}
