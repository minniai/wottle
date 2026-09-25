/**
 * The door's name rule: one source for the form, which checks as the player
 * types, and the server, which decides.
 */
export const NAME_MIN = 3;
export const NAME_MAX = 24;
export const NAME_PATTERN = /^[A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö0-9_-]+$/;

export type NameVerdict = "empty" | "short" | "long" | "chars" | "ok";

/** A bad character is named before a bad length: it is the one a player cannot see. */
export function checkName(raw: string): NameVerdict {
  const name = raw.trim();
  if (name.length === 0) return "empty";
  if (!NAME_PATTERN.test(name)) return "chars";
  if (name.length > NAME_MAX) return "long";
  if (name.length < NAME_MIN) return "short";
  return "ok";
}
