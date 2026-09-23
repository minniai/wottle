"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import type { SendChallengeActionResult } from "@/app/actions/challenge/send";
import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { useNowTick } from "@/components/room/hooks/useNowTick";
import type { Copy } from "@/lib/i18n/copy/types";
import type { ComposerFacts } from "@/lib/pages/composer";
import { rowModel, visibleRows, type RowModel } from "@/lib/pages/lobbyRows";
import type { RowOverlay } from "@/lib/pages/rowOverlays";
import { formatClock } from "@/lib/room/clock";
import type { LobbyRow } from "@/lib/types/standing";

import { ComposerRow } from "./ComposerRow";

export type { RowOverlay };

interface HereNowTableProps {
  rows: LobbyRow[];
  here: number;
  playing: number;
  onFreeze: (frozen: boolean) => void;
  composer: Omit<ComposerFacts, "opponent">;
  overlays: Map<string, RowOverlay>;
  onSend: (playerId: string) => Promise<SendChallengeActionResult>;
  /** A composer is open: the page's primary steps down (B2). */
  onComposing?: (open: boolean) => void;
  /** Fixtures only: a row whose composer is open on first paint. */
  initialOpenId?: string | null;
}

const COLUMNS = 5;

function sendError(result: SendChallengeActionResult, copy: Copy): RowOverlay["action"] | null {
  switch (result.status) {
    case "sent":
    case "crossed":
      return null;
    case "in_match":
      return { error: copy.pages.SEND_ERRORS.in_match };
    case "gone":
    case "away":
      return { error: copy.pages.SEND_ERRORS.gone };
    case "rate_limited":
      return { error: copy.pages.SEND_ERRORS.rate_limited };
    case "declined_recently":
      return { againUntilMs: Date.parse(result.until) };
    case "cooldown":
      return { error: copy.errors.table_cooldown };
    default:
      return { error: copy.pages.SEND_ERRORS.failed };
  }
}

function ActionCell({ model, overlay, now, onOpen, buttonRef }: { model: RowModel; overlay?: RowOverlay; now: number; onOpen: () => void; buttonRef: (el: HTMLButtonElement | null) => void }) {
  const copy = useCopy();
  const action = overlay?.action;
  if (action === "none") return null;
  if (action && "againUntilMs" in action && action.againUntilMs > now) return <span className="page-label">{copy.pages.againIn(formatClock(action.againUntilMs - now))}</span>;
  if (action && "error" in action) return <span className="page-label lobby-row__error">{action.error}</span>;
  if (model.action.kind !== "challenge") return null;
  return (
    <button ref={buttonRef} type="button" className="page-link page-link--ink" aria-label={model.action.label} onClick={onOpen}>
      {copy.CHALLENGE}
    </button>
  );
}

function Row({ model, overlay, now, onOpen, buttonRef }: { model: RowModel; overlay?: RowOverlay; now: number; onOpen: () => void; buttonRef: (el: HTMLButtonElement | null) => void }) {
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
      <td className="lobby-row__status" data-ink={Boolean(overlay?.status)}>{overlay?.status ?? model.status}</td>
      <td className="lobby-row__action">
        <ActionCell model={model} overlay={overlay} now={now} onOpen={onOpen} buttonRef={buttonRef} />
      </td>
    </tr>
  );
}

/**
 * Who is here now (game flow B1–B5): a table in the order the page keeps
 * (frozen while the pointer or focus is inside it, or a composer is open),
 * eight rows then the rest on request; one row at a time opens the composer.
 */
export function HereNowTable({ rows, here, playing, onFreeze, composer, overlays, onSend, onComposing, initialOpenId = null }: HereNowTableProps) {
  const copy = useCopy();
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [errors, setErrors] = useState<Map<string, RowOverlay>>(new Map());
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // Esc or `not now` gives focus back to the row's own `challenge ▸`, once it is drawn again.
  const [refocus, setRefocus] = useState<string | null>(null);
  useEffect(() => {
    if (!refocus) return;
    buttons.current.get(refocus)?.focus();
    setRefocus(null);
  }, [refocus]);
  const counting = [...overlays.values(), ...errors.values()].some((o) => o.action && o.action !== "none" && "againUntilMs" in o.action);
  const now = useNowTick(counting);
  const models = rows.map((r) => rowModel(r, copy));
  const { shown, more } = visibleRows(models, expanded);
  if (rows.length === 0) return <p className="page-sentence lobby-empty">{copy.pages.NO_ONE_ELSE}</p>;

  const open = (id: string) => {
    setOpenId(id);
    onFreeze(true);
    onComposing?.(true);
  };
  const close = (id: string) => {
    setOpenId(null);
    onFreeze(false);
    onComposing?.(false);
    setRefocus(id);
  };
  const send = async (id: string) => {
    setOpenId(null);
    onFreeze(false);
    onComposing?.(false);
    const result = await onSend(id);
    const error = sendError(result, copy);
    setErrors((m) => {
      const next = new Map(m);
      if (error) next.set(id, { action: error });
      else next.delete(id);
      return next;
    });
  };

  return (
    <div
      className="lobby-table-wrap"
      onPointerEnter={() => onFreeze(true)}
      onPointerLeave={() => openId === null && onFreeze(false)}
      onFocus={() => onFreeze(true)}
      onBlur={(e) => openId === null && !e.currentTarget.contains(e.relatedTarget as Node) && onFreeze(false)}
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
            <Fragment key={m.playerId}>
              <Row
                model={m}
                overlay={openId === m.playerId ? { action: "none" } : overlays.get(m.playerId) ?? errors.get(m.playerId)}
                now={now}
                onOpen={() => open(m.playerId)}
                buttonRef={(el) => (el ? buttons.current.set(m.playerId, el) : buttons.current.delete(m.playerId))}
              />
              {openId === m.playerId ? (
                <ComposerRow opponent={{ rating: m.rating }} facts={composer} columns={COLUMNS} onSend={() => void send(m.playerId)} onClose={() => close(m.playerId)} />
              ) : null}
            </Fragment>
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
