import { forwardRef, type HTMLAttributes } from "react";

export type CardElevation = 0 | 1 | 2 | 3;

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  interactive?: boolean;
}

const ELEVATION_STYLES: Record<CardElevation, string> = {
  0: "bg-surface-0",
  1: "bg-surface-1",
  2: "bg-surface-2",
  3: "bg-surface-3",
};

const BASE_STYLES = "rounded-2xl p-5 text-text-primary";

const INTERACTIVE_STYLES =
  "cursor-pointer transition hover:-translate-y-0.5 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent-focus";

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 1, interactive = false, className = "", ...rest },
  ref,
) {
  const classes = [
    BASE_STYLES,
    ELEVATION_STYLES[elevation],
    interactive ? INTERACTIVE_STYLES : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <div ref={ref} className={classes} {...rest} />;
});
