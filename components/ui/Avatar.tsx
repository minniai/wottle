import { forwardRef } from "react";

import { generateAvatar } from "@/lib/ui/avatarGradient";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  playerId: string;
  displayName: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
  /**
   * Overrides the hash-based identity gradient with a solid color (a design
   * token like `var(--p2)`). Used to keep the TopBar avatar consistent with the
   * player's match/slot color on match pages (O-72). Ignored when `avatarUrl`
   * is present.
   */
  colorOverride?: string;
}

const SIZE_STYLES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-[180px] w-[180px] text-[72px] font-display italic",
};

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { playerId, displayName, avatarUrl, size = "md", className = "", colorOverride },
  ref,
) {
  const label = `${displayName || "Anonymous player"} avatar`;
  const sizeClasses = SIZE_STYLES[size];

  if (avatarUrl) {
    return (
      <span
        ref={ref}
        role="img"
        aria-label={label}
        className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-surface-2 ${sizeClasses} ${className}`.trim()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </span>
    );
  }

  const generated = generateAvatar(playerId, displayName);
  const background = colorOverride ?? generated.background;
  const foreground = colorOverride ? "var(--ink)" : generated.foreground;
  return (
    <span
      ref={ref}
      role="img"
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-full font-semibold ${sizeClasses} ${className}`.trim()}
      style={{ background, color: foreground }}
    >
      {generated.initials}
    </span>
  );
});
