import type { copyEn } from "@/lib/i18n/copy/en";

type Widen<T> = T extends string
  ? string
  : T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

/** The shape every locale's strings must have (spec 060 FR-011): the English keys, widened. */
export type Copy = Widen<typeof copyEn>;

/** A failure the server reports by code; the client says it in the page's language (research R4). */
export type ErrorCode = keyof Copy["errors"];
