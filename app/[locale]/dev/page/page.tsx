import { notFound } from "next/navigation";

import { isPagePhase } from "./fixtures";
import { PageFixture } from "./PageFixture";

/**
 * The page fixture route (spec 070 T017). Off in production unless
 * ROOM_FIXTURES is set, as for `/dev/room`. Nothing links to it.
 */
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ phase?: string }>;
}

export default async function PageFixturePage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production" && !process.env.ROOM_FIXTURES) notFound();
  const { phase } = await searchParams;
  if (!isPagePhase(phase)) notFound();
  return <PageFixture phase={phase} />;
}
