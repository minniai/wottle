"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { enterAsReturningAction } from "@/app/actions/auth/enterAsReturning";
import { loginAction } from "@/app/actions/auth/login";
import { acceptLinkAction, type AcceptLinkInput } from "@/app/actions/link/accept";
import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import type { ErrorCode } from "@/lib/i18n/copy/types";
import { localePath } from "@/lib/i18n/locales";
import { inviteDoorModel, lobbyWithInvite, type InviteDoorModel } from "@/lib/pages/inviteDoor";
import type { LinkView } from "@/lib/types/link";
import type { ReturningPlayer } from "@/lib/types/lobby";
import type { Overview } from "@/lib/types/standing";

import { PageFrame } from "../PageFrame";
import { useActivationGuard } from "../useActivationGuard";
import { Door } from "./Door";

interface InviteEntryProps {
  token: string;
  view: LinkView | null;
  returning: ReturningPlayer | null;
  /** The server's instant: the first paint's countdown, so the page hydrates as it was rendered. */
  renderedAt: number;
}

/** `now` from the server's instant, then the wall clock each second once mounted. */
function useNowFrom(renderedAt: number): number {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** The call band (A2): the sender's name, their rating, the language and the link's time. */
function InviteBand({ band }: { band: InviteDoorModel["band"] }) {
  return (
    <div className="invite-band line-slot" data-style={band.expired ? "status" : "call"} data-testid="invite-band">
      {band.expired ? null : <span className="page-square page-square--opp" aria-hidden="true" />}
      <div className="line-slot__lines">
        <p className="line-slot__line1">{band.line1}</p>
        {band.line2 ? <p className="page-label line-slot__line2">{band.line2}</p> : null}
      </div>
    </div>
  );
}

/** Where an accept leads: the table, the lobby with the link's call, or the band reading expired. */
function useAccept(token: string, onExpired: () => void, onError: (code: ErrorCode) => void) {
  const router = useRouter();
  const { id: locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const accept = (input: AcceptLinkInput) =>
    startTransition(async () => {
      const result = await acceptLinkAction(input);
      if (result.status === "created") router.push(localePath(result.language, `/match/${result.matchId}`));
      else if (result.status === "expired") onExpired();
      else if (result.status === "sign_in_failed") onError(result.code);
      else if (result.status === "own" || result.status === "busy") router.push(lobbyWithInvite(locale, token));
      else onError("login_failed");
    });
  return { accept, pending };
}

/**
 * The invite door's column B (spec 072 A2): the call band, the name (or the
 * returning player), `accept ▸`, `enter the lobby instead` and what accepting
 * does. Opening the page wrote nothing; only `accept ▸` does (FR-010, FR-020).
 */
export function InviteEntry({ token, view, returning, renderedAt }: InviteEntryProps) {
  const copy = useCopy();
  const { language, id: locale } = useLocale();
  const router = useRouter();
  const to = useLocalePath();
  const nowMs = useNowFrom(renderedAt);
  const [expired, setExpired] = useState(false);
  const [anotherName, setAnotherName] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const asReturning = Boolean(returning && !anotherName);
  const model = inviteDoorModel(expired ? null : view, nowMs, copy, asReturning ? "returning" : "empty");
  const ready = useActivationGuard(`${model.primary.action}:${asReturning}`);
  const { accept, pending } = useAccept(token, () => setExpired(true), setError);
  const lobbyWithCall = lobbyWithInvite(locale, token);

  const onAccept = () => {
    if (!ready() || pending) return;
    accept(asReturning ? { token, mode: "returning" } : { token, mode: "name", name });
  };
  const onLobbyInstead = async () => {
    const form = new FormData();
    form.set("username", name);
    form.set("language", language);
    const result = asReturning ? await enterAsReturningAction(language) : await loginAction({ status: "idle" }, form);
    if (result.status === "success") router.push(lobbyWithCall);
    else setError(result.code ?? "login_failed");
  };

  if (model.band.expired) {
    return (
      <div className="door-form invite-entry" data-testid="invite-entry">
        <InviteBand band={model.band} />
        <button type="button" className="action-primary page-primary page-primary--block" onClick={() => router.push(to("/"))} data-testid="invite-enter-lobby">
          {model.primary.label}
        </button>
      </div>
    );
  }
  return (
    <div className="door-form invite-entry" data-testid="invite-entry">
      <InviteBand band={model.band} />
      {asReturning ? (
        <>
          <span className="page-caption">{copy.WELCOME_BACK}</span>
          <span className="door-form__returning" data-testid="invite-returning">
            <span className="page-square page-square--you" aria-hidden="true" />
            {returning!.displayName}
          </span>
        </>
      ) : (
        <>
          <label htmlFor="door-name" className="page-caption">{copy.pages.NAME_LABEL}</label>
          <input
            id="door-name"
            name="username"
            className="door-form__input"
            placeholder={copy.YOUR_NAME_PLACEHOLDER}
            autoComplete="username"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAccept()}
            aria-describedby="door-error"
            aria-invalid={error !== null}
            data-testid="door-name"
          />
        </>
      )}
      <p id="door-error" className="page-label door-form__error" aria-live="polite" data-testid="door-error" data-error={error !== null}>
        {error ? copy.errors[error] : asReturning ? null : copy.errors.invalid_name}
      </p>
      <button type="button" className="action-primary page-primary page-primary--block" aria-disabled={pending} onClick={onAccept} data-testid="invite-accept">
        {model.primary.label}
      </button>
      <button type="button" className="page-link page-link--ink" onClick={() => void onLobbyInstead()} data-testid="invite-lobby-instead">
        {model.secondary?.label}
      </button>
      {asReturning ? (
        <button type="button" className="page-link page-link--ink" onClick={() => setAnotherName(true)} data-testid="door-another-name">
          {copy.notYou(returning!.displayName)}
        </button>
      ) : null}
      <p className="page-sentence invite-entry__consequence" data-testid="invite-consequence">{model.consequence}</p>
    </div>
  );
}

interface InviteDoorPageProps extends InviteEntryProps {
  overview: Overview;
}

/** `/c/:token` signed out (spec 072 US2): the door, with the invitation in column B. */
export function InviteDoorPage({ overview, token, view, returning, renderedAt }: InviteDoorPageProps) {
  const copy = useCopy();
  const here = overview.counts.here;
  const doorCount = here > 0 ? copy.pages.doorCount(here, overview.counts.matchesOn) : null;
  return (
    <PageFrame variant="door" place={null} doorCount={doorCount} doorCountPhone={here > 0 ? copy.pages.doorCountPhone(here) : null} preferOther={false}>
      <Door here={overview.here ?? []} more={overview.more ?? 0} returning={null} next={null} entry={<InviteEntry token={token} view={view} returning={returning} renderedAt={renderedAt} />} />
    </PageFrame>
  );
}
