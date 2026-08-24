import { TimerDisplay } from "wottle";

export function RunningLarge() {
  return (
    <TimerDisplay
      timerSeconds={154}
      isPaused={false}
      hasSubmitted={false}
      playerColor="var(--p1)"
      size="lg"
    />
  );
}

export function WarningLarge() {
  return (
    <TimerDisplay
      timerSeconds={22}
      isPaused={false}
      hasSubmitted={false}
      playerColor="var(--p1)"
      size="lg"
    />
  );
}

export function CriticalLarge() {
  return (
    <TimerDisplay
      timerSeconds={8}
      isPaused={false}
      hasSubmitted={false}
      playerColor="var(--p2)"
      size="lg"
    />
  );
}

export function SubmittedWaitingSmall() {
  return (
    <TimerDisplay
      timerSeconds={97}
      isPaused={true}
      hasSubmitted={true}
      playerColor="var(--p1)"
      size="sm"
    />
  );
}

export function ExpiredSmall() {
  return (
    <TimerDisplay
      timerSeconds={0}
      isPaused={false}
      hasSubmitted={false}
      playerColor="var(--p2)"
      size="sm"
    />
  );
}
