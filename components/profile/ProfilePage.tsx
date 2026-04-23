import type { RecentGameRow } from "@/lib/types/lobby";
import {
  deriveRecentRatingDelta,
  sliceRatingHistoryWindow,
} from "@/components/profile/deriveProfileChartData";
import { ProfileMatchHistoryList } from "@/components/profile/ProfileMatchHistoryList";
import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";
import { ProfileSidebar } from "@/components/profile/ProfileSidebar";
import { ProfileStat } from "@/components/profile/ProfileStat";
import { ProfileWordCloud } from "@/components/profile/ProfileWordCloud";
import type { BestWord, PlayerProfile } from "@/lib/types/match";

interface ProfilePageProps {
  profile: PlayerProfile;
  words: BestWord[];
  matches: RecentGameRow[];
  isSelf: boolean;
}

function formatWinRate(winRate: number | null): string {
  return winRate !== null ? `${Math.round(winRate * 100)}%` : "—";
}

function formatWeeklyDelta(delta: number): string {
  if (delta === 0) return "± 0 this week";
  return `${delta > 0 ? "+" : ""}${delta} this week`;
}

function StatsFrame({ profile }: { profile: PlayerProfile }) {
  const { stats, peakRating } = profile;
  const record = `${stats.wins}–${stats.losses}–${stats.draws}`;
  return (
    <section aria-label="At-a-glance stats">
      <p className="profile-eyebrow">At a glance</p>
      <div className="profile-stats-frame mt-2.5 grid grid-cols-2 sm:grid-cols-4">
        <ProfileStat label="Matches" value={stats.gamesPlayed} />
        <ProfileStat label="W · L · D" value={record} />
        <ProfileStat label="Win rate" value={formatWinRate(stats.winRate)} />
        <ProfileStat label="Peak rating" value={peakRating} />
      </div>
    </section>
  );
}

function PanelCard({
  title,
  meta,
  children,
  testId,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section className="profile-card" data-testid={testId}>
      <header className="profile-card__head">
        <h3>{title}</h3>
        <span className="profile-card__head-meta">{meta}</span>
      </header>
      {children}
    </section>
  );
}

export function ProfilePage({ profile, words, matches, isSelf }: ProfilePageProps) {
  const thirtyDay = sliceRatingHistoryWindow(profile.ratingHistory, 30);
  const weeklyDelta = deriveRecentRatingDelta(profile.ratingHistory, 7);

  return (
    <main
      data-testid="profile-page"
      className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 py-8 sm:grid-cols-[280px_1fr] sm:px-14 sm:py-14"
    >
      <ProfileSidebar profile={profile} isSelf={isSelf} />

      <div className="flex flex-col gap-7">
        <StatsFrame profile={profile} />

        <PanelCard
          title="Rating · last 30 days"
          meta={formatWeeklyDelta(weeklyDelta)}
          testId="panel-rating"
        >
          <ProfileRatingChart history={thirtyDay} />
        </PanelCard>

        <PanelCard title="Best words" meta="All-time" testId="panel-words">
          <ProfileWordCloud words={words} />
        </PanelCard>

        <PanelCard title="Recent matches" meta="Last 7 days" testId="panel-history">
          <ProfileMatchHistoryList matches={matches} />
        </PanelCard>
      </div>
    </main>
  );
}
