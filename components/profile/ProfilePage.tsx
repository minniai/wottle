import type { RecentGameRow } from "@/lib/types/lobby";
import { ProfileMatchHistoryList } from "@/components/profile/ProfileMatchHistoryList";
import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";
import { ProfileSidebar } from "@/components/profile/ProfileSidebar";
import { ProfileWordCloud } from "@/components/profile/ProfileWordCloud";
import type { BestWord, PlayerProfile } from "@/lib/types/match";

interface ProfilePageProps {
  profile: PlayerProfile;
  words: BestWord[];
  matches: RecentGameRow[];
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-hair bg-paper-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export function ProfilePage({ profile, words, matches }: ProfilePageProps) {
  const { stats, peakRating, ratingHistory } = profile;
  const winRatePct =
    stats.winRate !== null ? `${Math.round(stats.winRate * 100)}%` : "—";

  return (
    <main
      data-testid="profile-page"
      className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 sm:grid-cols-[200px_1fr] sm:px-8 sm:py-12"
    >
      <ProfileSidebar profile={profile} />

      <div className="flex flex-col gap-8">
        <section
          aria-label="At-a-glance stats"
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        >
          <StatTile label="Matches" value={stats.gamesPlayed} />
          <StatTile label="Wins" value={stats.wins} />
          <StatTile label="Losses" value={stats.losses} />
          <StatTile label="Win rate" value={winRatePct} />
          <StatTile label="Peak" value={peakRating} />
        </section>

        <section aria-label="Rating history">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">
            Rating
          </h2>
          <ProfileRatingChart history={ratingHistory} />
        </section>

        <section aria-label="Best words">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">
            Best words
          </h2>
          <ProfileWordCloud words={words} />
        </section>

        <section aria-label="Recent matches">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">
            Recent matches
          </h2>
          <ProfileMatchHistoryList matches={matches} />
        </section>
      </div>
    </main>
  );
}
