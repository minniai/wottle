/**
 * A handle as a route hands it over: percent-encoded when it holds an Icelandic
 * letter (`k%C3%A1ri`), and possibly decomposed (`a` + combining acute). Stored
 * handles are decoded and composed, so read it the same way. A malformed escape
 * stays as it is and fails validation.
 */
export function readHandle(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Not a valid escape: validation refuses it.
  }
  return decoded.normalize("NFC");
}

/** The path of a player's profile (spec 072 FR-047): the handle percent-encoded, `/profile/k%C3%A1ri`. */
export function profileHandlePath(handle: string): string {
  return `/profile/${encodeURIComponent(handle.normalize("NFC"))}`;
}
