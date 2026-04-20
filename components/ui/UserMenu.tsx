"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { Avatar } from "@/components/ui/Avatar";
import type { LobbySession } from "@/lib/matchmaking/profile";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";

export interface UserMenuProps {
  session: LobbySession;
}

export function UserMenu({ session }: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const chipRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { player } = session;

  const close = useCallback(() => {
    setOpen(false);
    chipRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        chipRef.current &&
        !chipRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, close]);

  const performLogout = useCallback(
    async (resignActiveMatch: boolean) => {
      setPending(true);
      try {
        await logoutAction(
          resignActiveMatch ? { resignActiveMatch: true } : {},
        );
      } catch (error) {
        console.error("[UserMenu] logout failed", error);
      } finally {
        useLobbyPresenceStore.getState().disconnect();
        setPending(false);
        setOpen(false);
        if (pathname?.startsWith("/match/")) {
          router.push("/lobby");
        } else {
          router.refresh();
        }
      }
    },
    [pathname, router],
  );

  return (
    <div className="relative">
      <button
        ref={chipRef}
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

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-[220px] overflow-hidden rounded-md border border-hair bg-paper/95 shadow-lg backdrop-blur-md"
        >
          <div className="px-3 pt-3 pb-2 font-display text-[14px] italic leading-tight text-ink-soft">
            Signed in as {player.displayName}
          </div>
          <div className="border-t border-hair" aria-hidden />
          <button
            type="button"
            role="menuitem"
            onClick={() => void performLogout(false)}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-player-b hover:bg-paper-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOutIcon />
            Sign out
          </button>
        </div>
      ) : null}
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

function LogOutIcon() {
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
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
