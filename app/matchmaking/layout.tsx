import type { ReactNode } from "react";

export default function MatchmakingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="matchmaking-shell">{children}</div>;
}
