"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { loginAction, type LoginActionState } from "@/app/actions/auth/login";
import { LandingTileVignette } from "@/components/landing/LandingTileVignette";

const INITIAL_STATE: LoginActionState = { status: "idle" };

export function LandingScreen() {
  const [state, formAction] = useActionState(loginAction, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-58px)] w-full max-w-3xl items-center justify-center px-6 py-16">
      <div className="w-full text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
          A real-time word duel · Icelandic
        </p>

        <h1 className="mt-4 font-display text-6xl font-semibold leading-[1.1] text-ink sm:text-7xl">
          Play with{" "}
          <em className="font-display not-italic text-ochre-deep">letters.</em>
        </h1>

        <p className="mx-auto mt-10 max-w-[52ch] text-base leading-relaxed text-ink-3 sm:text-lg">
          Two players. Ten rounds. A ten-by-ten grid. Swap any two tiles to
          forge words in any direction — and claim the letters as territory.
          Best score wins.
        </p>

        <form
          action={formAction}
          data-testid="landing-login-form"
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <input
            id="username"
            name="username"
            type="text"
            inputMode="text"
            autoComplete="off"
            required
            maxLength={24}
            placeholder="Choose a username"
            data-testid="landing-username-input"
            className="w-[280px] rounded-full border border-hair-strong bg-paper px-5 py-3 font-sans text-sm text-ink placeholder:text-ink-soft focus:border-ochre-deep focus:outline-none focus:ring-2 focus:ring-ochre-deep/30"
          />
          <SubmitButton />
        </form>

        {state.status === "error" && state.message ? (
          <p
            role="alert"
            data-testid="landing-login-error"
            className="mx-auto mt-4 max-w-sm rounded-md border border-bad/50 bg-bad/10 px-3 py-2 text-xs text-bad"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-ink-soft">
          <span>3–24 characters · letters, numbers, dashes</span>
          <span aria-hidden="true">·</span>
          <span>Magic link after first game</span>
        </div>

        <div className="mt-16">
          <LandingTileVignette />
        </div>
      </div>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="landing-login-submit"
      className="lobby-primary-cta inline-flex min-h-[52px] items-center justify-center rounded-full px-6 py-3 font-display text-base font-semibold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-focus"
    >
      {pending ? "Joining…" : "Enter lobby →"}
    </button>
  );
}
