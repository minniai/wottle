"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginActionState } from "@/app/actions/auth/login";
import { useCopy } from "@/components/i18n/LocaleProvider";
import type { PlayerIdentity } from "@/lib/types/match";

const INITIAL: LoginActionState = { status: "idle" };

interface NameInputProps {
  onSignedIn: (player: PlayerIdentity) => void;
}

function SubmitButton() {
  const { PLAY } = useCopy();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="action-primary" data-testid="player-bar-action-play" disabled={pending}>
      {PLAY}
    </button>
  );
}

/** The one input in the room (design system §5.7): your name on a 1.5px ink underline, `play ▸` beside it. */
export function NameInput({ onSignedIn }: NameInputProps) {
  const { YOUR_NAME_PLACEHOLDER, errors } = useCopy();
  const [state, formAction] = useActionState(loginAction, INITIAL);

  useEffect(() => {
    if (state.status === "success" && state.player) onSignedIn(state.player);
  }, [state, onSignedIn]);

  return (
    <form action={formAction} className="name-input" data-testid="name-input-form">
      <input
        name="username"
        className="name-input__field"
        placeholder={YOUR_NAME_PLACEHOLDER}
        aria-label={YOUR_NAME_PLACEHOLDER}
        autoComplete="username"
        minLength={3}
        maxLength={24}
        required
        data-testid="player-bar-name-input"
      />
      <SubmitButton />
      {state.status === "error" ? (
        <span className="ledger__mono name-input__error" role="alert" data-testid="name-input-error">
          {errors[state.code ?? "login_failed"]}
        </span>
      ) : null}
    </form>
  );
}
