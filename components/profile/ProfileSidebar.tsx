import Link from "next/link";

import { deriveTodayRatingDelta } from "@/components/profile/deriveProfileChartData";
import { Avatar } from "@/components/ui/Avatar";
import type { PlayerProfile } from "@/lib/types/match";

interface ProfileSidebarProps {
  profile: PlayerProfile;
  isSelf: boolean;
}

const MEMBER_SINCE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
});

function formatMemberSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return MEMBER_SINCE_FMT.format(d);
}

function TodayDelta({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const positive = delta > 0;
  const glyph = positive ? "▲" : "▼";
  const color = positive ? "text-good" : "text-bad";
  return (
    <p
      data-testid="today-delta"
      className={`mt-1 font-mono text-[11px] tracking-[0.08em] ${color}`}
    >
      {glyph} {positive ? "+" : "−"}
      {Math.abs(delta)} TODAY
    </p>
  );
}

function RatingCard({
  rating,
  todayDelta,
}: {
  rating: number;
  todayDelta: number;
}) {
  return (
    <div className="profile-rating-card" data-testid="rating-card">
      <p className="profile-eyebrow">Rating</p>
      <p className="mt-1 font-display text-[46px] italic leading-none text-ochre-deep">
        {rating.toLocaleString("en-US")}
      </p>
      <TodayDelta delta={todayDelta} />
    </div>
  );
}

function SidebarActions({
  isSelf,
  handle,
}: {
  isSelf: boolean;
  handle: string;
}) {
  if (isSelf) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href="/matchmaking?mode=ranked"
          data-testid="play-now-cta"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-ochre-deep px-4 py-2 text-sm font-semibold text-paper transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ◆ Play now
        </Link>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-hair bg-transparent px-4 py-2 text-sm font-medium text-ink-soft disabled:cursor-not-allowed"
        >
          Edit profile
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/lobby"
        data-testid="challenge-cta"
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-ochre-deep px-4 py-2 text-sm font-semibold text-paper transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Challenge @{handle} →
      </Link>
    </div>
  );
}

export function ProfileSidebar({ profile, isSelf }: ProfileSidebarProps) {
  const memberSince = formatMemberSince(profile.identity.createdAt);
  const todayDelta = deriveTodayRatingDelta(profile.ratingHistory);

  return (
    <aside
      data-testid="profile-sidebar"
      className="flex w-full flex-col gap-6 sm:sticky sm:top-20 sm:w-[280px]"
    >
      <div className="flex flex-col items-start gap-4">
        <Avatar
          playerId={profile.identity.id}
          displayName={profile.identity.displayName}
          avatarUrl={profile.identity.avatarUrl}
          size="xl"
        />
        <div>
          <p className="profile-eyebrow">
            {isSelf ? "Your profile" : "Player profile"}
          </p>
          <h1 className="mt-1 font-display text-[42px] font-normal italic leading-[1.05] text-ink">
            {profile.identity.displayName}
          </h1>
          <p className="mt-1 font-mono text-[12px] text-ink-soft">
            @{profile.identity.username}
            {memberSince ? ` · member since ${memberSince}` : null}
          </p>
        </div>
      </div>

      <RatingCard rating={profile.stats.eloRating} todayDelta={todayDelta} />

      <SidebarActions isSelf={isSelf} handle={profile.identity.username} />
    </aside>
  );
}
