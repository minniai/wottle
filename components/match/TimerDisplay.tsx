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
  hasSubmitted: boolean,
): string {
  if (isExpired) return "rgba(55, 65, 81, 0.9)";
  if (hasSubmitted) return "rgba(245, 158, 11, 0.85)";
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
  const bg = timerBackground(playerColor, isPaused, isExpired, hasSubmitted);

  const sizeClasses =
    size === "lg"
      ? "px-4 py-3 text-3xl sm:text-4xl"
      : "px-2 py-1 text-lg";

  return (
    <div className="flex flex-col items-center gap-1">
      {hasSubmitted && (
        <span
          data-testid="submitted-badge"
          className="rounded-md bg-amber-500 px-2 py-0.5 text-[0.65rem] font-bold uppercase leading-none tracking-wider text-black shadow-md shadow-amber-500/40"
        >
          Move locked
        </span>
      )}
      <div
        data-testid="timer-display"
        className={[
          "timer-display flex items-center justify-center rounded-lg font-mono font-black",
          sizeClasses,
          isUrgent ? "timer-display--urgent" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          backgroundColor: isUrgent ? undefined : bg,
          color: "#fff",
          minWidth: size === "lg" ? "8rem" : "4.5rem",
          ...(hasSubmitted
            ? { boxShadow: "0 0 0 2px rgba(245, 158, 11, 0.6), 0 0 12px rgba(245, 158, 11, 0.3)" }
            : {}),
        }}
      >
        <span>{formatTime(timerSeconds)}</span>

        {isExpired && (
          <span className="ml-2 text-sm font-medium text-red-300">
            Expired
          </span>
        )}
      </div>
    </div>
  );
}
