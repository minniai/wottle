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
    "border-good/40 bg-good/15 text-good",
  matchmaking:
    "border-warn/50 bg-warn/20 text-[color-mix(in_oklab,var(--warn)_80%,var(--ink))]",
  in_match: "border-p1/40 bg-p1/15 text-p1-deep",
  offline: "border-hair-strong bg-paper-3 text-ink-soft",
  info: "border-ochre/40 bg-ochre/15 text-ochre-deep",
  warning:
    "border-warn/50 bg-warn/20 text-[color-mix(in_oklab,var(--warn)_80%,var(--ink))]",
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
