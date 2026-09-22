"use client";

import type { ReactNode } from "react";

import Link from "next/link";

import { useLocalePath } from "@/components/i18n/LocaleProvider";
import { useCopy } from "@/components/i18n/LocaleProvider";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { RoomMenu, type RoomMenuVariant } from "./RoomMenu";

interface LedgerFootProps {
  variant: RoomMenuVariant;
  actions?: ReactNode;
  onAction: (action: LedgerAction) => void;
}

/** The state's actions left (`how to play ▸` outside a match, spec 048 US5), the `⋯` menu right (design system §5.4). */
export function LedgerFoot({ variant, actions, onAction }: LedgerFootProps) {
  const { HOW_TO_PLAY } = useCopy();
  const to = useLocalePath();
  return (
    <div className="ledger__foot" data-testid="ledger-foot" data-field-safe>
      <div className="ledger__actions">
        {variant === "match" ? null : (
          <Link href={to("/rules")} className="action-secondary" data-testid="ledger-how-to-play">
            {HOW_TO_PLAY}
          </Link>
        )}
        {actions}
      </div>
      <RoomMenu variant={variant} onAction={onAction} />
    </div>
  );
}
