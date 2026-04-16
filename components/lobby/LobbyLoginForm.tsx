"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginActionState } from "@/app/actions/auth/login";
import { Button } from "@/components/ui/Button";

interface LobbyLoginFormProps {
  initialUsername?: string;
}

const INITIAL_STATE: LoginActionState = { status: "idle" };

export function LobbyLoginForm({ initialUsername }: LobbyLoginFormProps) {
  const [state, formAction] = useActionState(loginAction, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <form
      className="space-y-4 text-sm text-text-secondary"
      action={formAction}
      data-testid="lobby-login-form"
    >
      <div>
        <label
          htmlFor="username"
          className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
        >
          Choose a username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          inputMode="text"
          autoComplete="off"
          required
          defaultValue={initialUsername ?? ""}
          placeholder="e.g. ari_the_bold"
          maxLength={24}
          className="mt-2 w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent-focus focus:outline-none focus:ring-2 focus:ring-accent-focus/40"
          data-testid="lobby-username-input"
        />
        <p className="mt-2 text-xs text-text-muted">
          Letters, numbers, underscores, or hyphens only.
        </p>
      </div>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-lg border border-player-b/40 bg-player-b/10 p-3 text-xs text-rose-100"
        >
          {state.message}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={pending}
      data-testid="lobby-login-submit"
    >
      {pending ? "Joining…" : "Enter Lobby"}
    </Button>
  );
}
