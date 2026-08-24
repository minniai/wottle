import { PlayerPanel } from "wottle";

export function OchrePlayerRunning() {
  return (
    <div style={{ maxWidth: 480 }}>
      <PlayerPanel
        player={{ displayName: "Birna", avatarUrl: null, eloRating: 1240 }}
        gameState={{
          score: 46,
          timerSeconds: 154,
          isPaused: false,
          hasSubmitted: false,
          currentRound: 4,
          totalRounds: 10,
          playerColor: "var(--p1)",
        }}
      />
    </div>
  );
}

export function BluePlayerSubmitted() {
  return (
    <div style={{ maxWidth: 480 }}>
      <PlayerPanel
        player={{ displayName: "Kári", avatarUrl: null, eloRating: 1188 }}
        gameState={{
          score: 38,
          timerSeconds: 121,
          isPaused: true,
          hasSubmitted: true,
          currentRound: 4,
          totalRounds: 10,
          playerColor: "var(--p2)",
        }}
      />
    </div>
  );
}

export function LowTime() {
  return (
    <div style={{ maxWidth: 480 }}>
      <PlayerPanel
        player={{ displayName: "Birna", avatarUrl: null, eloRating: 1240 }}
        gameState={{
          score: 61,
          timerSeconds: 9,
          isPaused: false,
          hasSubmitted: false,
          currentRound: 9,
          totalRounds: 10,
          playerColor: "var(--p1)",
        }}
      />
    </div>
  );
}

export function Disconnected() {
  return (
    <div style={{ maxWidth: 480 }}>
      <PlayerPanel
        player={{ displayName: "Kári", avatarUrl: null, eloRating: 1188 }}
        gameState={{
          score: 52,
          timerSeconds: 74,
          isPaused: true,
          hasSubmitted: false,
          currentRound: 6,
          totalRounds: 10,
          playerColor: "var(--p2)",
        }}
        isDisconnected
      />
    </div>
  );
}
