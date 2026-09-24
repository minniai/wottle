/**
 * Spec 072: invite links. The life comes from GAME_FLOW_SPEC §7.1 (link TTL,
 * 10 minutes); the create limit is spec 070's six challenges a minute, which a
 * link counts toward (FR-006).
 */
export const LINK_TTL_MS = 600_000;

/** 256 bits: a token cannot be guessed, so a fast hash is enough (research R1). */
export const LINK_TOKEN_BYTES = 32;

export const LINK_CREATE_LIMIT = { limit: 6, windowMs: 60_000 } as const;

export const LINK_ACCEPT_LIMIT = { limit: 10, windowMs: 60_000 } as const;

/** Where the sender's browser keeps the link's text for `copy again ▸` (research R2). */
export const LINK_STORAGE_KEY = "wottle-link";
