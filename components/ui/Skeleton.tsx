import type { HTMLAttributes } from "react";

export type SkeletonShape = "rect" | "circle";

interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  shape?: SkeletonShape;
}

export function Skeleton({
  shape = "rect",
  className = "",
  ...rest
}: SkeletonProps) {
  const shapeClass =
    shape === "circle" ? "aspect-square rounded-full" : "rounded-md";
  return (
    <span
      aria-hidden="true"
      className={`lobby-skeleton block bg-surface-2/60 ${shapeClass} ${className}`.trim()}
      {...rest}
    />
  );
}
