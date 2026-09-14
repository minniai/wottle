import { redirect } from "next/navigation";

/** The post-game screen is the room's final state (spec 044 US9); this route only forwards. */
export default async function MatchSummaryRedirect({ params }: { params: Promise<{ matchId: string }> | { matchId: string } }) {
  const { matchId } = await params;
  redirect(`/match/${matchId}`);
}
