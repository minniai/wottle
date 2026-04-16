import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-focus text-text-inverse hover:bg-brand-300 active:bg-brand-500",
  secondary:
    "border border-surface-3 bg-surface-2 text-text-primary hover:bg-surface-3",
  ghost: "bg-transparent text-text-primary hover:bg-surface-1",
  danger: "bg-player-b text-text-primary hover:brightness-110",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const BASE_STYLES =
  "inline-flex items-center justify-center rounded-lg font-semibold transition " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent-focus disabled:cursor-not-allowed disabled:opacity-50 " +
  "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  const classes = [
    BASE_STYLES,
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button ref={ref} type={type} className={classes} {...rest} />;
});
