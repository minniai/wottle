"use client";

import type { PagePhase } from "./fixtures";

/** Renders one page phase from static facts (T017); each story adds its phases. */
export function PageFixture({ phase }: { phase: PagePhase }) {
  return <div data-testid="page-fixture" data-phase={phase} />;
}
