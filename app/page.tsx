import { BoardExperience } from "../components/game/BoardExperience";
import { getBoard } from "./actions/getBoard";

export default async function Home() {
  let board: Awaited<ReturnType<typeof getBoard>> | null = null;
  let errorMessage: string | null = null;

  try {
    board = await getBoard();
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while loading the board.";
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-white/80 shadow-lg">
        <h2 className="text-lg font-semibold text-white">Board Overview</h2>
        <p className="mt-2 text-sm">
          Supabase stores the authoritative board state. This view fetches the current 16×16
          grid via a server action so swaps can update the same data source in later phases.
        </p>
        {board && (
          <dl className="mt-4 grid grid-cols-1 gap-3 text-xs text-white/60 sm:grid-cols-2">
            <div className="rounded border border-white/10 bg-white/5 p-3">
              <dt className="font-medium text-white/70">Board ID</dt>
              <dd className="mt-1 font-mono text-xs text-white/80">
                {board.boardId}
              </dd>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-3">
              <dt className="font-medium text-white/70">Updated At</dt>
              <dd className="mt-1 font-mono text-xs text-white/80">
                {board.updatedAt ?? "Unknown"}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-900/70 p-6 text-sm text-white/80 shadow-xl">
        <h3 className="text-base font-semibold text-white">Live Board</h3>
        <p className="mt-2 text-xs text-white/60">
          Letters are sized for desktop and mobile viewports. Select any two tiles to request a
          swap and the result is announced through accessible feedback powered by Supabase data.
        </p>

        {errorMessage ? (
          <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            <p className="font-semibold text-rose-200">Unable to load board</p>
            <p className="mt-1 text-xs text-rose-100/80">{errorMessage}</p>
            <p className="mt-2 text-xs text-rose-100/70">
              Run <code className="font-mono">pnpm quickstart</code> to ensure Supabase is
              running locally with seeded data, then refresh this page.
            </p>
          </div>
        ) : board ? (
          <div className="mt-6 space-y-4">
            <BoardExperience initialGrid={board.grid} />
          </div>
        ) : (
          <div className="mt-6 text-xs text-white/60">
            Loading board data&hellip;
          </div>
        )}
      </div>
    </section>
  );
}

