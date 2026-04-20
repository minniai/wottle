"use client";

import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import type { LobbySession } from "@/lib/matchmaking/profile";

export interface UserMenuProps {
  session: LobbySession;
}

export function UserMenu({ session }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const { player } = session;

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-1.5 py-1 text-[13px] text-ink-3 hover:text-ink sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1"
      >
        <Avatar
          playerId={player.id}
          displayName={player.displayName}
          avatarUrl={player.avatarUrl ?? undefined}
          size="sm"
        />
        <span className="hidden sm:inline">{player.displayName}</span>
        <ChevronDownIcon />
      </button>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-soft"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
