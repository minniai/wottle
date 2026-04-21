import Link from "next/link";

import { UserMenu } from "@/components/ui/UserMenu";
import { readLobbySession } from "@/lib/matchmaking/profile";

export async function TopBar() {
  const session = await readLobbySession();

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-20 flex items-center justify-between border-b border-hair bg-paper/85 px-7 py-3.5 backdrop-blur-md"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[22px] italic leading-none tracking-tight text-ink">
          Wottle
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          word · battle
        </span>
      </div>
      <nav className="flex items-center gap-2 text-[13px] text-ink-3 sm:gap-5">
        <Link
          href="/lobby"
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-ink sm:min-h-0 sm:min-w-0 sm:px-0"
        >
          Lobby
        </Link>
        <Link
          href="/profile"
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-ink sm:min-h-0 sm:min-w-0 sm:px-0"
        >
          Profile
        </Link>
        {session ? (
          <>
            <span className="hidden h-5 w-px bg-hair sm:inline-block" aria-hidden />
            <UserMenu session={session} />
          </>
        ) : null}
      </nav>
    </header>
  );
}
