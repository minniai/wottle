"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { enterAsReturningAction } from "@/app/actions/auth/enterAsReturning";
import { loginAction, type LoginActionState } from "@/app/actions/auth/login";
import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import type { ReturningPlayer } from "@/lib/types/lobby";

const INITIAL: LoginActionState = { status: "idle" };

/** Signed in: the lobby at the same URL, or the validated `?next=`, replacing the door's entry (T1, T57). */
function useEnter(next: string | null): () => void {
  const router = useRouter();
  const to = useLocalePath();
  return () => {
    router.replace(next ?? to("/"));
    router.refresh();
  };
}

function Submit() {
  const { ENTER_LOBBY } = useCopy();
  const { pending } = useFormStatus();
  // Pressed: the tint ground; repeat presses do nothing while it is submitting.
  return (
    <button type="submit" className="action-primary page-primary page-primary--block" data-testid="door-enter" aria-disabled={pending} onClick={(e) => pending && e.preventDefault()}>
      {ENTER_LOBBY}
    </button>
  );
}

function Notes() {
  const { NO_ACCOUNT_NEEDED, THIS_BROWSER_KEEPS_YOUR_NAME } = useCopy();
  return (
    <p className="door-notes">
      <span className="page-label">{NO_ACCOUNT_NEEDED}</span>
      <span className="page-label">{THIS_BROWSER_KEEPS_YOUR_NAME}</span>
    </p>
  );
}

/** The one input on the door (A1): the name, its rule and error line, one primary. */
export function NameForm({ next }: { next: string | null }) {
  const copy = useCopy();
  const { language } = useLocale();
  const enter = useEnter(next);
  const [state, formAction] = useActionState(loginAction, INITIAL);
  const failed = state.status === "error";
  useEffect(() => {
    if (state.status === "success") enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per result
  }, [state]);
  return (
    <form action={formAction} className="door-form" data-testid="door-form">
      <label htmlFor="door-name" className="page-caption">{copy.pages.NAME_LABEL}</label>
      <input
        id="door-name"
        name="username"
        className="door-form__input"
        placeholder={copy.YOUR_NAME_PLACEHOLDER}
        autoComplete="username"
        maxLength={24}
        aria-describedby="door-error"
        aria-invalid={failed}
        data-testid="door-name"
      />
      <input type="hidden" name="language" value={language} />
      <p id="door-error" className="page-label door-form__error" aria-live="polite" data-testid="door-error" data-error={failed}>
        {failed ? copy.errors[state.code ?? "login_failed"] : copy.errors.invalid_name}
      </p>
      <Submit />
      <Notes />
    </form>
  );
}

/** After a sign-out, this browser's player is greeted by name (spec 067 US3, DoorReturning). */
export function ReturningForm({ returning, next, onAnotherName }: { returning: ReturningPlayer; next: string | null; onAnotherName: () => void }) {
  const copy = useCopy();
  const { language } = useLocale();
  const enter = useEnter(next);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const onEnter = () =>
    startTransition(async () => {
      const result = await enterAsReturningAction(language);
      if (result.status === "success") enter();
      else setFailed(true);
    });
  return (
    <div className="door-form" data-testid="door-returning">
      <span className="page-caption">{copy.WELCOME_BACK}</span>
      <span className="door-form__returning">
        <span className="page-square page-square--you" aria-hidden="true" />
        {returning.displayName}
      </span>
      <p className="page-label door-form__error" aria-live="polite" data-error={failed}>
        {failed ? copy.errors.login_failed : null}
      </p>
      <button type="button" className="action-primary page-primary page-primary--block" disabled={pending} onClick={onEnter} data-testid="door-enter-returning">
        {copy.ENTER_LOBBY}
      </button>
      <button type="button" className="page-link page-link--ink" onClick={onAnotherName} data-testid="door-another-name">
        {copy.notYou(returning.displayName)}
      </button>
      <Notes />
    </div>
  );
}
