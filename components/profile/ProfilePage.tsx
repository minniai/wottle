"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { logoutAction } from "@/app/actions/auth/logout";
import {
  deriveRecentRatingDelta,
  sliceRatingHistoryWindow,
} from "@/components/profile/deriveProfileChartData";
import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";
import { getSeatColors, type Seat } from "@/lib/constants/seatColors";
import { useRoomStore } from "@/lib/room/roomStore";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { BestWord, PlayerProfile } from "@/lib/types/match";

interface ProfilePageProps {
  profile: PlayerProfile;
  words: BestWord[];
  matches: RecentGameRow[];
  isSelf: boolean;
}

const MONTH = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "long" });

function since(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : MONTH.format(d).toLowerCase();
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0";
}

function winRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * The profile on the room grid (design system §7 Fig. 9, spec 044 US10):
 * identity + hairline chart + record row on the left; best words and recent
 * matches as ledgers on the right. Another player's profile uses the opponent colour.
 */
export function ProfilePage({ profile, words, matches, isSelf }: ProfilePageProps) {
  const router = useRouter();
  const setViewer = useRoomStore((s) => s.setViewer);
  const seat: Seat = isSelf ? "you" : "opp";
  const seatInk = getSeatColors(seat).ink;
  /** 14px best-word names: the text variant passes AA where --opp does not. */
  const seatText = getSeatColors(seat).text;
  const { identity, stats, peakRating, ratingHistory } = profile;
  const thirtyDay = sliceRatingHistoryWindow(ratingHistory, 30);
  const weekDelta = deriveRecentRatingDelta(ratingHistory, 7);
  const playingSince = since(identity.createdAt);

  const signOut = (target: string) => {
    void logoutAction({}).finally(() => {
      setViewer(null);
      router.replace(target);
      router.refresh();
    });
  };

  return (
    <main className="room profile" data-testid="profile-page" data-seat={seat}>
      <div className="room__stack profile__left">
        <header className="profile__identity" data-testid="profile-identity">
          <div className="profile__who">
            <span className="profile__seat" style={{ background: seatInk }} aria-hidden />
            <div>
              <h1 className="profile__name">{identity.displayName}</h1>
              <p className="ledger__mono" data-testid="profile-handle">
                @{identity.username}
                {playingSince ? ` · playing since ${playingSince}` : ""} ·{" "}
                {stats.gamesPlayed} matches
              </p>
            </div>
          </div>
          <div className="profile__rating-block">
            <div
              className="profile__rating"
              style={{ color: seatInk }}
              data-testid="profile-rating"
            >
              {stats.eloRating}
            </div>
            <p className="ledger__mono">
              rating · peak {peakRating} · {signed(weekDelta)} this week
            </p>
          </div>
        </header>

        <ProfileRatingChart history={thirtyDay} seat={seat} />

        <div
          className="profile__record"
          data-testid="profile-record"
          role="table"
          aria-label="record"
        >
          <div className="profile__record-row" role="row">
            {[
              ["won", stats.wins],
              ["lost", stats.losses],
              ["drawn", stats.draws],
              ["win rate", winRate(stats.winRate)],
            ].map(([label, value]) => (
              <div className="profile__record-cell" role="cell" key={String(label)}>
                <span className="profile__record-value">{value}</span>
                <span className="ledger__mono">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="room__ledger ledger profile__right">
        <div className="ledger__caption">
          <span className="ledger__wordmark">wottle</span>
          <span className="ledger__mono">profile</span>
        </div>

        <div className="ledger__mono lobby-ledger__title">best words</div>
        <div
          className="lobby-ledger__table"
          data-testid="profile-best-words"
          role="table"
          aria-label="best words"
        >
          {words.length === 0 ? (
            <div className="lobby-ledger__row ledger__mono" role="row">
              <span role="cell">—</span>
            </div>
          ) : (
            words.map((w) => (
              <div
                className="lobby-ledger__row"
                role="row"
                key={`${w.word}-${w.points}`}
                data-testid="profile-best-word"
              >
                <span
                  className="lobby-ledger__name"
                  role="cell"
                  style={{ color: seatText }}
                >
                  {w.word}
                </span>
                <span className="ledger__mono" role="cell">
                  {w.points}
                </span>
                <span className="ledger__mono" role="cell">
                  {w.opponentName ? `vs ${w.opponentName}` : ""}
                </span>
                <span role="cell" />
              </div>
            ))
          )}
        </div>

        <div className="ledger__mono lobby-ledger__title">recent matches</div>
        <div
          className="lobby-ledger__table"
          data-testid="profile-recent-matches"
          role="table"
          aria-label="recent matches"
        >
          {matches.length === 0 ? (
            <div className="lobby-ledger__row ledger__mono" role="row">
              <span role="cell">—</span>
            </div>
          ) : (
            matches.map((m) => (
              <div
                className="lobby-ledger__row profile__match"
                role="row"
                key={m.matchId}
                data-testid="profile-recent-match"
              >
                <span className="lobby-ledger__name" role="cell">
                  <Link href={`/match/${m.matchId}`} className="profile__match-link">
                    {m.opponentDisplayName}
                  </Link>
                </span>
                <span className="ledger__mono" role="cell">
                  {m.yourScore}–{m.opponentScore}
                </span>
                <span className="ledger__mono" role="cell">
                  {m.result}
                </span>
                <span className="ledger__mono" role="cell">
                  ▸
                </span>
              </div>
            ))
          )}
        </div>

        <div className="ledger__foot" data-testid="profile-foot">
          <Link
            href="/lobby"
            className="action-secondary"
            data-testid="profile-back-lobby"
          >
            ◂ lobby
          </Link>
          {isSelf ? (
            <div className="ledger__actions">
              <button
                type="button"
                className="action-secondary"
                data-testid="profile-change-name"
                onClick={() => signOut("/")}
              >
                change name
              </button>
              <button
                type="button"
                className="action-secondary"
                data-testid="profile-sign-out"
                onClick={() => signOut("/")}
              >
                sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </main>
  );
}
