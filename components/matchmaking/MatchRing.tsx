import type { ReactNode } from "react";

interface MatchRingProps {
  children: ReactNode;
}

export function MatchRing({ children }: MatchRingProps) {
  return (
    <div data-testid="match-ring" className="match-ring">
      {children}
    </div>
  );
}
