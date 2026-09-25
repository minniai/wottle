"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { enterAsReturningAction } from "@/app/actions/auth/enterAsReturning";
import { loginAction } from "@/app/actions/auth/login";
import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import type { ReturningPlayer } from "@/lib/types/lobby";

import { EnterButton, NameField, useNameField } from "./NameField";

/** Signed in: the lobby at the same URL, or the validated `?next=`, replacing the door's entry (T1, T57). */
function useEnter(next: string | null): () => void {
  const router = useRouter();
  return () => {
    // Without a `next` the lobby is this same page, read again signed in; it spends a refused `?next=` itself.
    if (next) router.replace(next);
    router.refresh();
  };
}

/**
 * From the press until the lobby replaces the door: the action, then the
 * refresh that reads the page again signed in. Success holds it, since the
 * door is unmounted when the lobby lands.
 */
function useEntering(): { entering: boolean; run: (action: () => Promise<boolean>) => void } {
  const [pending, startTransition] = useTransition();
  const [entered, setEntered] = useState(false);
  const run = (action: () => Promise<boolean>) =>
    startTransition(async () => {
      if (await action()) setEntered(true);
    });
  return { entering: pending || entered, run };
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

/** The one input on the door (A1): the name, its line, one primary that waits for a valid name. */
export function NameForm({ next }: { next: string | null }) {
  const copy = useCopy();
  const { language } = useLocale();
  const enter = useEnter(next);
  const field = useNameField();
  const { entering, run } = useEntering();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!field.valid || entering) return;
    const form = new FormData(event.currentTarget);
    run(async () => {
      const result = await loginAction({ status: "idle" }, form);
      if (result.status !== "success") {
        field.setServerError(result.code ?? "login_failed");
        return false;
      }
      enter();
      return true;
    });
  };
  return (
    <form onSubmit={onSubmit} className="door-form" data-testid="door-form" aria-busy={entering}>
      <NameField field={field} readOnly={entering} />
      <input type="hidden" name="language" value={language} />
      <EnterButton label={copy.ENTER_LOBBY} entering={entering} disabled={!field.valid} testId="door-enter" />
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
  const { entering, run } = useEntering();
  const onEnter = () =>
    run(async () => {
      const result = await enterAsReturningAction(language);
      if (result.status !== "success") {
        setFailed(true);
        return false;
      }
      enter();
      return true;
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
      <EnterButton label={copy.ENTER_LOBBY} entering={entering} disabled={false} onClick={onEnter} testId="door-enter-returning" />
      <button type="button" className="page-link page-link--ink" onClick={onAnotherName} data-testid="door-another-name">
        {copy.notYou(returning.displayName)}
      </button>
      <Notes />
    </div>
  );
}
