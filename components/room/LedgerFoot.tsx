"use client";

import type { ReactNode } from "react";

import Link from "next/link";

import { HOW_TO_PLAY } from "@/lib/constants/copy";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { RoomMenu, type RoomMenuVariant } from "./RoomMenu";

interface LedgerFootProps {
  variant: RoomMenuVariant;
  actions?: ReactNode;
  onAction: (action: LedgerAction) => void;
}

/** The state's actions left (`how to play ▸` outside a match, spec 048 US5), the `⋯` menu right (design system §5.4). */
export function LedgerFoot({ variant, actions, onAction }: LedgerFootProps) {
  return (
    <div className="ledger__foot" data-testid="ledger-foot" data-field-safe>
      <div className="ledger__actions">
        {variant === "match" ? null : (
          <Link href="/rules" className="action-secondary" data-testid="ledger-how-to-play">
            {HOW_TO_PLAY}
          </Link>
        )}
        {actions}
      </div>
      <RoomMenu variant={variant} onAction={onAction} />
    </div>
  );
}
