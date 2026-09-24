import { notFound } from "next/navigation";

import { isRoomPhase, type RoomPhase } from "./fixtures";
import { RoomFixture } from "./RoomFixture";
import RulesPage from "@/app/[locale]/(pages)/(framed)/rules/page";
import { FramedPage } from "@/components/page/FramedPage";

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
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ phase?: string }>;
}

export default async function RoomFixturePage({ params, searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production" && !process.env.ROOM_FIXTURES) notFound();

  const { phase } = await searchParams;
  const resolved: RoomPhase = isRoomPhase(phase) ? phase : "picking";

  // Spec 072 E3: the rules are a page; the fixture wears the frame the route's layout gives it, signed out.
  if (resolved === "rules") return <FramedPage viewer={null} place="rules">{await RulesPage({ params })}</FramedPage>;
  return <RoomFixture phase={resolved} />;
}
