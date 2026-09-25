"use client";

import { useState } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { checkName, NAME_MAX } from "@/lib/names/nameRule";
import type { ErrorCode } from "@/lib/i18n/copy/types";
import { nameLine } from "@/lib/pages/nameLine";

export interface NameFieldState {
  name: string;
  setName: (name: string) => void;
  blurred: boolean;
  markBlurred: () => void;
  serverError: ErrorCode | null;
  setServerError: (code: ErrorCode | null) => void;
  /** The name passes the rule, so the primary may be pressed. */
  valid: boolean;
}

/** The door's one input, checked as it is typed; a new keystroke clears the server's last answer. */
export function useNameField(): NameFieldState {
  const [name, setNameRaw] = useState("");
  const [blurred, setBlurred] = useState(false);
  const [serverError, setServerError] = useState<ErrorCode | null>(null);
  const setName = (next: string) => {
    setNameRaw(next);
    setServerError(null);
  };
  return { name, setName, blurred, markBlurred: () => setBlurred(true), serverError, setServerError, valid: checkName(name) === "ok" };
}

interface NameFieldProps {
  field: NameFieldState;
  /** While entering, the name is held as sent. */
  readOnly: boolean;
  onEnter?: () => void;
}

/** The label, the name and its line: the rule until the name breaks it (A1). */
export function NameField({ field, readOnly, onEnter }: NameFieldProps) {
  const copy = useCopy();
  const line = nameLine(copy, field);
  return (
    <>
      <label htmlFor="door-name" className="page-caption">{copy.pages.NAME_LABEL}</label>
      <input
        id="door-name"
        name="username"
        className="door-form__input"
        placeholder={copy.YOUR_NAME_PLACEHOLDER}
        autoComplete="username"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={NAME_MAX + 1}
        value={field.name}
        readOnly={readOnly}
        onChange={(e) => field.setName(e.target.value)}
        onBlur={field.markBlurred}
        onKeyDown={onEnter ? (e) => e.key === "Enter" && onEnter() : undefined}
        aria-describedby="door-error"
        aria-invalid={line.error}
        data-testid="door-name"
      />
      <p id="door-error" className="page-label door-form__error" aria-live="polite" data-testid="door-error" data-error={line.error}>
        {line.text}
      </p>
    </>
  );
}

interface EnterButtonProps {
  label: string;
  entering: boolean;
  disabled: boolean;
  testId: string;
  onClick?: () => void;
}

/** The door's primary: grey until it can act; pressed, it holds the tint and says the lobby is opening. */
export function EnterButton({ label, entering, disabled, testId, onClick }: EnterButtonProps) {
  const copy = useCopy();
  return (
    <button
      type={onClick ? "button" : "submit"}
      className="action-primary page-primary page-primary--block"
      disabled={disabled || entering}
      aria-busy={entering}
      onClick={onClick}
      data-testid={testId}
    >
      {entering ? (
        <>
          {copy.pages.ENTERING}
          <span className="door-dots" aria-hidden="true">···</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
