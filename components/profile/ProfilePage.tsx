"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { logoutAction } from "@/app/actions/auth/logout";
import {
  deriveRecentRatingDelta,
  sliceRatingHistoryWindow,
} from "@/components/profile/deriveProfileChartData";
import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";
import { useAttention } from "@/components/room/hooks/useAttention";
import { useTableCheck } from "@/components/room/hooks/useTableCheck";
import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import type { Copy } from "@/lib/i18n/copy/types";
import { getSeatColors, type Seat } from "@/lib/constants/seatColors";
import { useRoomStore } from "@/lib/room/roomStore";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { BestWord, PlayerProfile } from "@/lib/types/match";

interface ProfilePageProps {
  profile: PlayerProfile;
  words: BestWord[];
  matches: RecentGameRow[];
  isSelf: boolean;
  /** Sign-out is not offered while the owner's match is live (spec 067 FR-014). */
  inLiveMatch?: boolean;
}

/** `september 2026` in the page's language. */
function since(iso: string | undefined, copy: Copy): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : copy.monthYear(d.getUTCMonth(), d.getUTCFullYear());
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
export function ProfilePage({ profile, words, matches, isSelf, inLiveMatch = false }: ProfilePageProps) {
  const router = useRouter();
  const to = useLocalePath();
  const copy = useCopy();
  const { wordmark } = useLocale();
  const setViewer = useRoomStore((s) => s.setViewer);
  // A table found while the player reads a profile takes them to it (spec 069 FR-025a).
  const attention = useAttention();
  const onTable = useCallback((matchId: string) => router.push(to(`/match/${matchId}`)), [router, to]);
  useTableCheck({ enabled: true, attention, onTable });
  const seat: Seat = isSelf ? "you" : "opp";
  const seatInk = getSeatColors(seat).ink;
  /** 14px best-word names: the text variant passes AA where --opp does not. */
  const seatText = getSeatColors(seat).text;
  const { identity, stats, peakRating, ratingHistory } = profile;
  const thirtyDay = sliceRatingHistoryWindow(ratingHistory, 30);
  const weekDelta = deriveRecentRatingDelta(ratingHistory, 7);
  const playingSince = since(identity.createdAt, copy);

  const [refused, setRefused] = useState(false);
  const signOut = (target: string) => {
    const leave = () => {
      setViewer(null);
      router.replace(target);
      router.refresh();
    };
    void logoutAction().then((r) => (r.status === "refused" ? setRefused(true) : leave()), leave);
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
                {playingSince ? ` · ${copy.playingSince(playingSince)}` : ""} ·{" "}
                {copy.matchesPlayed(stats.gamesPlayed)}
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
              {copy.ratingPeak(peakRating, signed(weekDelta))}
            </p>
          </div>
        </header>

        <ProfileRatingChart history={thirtyDay} seat={seat} />

        <div
          className="profile__record"
          data-testid="profile-record"
          role="table"
          aria-label={copy.RECORD}
        >
          <div className="profile__record-row" role="row">
            {[
              [copy.WON, stats.wins],
              [copy.LOST, stats.losses],
              [copy.DRAWN, stats.draws],
              [copy.WIN_RATE, winRate(stats.winRate)],
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
          <span className="ledger__wordmark">{wordmark}</span>
          <span className="ledger__mono">{copy.PROFILE}</span>
        </div>

        <div className="ledger__mono lobby-ledger__title">{copy.BEST_WORDS}</div>
        <div
          className="lobby-ledger__table"
          data-testid="profile-best-words"
          role="table"
          aria-label={copy.BEST_WORDS}
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
                  {w.opponentName ? copy.versus(w.opponentName) : ""}
                </span>
                <span role="cell" />
              </div>
            ))
          )}
        </div>

        <div className="ledger__mono lobby-ledger__title">{copy.RECENT_MATCHES}</div>
        <div
          className="lobby-ledger__table"
          data-testid="profile-recent-matches"
          role="table"
          aria-label={copy.RECENT_MATCHES}
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
                  <Link href={to(`/match/${m.matchId}`)} className="profile__match-link">
                    {m.opponentDisplayName}
                  </Link>
                </span>
                <span className="ledger__mono" role="cell">
                  {m.yourScore}–{m.opponentScore}
                </span>
                <span className="ledger__mono" role="cell">
                  {copy.matchResult(m.result)}
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
            href={to("/lobby")}
            className="action-secondary"
            data-testid="profile-back-lobby"
          >
            {copy.BACK_LOBBY}
          </Link>
          {refused ? (
            <span className="ledger__mono" data-testid="profile-sign-out-refused">
              {copy.errors.sign_out_in_match}
            </span>
          ) : null}
          {isSelf && !inLiveMatch ? (
            <div className="ledger__actions">
              <button
                type="button"
                className="action-secondary"
                data-testid="profile-change-name"
                onClick={() => signOut(to("/"))}
              >
                {copy.CHANGE_NAME}
              </button>
              <button
                type="button"
                className="action-secondary"
                data-testid="profile-sign-out"
                onClick={() => signOut(to("/"))}
              >
                {copy.SIGN_OUT}
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </main>
  );
}
