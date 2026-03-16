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

function timerBackground(
  playerColor: string,
  isPaused: boolean,
  isExpired: boolean,
): string {
  if (isExpired) return "rgba(55, 65, 81, 0.9)";
  if (isPaused) return "rgba(107, 114, 128, 0.5)";
  return playerColor;
}

export function TimerDisplay({
  timerSeconds,
  isPaused,
  hasSubmitted,
  playerColor,
  size,
}: TimerDisplayProps) {
  const isExpired = timerSeconds <= 0 && !isPaused;
  const isUrgent = timerSeconds < 30 && timerSeconds > 0 && !isPaused;
  const bg = timerBackground(playerColor, isPaused, isExpired);

  const sizeClasses =
    size === "lg"
      ? "px-4 py-3 text-3xl sm:text-4xl"
      : "px-2 py-1 text-lg";

  return (
    <div
      data-testid="timer-display"
      className={[
        "timer-display relative flex items-center justify-center rounded-lg font-mono font-black",
        sizeClasses,
        isUrgent ? "timer-display--urgent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: isUrgent ? undefined : bg,
        color: "#fff",
        minWidth: size === "lg" ? "8rem" : "4.5rem",
      }}
    >
      <span>{formatTime(timerSeconds)}</span>

      {hasSubmitted && (
        <span className="absolute -top-2 right-1 rounded-sm bg-amber-500 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase leading-none text-black">
          Submitted
        </span>
      )}

      {isExpired && (
        <span className="ml-2 text-sm font-medium text-red-300">
          Expired
        </span>
      )}
    </div>
  );
}
