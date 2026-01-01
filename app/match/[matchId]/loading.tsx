import { MatchShell } from "@/components/match/MatchShell";

export default function MatchLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6 text-white">
      <MatchShell matchId="pending" />
    </main>
  );
}


