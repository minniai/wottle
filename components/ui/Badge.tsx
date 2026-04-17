import type { ReactNode } from "react";

export type BadgeVariant =
  | "available"
  | "matchmaking"
  | "in_match"
  | "offline"
  | "info"
  | "warning";

interface BadgeProps {
  variant: BadgeVariant;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  available:
    "border-accent-success/40 bg-accent-success/15 text-emerald-200",
  matchmaking:
    "border-accent-warning/40 bg-accent-warning/15 text-amber-100",
  in_match: "border-player-a/40 bg-player-a/15 text-sky-100",
  offline: "border-surface-3 bg-surface-2 text-text-muted",
  info: "border-accent-focus/40 bg-accent-focus/15 text-brand-100",
  warning: "border-accent-warning/40 bg-accent-warning/15 text-amber-100",
};

export function Badge({
  variant,
  pulse = false,
  children,
  className = "",
}: BadgeProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium";
  return (
    <span className={`${base} ${VARIANT_STYLES[variant]} ${className}`.trim()}>
      {pulse ? (
        <span
          aria-hidden="true"
          className="lobby-status-dot--pulse inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}
