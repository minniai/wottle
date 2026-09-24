"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";
import type { SlotAction, SlotModel } from "@/lib/pages/slotLines";

import { SlotTerms } from "./SlotTerms";
import { useActivationGuard } from "./useActivationGuard";

export const SLOT_ACTIONS_ID = "line-slot-actions";

interface LineSlotProps {
  model: SlotModel;
  onAction: (action: SlotAction) => void;
  /** A polite line said on arrival and at 10s left; never steals focus. */
  announcement: string;
  /** The place's counts off the lobby page (§5.0 empty slot). */
  counts?: { here: number; playing: number } | null;
  variant: "desktop" | "phone";
}

function Bar({ bar }: { bar: SlotModel["bar"] }) {
  if (!bar) return null;
  if (bar.kind === "sweep") return <span className="line-slot__bar line-slot__bar--sweep" aria-hidden="true" />;
  return (
    <span className="line-slot__bar" aria-hidden="true">
      <span className="line-slot__drain" style={{ transform: `scaleX(${bar.fraction})` }} />
    </span>
  );
}

/**
 * The line slot (spec 070 US4, game flow §5.0, §8 item 7): one standing state
 * under the masthead, in call style (addressed to you) or status style (your
 * own), with its countdown, its bar and its way out. Its height is reserved,
 * so nothing below moves when it changes (SC-006).
 */
export function LineSlot({ model, onAction, announcement, counts = null, variant }: LineSlotProps) {
  const copy = useCopy();
  const ready = useActivationGuard(`${model.primary?.action ?? ""}:${model.line1}`);
  return (
    <div className={`line-slot line-slot--${variant}`} data-style={model.style} role="region" aria-label={copy.pages.CHALLENGES_REGION} data-testid={`line-slot-${variant}`}>
      {model.style === "terms" ? (
        <SlotTerms counts={counts} />
      ) : (
        <>
          <span className={`page-square page-square--${model.square ?? "you"}`} aria-hidden="true" />
          <div className="line-slot__lines">
            <p className="line-slot__line1" data-testid="line-slot-line1">{model.line1}</p>
            {model.line2IsUrl ? (
              <input className="line-slot__url" readOnly value={model.line2} aria-label={model.line1} onFocus={(e) => e.currentTarget.select()} data-testid="line-slot-url" />
            ) : model.line2 ? (
              <p className="page-label line-slot__line2" data-testid="line-slot-line2">{model.line2}</p>
            ) : null}
          </div>
          <div className="line-slot__actions" id={variant === "desktop" ? SLOT_ACTIONS_ID : undefined}>
            {model.primary ? (
              <button type="button" className="action-primary page-primary line-slot__primary" onClick={() => ready() && onAction(model.primary!.action)} data-testid={`slot-${model.primary.action}`}>
                {model.primary.label}
              </button>
            ) : null}
            {model.secondaries.map((b) => (
              <button key={b.action} type="button" className="page-link page-link--ink line-slot__secondary" onClick={() => onAction(b.action)} data-testid={`slot-${b.action}`}>
                {b.label}
              </button>
            ))}
          </div>
          <Bar bar={model.bar} />
        </>
      )}
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
    </div>
  );
}

/** While a call is up, the page's first focusable element leads to it (§8 item 14). */
export function SkipToCall({ label }: { label: string }) {
  return (
    <a href={`#${SLOT_ACTIONS_ID}`} className="skip-to-call" data-testid="skip-to-call">
      {label}
    </a>
  );
}
