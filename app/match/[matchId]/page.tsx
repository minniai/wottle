import { MatchShell } from "../../../components/match/MatchShell";

interface MatchPageParams {
  matchId: string;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<MatchPageParams> | MatchPageParams;
}) {
  const { matchId } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6 text-white">
      <MatchShell
        matchId={matchId}
        headline="Match connected"
        statusMessage="Loading realtime state…"
      />
    </main>
  );
}


