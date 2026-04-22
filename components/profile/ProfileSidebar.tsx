import { Avatar } from "@/components/ui/Avatar";
import type { PlayerProfile } from "@/lib/types/match";

interface ProfileSidebarProps {
  profile: PlayerProfile;
}

export function ProfileSidebar({ profile }: ProfileSidebarProps) {
  const year = new Date(profile.identity.lastSeenAt).getUTCFullYear();
  return (
    <aside
      data-testid="profile-sidebar"
      className="flex w-full flex-col gap-6 sm:w-[180px]"
    >
      <div className="flex flex-col items-start gap-3">
        <Avatar
          playerId={profile.identity.id}
          displayName={profile.identity.displayName}
          avatarUrl={profile.identity.avatarUrl}
          size="lg"
        />
        <h1 className="font-display text-3xl font-semibold italic text-ink">
          {profile.identity.displayName}
        </h1>
        <p className="font-mono text-[11px] text-ink-soft">
          @{profile.identity.username} · joined {year}
        </p>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
          Rating
        </p>
        <p className="mt-1 font-display text-5xl font-semibold italic text-ochre-deep">
          {profile.stats.eloRating}
        </p>
        <p className="mt-1 font-mono text-[11px] text-ink-soft">
          peak {profile.peakRating}
        </p>
      </div>
    </aside>
  );
}
