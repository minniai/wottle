"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import { Avatar } from "@/components/ui/Avatar";
import { LogoutConfirmDialog } from "@/components/ui/LogoutConfirmDialog";
import type { LobbySession } from "@/lib/matchmaking/profile";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import { useSensoryPreferences } from "@/lib/preferences/useSensoryPreferences";

export interface UserMenuProps {
  session: LobbySession;
}

export function UserMenu({ session }: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const chipRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { player } = session;
  const { preferences, setSoundEnabled, setHapticsEnabled } =
    useSensoryPreferences();

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
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-md border border-hair bg-paper/95 shadow-lg backdrop-blur-md"
        >
          <div className="px-3 pt-3 pb-2 font-display text-[14px] italic leading-tight text-ink-soft">
            Signed in as {player.displayName}
          </div>
          <div className="border-t border-hair" aria-hidden />
          <ToggleMenuItem
            label="Sound effects"
            checked={preferences.soundEnabled}
            onChange={setSoundEnabled}
          />
          <ToggleMenuItem
            label="Haptic feedback"
            checked={preferences.hapticsEnabled}
            onChange={setHapticsEnabled}
          />
          <div className="border-t border-hair" aria-hidden />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (player.status === "in_match") {
                setOpen(false);
                setConfirmOpen(true);
              } else {
                void performLogout(false);
              }
            }}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-player-b hover:bg-paper-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOutIcon />
            Sign out
          </button>
        </div>
      ) : null}

      <LogoutConfirmDialog
        open={confirmOpen}
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await performLogout(true);
          setConfirmOpen(false);
        }}
      />
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

interface ToggleMenuItemProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleMenuItem({ label, checked, onChange }: ToggleMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-ink-3 hover:bg-paper-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-hair transition-colors"
        style={{
          backgroundColor: checked
            ? "oklch(0.62 0.12 150)" /* --good */
            : "color-mix(in oklab, var(--ink) 8%, transparent)",
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-paper shadow-sm transition-transform"
          style={{
            transform: checked ? "translateX(1.1rem)" : "translateX(0.15rem)",
          }}
        />
      </span>
    </button>
  );
}
