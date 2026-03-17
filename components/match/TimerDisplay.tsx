"use client";

interface TimerDisplayProps {
  timerSeconds: number;
  isPaused: boolean;
  hasSubmitted: boolean;
  playerColor: string;
  size: "lg" | "sm";
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timerStateClass(
  isPaused: boolean,
  isExpired: boolean,
  isLow: boolean,
): string {
  if (isExpired) return "timer-display--expired";
  if (isLow) return "timer-display--low";
  if (isPaused) return "timer-display--paused";
  return "timer-display--running";
}

export function TimerDisplay({
  timerSeconds,
  isPaused,
  hasSubmitted,
  size,
}: TimerDisplayProps) {
  const isExpired = timerSeconds <= 0 && !isPaused;
  const isLow = timerSeconds > 0 && timerSeconds <= 15 && !isPaused;

  const sizeClasses =
    size === "lg" ? "px-5 py-4" : "px-3 py-1.5";

  const stateClass = timerStateClass(isPaused, isExpired, isLow);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        data-testid="timer-display"
        className={[
          "timer-display flex items-center justify-center rounded-lg font-mono font-black text-white",
          sizeClasses,
          stateClass,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          fontSize: size === "lg" ? "3rem" : "1.5rem",
          minWidth: size === "lg" ? "12rem" : "6rem",
          ...(hasSubmitted
            ? {
                boxShadow:
                  "0 0 0 2px rgba(245, 158, 11, 0.6), 0 0 12px rgba(245, 158, 11, 0.3)",
              }
            : {}),
        }}
      >
        <span>{formatTime(timerSeconds)}</span>
      </div>
    </div>
  );
}
