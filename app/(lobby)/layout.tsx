import type { ReactNode } from "react";

export default function LobbyGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lobby-ambient-bg relative flex flex-1 flex-col">
      {children}
    </div>
  );
}
