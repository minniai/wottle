import { checkName } from "@/lib/names/nameRule";
import type { Copy, ErrorCode } from "@/lib/i18n/copy/types";

export interface NameLineInput {
  name: string;
  /** The player has left the field once: only then is a short name worth a word. */
  blurred: boolean;
  serverError: ErrorCode | null;
}

export interface NameLine {
  text: string;
  error: boolean;
}

/** The door's name line: the rule until the name breaks it, then what broke it; the server's answer first. */
export function nameLine(copy: Copy, { name, blurred, serverError }: NameLineInput): NameLine {
  if (serverError) return { text: copy.errors[serverError], error: true };
  const verdict = checkName(name);
  if (verdict === "chars") return { text: copy.pages.NAME_CHARS, error: true };
  if (verdict === "long") return { text: copy.pages.NAME_LONG, error: true };
  if (verdict === "short" && blurred) return { text: copy.pages.NAME_SHORT, error: true };
  return { text: copy.errors.invalid_name, error: false };
}
