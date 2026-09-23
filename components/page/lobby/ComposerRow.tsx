"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { useIsPhone } from "@/components/room/hooks/useIsPhone";
import { composerModel, type ComposerFacts } from "@/lib/pages/composer";

import { useActivationGuard } from "../useActivationGuard";

interface ComposerRowProps {
  opponent: { rating: number };
  facts: Omit<ComposerFacts, "opponent">;
  columns: number;
  onSend: () => void;
  onClose: () => void;
}

/**
 * The challenge composer (game flow B2, F6): the row opens in place, states
 * the terms and your stakes, says what sending would cancel, and focuses send.
 * A call outranks it: send is then drawn as a secondary (US3.2).
 */
export function ComposerRow({ opponent, facts, columns, onSend, onClose }: ComposerRowProps) {
  const copy = useCopy();
  const isPhone = useIsPhone();
  const model = composerModel({ ...facts, opponent }, copy, isPhone ? "phone" : "desktop");
  const sendRef = useRef<HTMLButtonElement | null>(null);
  const ready = useActivationGuard(model.sendDrawnAs);
  useEffect(() => sendRef.current?.focus(), []);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  return (
    <tr className="composer-row" data-testid="composer" onKeyDown={onKeyDown}>
      <td colSpan={columns} className="composer-row__cell">
        <div className="composer-row__body">
          <div className="composer-row__lines">
            {model.terms.map((line) => (
              <p key={line} className="composer-row__terms">{line}</p>
            ))}
            {model.consequence ? <p className="page-label">{model.consequence}</p> : null}
          </div>
          <div className="composer-row__actions">
            <button
              ref={sendRef}
              type="button"
              className={model.sendDrawnAs === "primary" ? "action-primary page-primary composer-row__send" : "page-link page-link--ink"}
              onClick={() => ready() && onSend()}
              data-testid="composer-send"
            >
              {copy.pages.SEND}
            </button>
            <button type="button" className="page-link" onClick={onClose} data-testid="composer-not-now">
              {copy.pages.NOT_NOW}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
