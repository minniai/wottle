"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginActionState } from "@/app/actions/auth/login";

interface LobbyLoginFormProps {
  initialUsername?: string;
}

const INITIAL_STATE: LoginActionState = { status: "idle" };

export function LobbyLoginForm({ initialUsername }: LobbyLoginFormProps) {
  const [state, formAction] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form
      className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-sm text-white/70 shadow-2xl shadow-slate-950/50"
      action={formAction}
      data-testid="lobby-login-form"
    >
      <div>
        <label
          htmlFor="username"
          className="text-xs font-semibold uppercase tracking-wide text-white/60"
        >
          Playtest Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          inputMode="text"
          autoComplete="off"
          required
          defaultValue={initialUsername ?? ""}
          placeholder="e.g. tester_alpha"
          maxLength={24}
          className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          data-testid="lobby-username-input"
        />
        <p className="mt-2 text-xs text-white/50">Letters, numbers, underscores, or hyphens only.</p>
      </div>

      {state.status === "error" && state.message && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-xs text-rose-100">
          {state.message}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      data-testid="lobby-login-submit"
    >
      {pending ? "Joining…" : "Enter Lobby"}
    </button>
  );
}


