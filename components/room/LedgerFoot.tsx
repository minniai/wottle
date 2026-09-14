"use client";

import type { ReactNode } from "react";

import { RULES } from "@/lib/constants/copy";
import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { RoomMenu, type RoomMenuVariant } from "./RoomMenu";

interface LedgerFootProps {
  variant: RoomMenuVariant;
  actions?: ReactNode;
  onAction: (action: LedgerAction) => void;
}

/** `? rules` and the state's actions left, the `⋯` menu right (design system §5.4). */
export function LedgerFoot({ variant, actions, onAction }: LedgerFootProps) {
  return (
    <div className="ledger__foot" data-testid="ledger-foot">
      <div className="ledger__actions">
        <button type="button" className="action-secondary" data-testid="ledger-rules" onClick={() => onAction("rules")}>
          {RULES}
        </button>
        {actions}
      </div>
      <RoomMenu variant={variant} onAction={onAction} />
    </div>
  );
}
