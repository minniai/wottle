"use client";

import Link from "next/link";
import { useState } from "react";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { rowModel, visibleRows, type RowModel } from "@/lib/pages/lobbyRows";
import type { LobbyRow } from "@/lib/types/standing";

interface HereNowTableProps {
  rows: LobbyRow[];
  here: number;
  playing: number;
  onChallenge: (playerId: string) => void;
  onFreeze: (frozen: boolean) => void;
}

function Row({ model, onChallenge }: { model: RowModel; onChallenge: (id: string) => void }) {
  const to = useLocalePath();
  return (
    <tr className="lobby-row" data-muted={model.muted} data-testid="lobby-row">
      <th scope="row" className="lobby-row__name">
        <Link href={to(`/profile/${encodeURIComponent(model.handle)}`)} className="lobby-row__link">
          {model.name}
          <span className="lobby-row__handle">@{model.handle}</span>
        </Link>
      </th>
      <td className="lobby-row__num lobby-row__rating">{model.rating}</td>
      <td className="lobby-row__num lobby-row__record">{model.record}</td>
      <td className="lobby-row__status">{model.status}</td>
      <td className="lobby-row__action">
        {model.action.kind === "challenge" ? (
          <button type="button" className="page-link page-link--ink" aria-label={model.action.label} onClick={() => onChallenge(model.playerId)}>
            {/* The visible word; the label names the player first. */}
            <ChallengeWord />
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function ChallengeWord() {
  return <>{useCopy().CHALLENGE}</>;
}

/**
 * Who is here now (game flow B1): a table in the order the page keeps (frozen
 * while the pointer or focus is inside it), eight rows then the rest on request.
 */
export function HereNowTable({ rows, here, playing, onChallenge, onFreeze }: HereNowTableProps) {
  const copy = useCopy();
  const [expanded, setExpanded] = useState(false);
  const models = rows.map((r) => rowModel(r, copy));
  const { shown, more } = visibleRows(models, expanded);
  if (rows.length === 0) return <p className="page-sentence lobby-empty">{copy.pages.NO_ONE_ELSE}</p>;
  return (
    <div
      className="lobby-table-wrap"
      onPointerEnter={() => onFreeze(true)}
      onPointerLeave={() => onFreeze(false)}
      onFocus={() => onFreeze(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && onFreeze(false)}
    >
      <table className="lobby-table">
        <caption className="page-caption lobby-table__caption">{copy.pages.hereNowCaption(here, playing)}</caption>
        <thead>
          <tr>
            <th scope="col" className="visually-hidden">{copy.PROFILE}</th>
            <th scope="col" className="page-caption lobby-table__num">{copy.pages.COL_RATING}</th>
            <th scope="col" className="page-caption lobby-table__num lobby-table__record">{copy.pages.COL_RECORD}</th>
            <th scope="col" className="page-caption lobby-table__status">{copy.pages.COL_STATUS}</th>
            <th scope="col" className="visually-hidden">{copy.CHALLENGE}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((m) => (
            <Row key={m.playerId} model={m} onChallenge={onChallenge} />
          ))}
        </tbody>
      </table>
      {more > 0 ? (
        <button type="button" className="page-link page-link--ink lobby-table__more" onClick={() => setExpanded(true)}>
          {copy.pages.moreRows(more)}
        </button>
      ) : null}
    </div>
  );
}
