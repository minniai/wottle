"use client";

interface PlayerAvatarProps {
  displayName: string;
  avatarUrl: string | null;
  playerColor: string;
  size: "sm" | "md";
}

const SIZES = { sm: 32, md: 48 } as const;

export function PlayerAvatar({
  displayName,
  avatarUrl,
  playerColor,
  size,
}: PlayerAvatarProps) {
  const px = SIZES[size];
  const letter = displayName.charAt(0).toUpperCase() || "?";
  const fontSize = size === "sm" ? "0.75rem" : "1.125rem";

  if (avatarUrl) {
    return (
      <img
        data-testid="player-avatar"
        src={avatarUrl}
        alt={displayName}
        className="rounded-full object-cover"
        style={{ width: `${px}px`, height: `${px}px` }}
      />
    );
  }

  return (
    <div
      data-testid="player-avatar"
      className="flex items-center justify-center rounded-full font-bold text-white"
      style={{
        width: `${px}px`,
        height: `${px}px`,
        backgroundColor: playerColor,
        fontSize,
      }}
    >
      {letter}
    </div>
  );
}
