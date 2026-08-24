import { HudCard, PlayerAvatar } from "wottle";

const birnaAvatar = (
  <PlayerAvatar displayName="Birna" avatarUrl={null} playerColor="var(--p1)" size="md" />
);

const kariAvatar = (
  <PlayerAvatar displayName="Kári" avatarUrl={null} playerColor="var(--p2)" size="md" />
);

export function YouActiveClock() {
  return (
    <div style={{ maxWidth: 380 }}>
      <HudCard
        slot="you"
        avatar={birnaAvatar}
        name="Birna"
        meta="1240 · 12W"
        clock="2:34"
        clockState="active"
        score={46}
      />
    </div>
  );
}

export function OpponentWaiting() {
  return (
    <div style={{ maxWidth: 380 }}>
      <HudCard
        slot="opp"
        avatar={kariAvatar}
        name="Kári"
        meta="1188 · 9W"
        clock="1:58"
        clockState="waiting"
        score={38}
      />
    </div>
  );
}

export function WarningClock() {
  return (
    <div style={{ maxWidth: 380 }}>
      <HudCard
        slot="you"
        avatar={birnaAvatar}
        name="Birna"
        meta="1240 · 12W"
        clock="0:24"
        clockState="warning"
        clockUrgency={0.2}
        score={61}
      />
    </div>
  );
}

export function CriticalClock() {
  return (
    <div style={{ maxWidth: 380 }}>
      <HudCard
        slot="you"
        avatar={birnaAvatar}
        name="Birna"
        meta="1240 · 12W"
        clock="0:08"
        clockState="critical"
        clockUrgency={0.75}
        score={61}
      />
    </div>
  );
}

export function ExpiredClock() {
  return (
    <div style={{ maxWidth: 380 }}>
      <HudCard
        slot="opp"
        avatar={kariAvatar}
        name="Kári"
        meta="1188 · 9W"
        clock="0:00"
        clockState="expired"
        clockUrgency={1}
        score={52}
      />
    </div>
  );
}
