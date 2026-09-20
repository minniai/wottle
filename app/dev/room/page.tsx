import { notFound } from "next/navigation";

import { isRoomPhase, type RoomPhase } from "./fixtures";
import { RoomFixture } from "./RoomFixture";
import RulesPage from "@/app/rules/page";

/**
 * The fixture route (spec 045 US1). Renders any room state from static data so
 * the room can be seen — and screenshotted — with no database, no session and
 * no second player. A development and test surface: nothing links to it.
 *
 * Off in production unless ROOM_FIXTURES is set, which the CI visual job does
 * against a production build.
 */
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ phase?: string }>;
}

export default async function RoomFixturePage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production" && !process.env.ROOM_FIXTURES) notFound();

  const { phase } = await searchParams;
  const resolved: RoomPhase = isRoomPhase(phase) ? phase : "picking";

  if (resolved === "rules") return <RulesPage />;
  return <RoomFixture phase={resolved} />;
}
