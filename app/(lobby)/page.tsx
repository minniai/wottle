import { LobbyList } from "../../components/lobby/LobbyList";
import { LobbyLoginForm } from "../../components/lobby/LobbyLoginForm";
import { BoardExperience } from "../../components/game/BoardExperience";
import { getBoard } from "../actions/getBoard";
import { BOARD_DIMENSIONS_LABEL } from "../../lib/constants/board";
import { fetchLobbySnapshot, readLobbySession } from "../../lib/matchmaking/profile";
import type { PlayerIdentity } from "../../lib/types/match";

export default async function LobbyPage() {
  const session = await readLobbySession();
  const [initialPlayers, boardResult] = await Promise.all([
    session ? fetchLobbySnapshot() : Promise.resolve<PlayerIdentity[]>([]),
    loadBoard(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6 text-white">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">Phase 3</p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Authenticate &amp; Enter Lobby</h1>
        <p className="text-sm text-white/70">
          Log in with a playtest username to appear in the realtime lobby. Stay visible via Supabase
          presence with automatic polling fallback whenever WebSockets drop.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        {session ? (
          <LobbyList self={session.player} initialPlayers={initialPlayers} />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 p-6 text-sm text-white/70">
            <p className="text-base font-semibold text-white">Lobby preview</p>
            <p className="mt-2 text-xs text-white/60">
              Enter a username to appear here and see other testers join or leave in real time.
            </p>
          </div>
        )}

        <LobbyLoginForm initialUsername={session?.player.username} />
      </section>

      <BoardSection boardResult={boardResult} />
    </main>
  );
}

interface BoardResult {
  board: Awaited<ReturnType<typeof getBoard>> | null;
  error: string | null;
}

function BoardSection({ boardResult }: { boardResult: BoardResult }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-sm text-white/80 shadow-2xl shadow-slate-950/50">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-white">Board Overview</h2>
        <p className="text-xs text-white/60">
          Supabase stores the authoritative board state. This view keeps the existing {BOARD_DIMENSIONS_LABEL} grid
          accessible for swap validation and regression coverage while we expand the lobby experience.
        </p>
      </div>

      {boardResult.error ? (
        <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-100">
          <p className="font-semibold text-rose-200">Unable to load board</p>
          <p className="mt-1">{boardResult.error}</p>
          <p className="mt-2 text-rose-100/80">
            Run <code className="font-mono text-rose-50">pnpm quickstart</code> to ensure Supabase is ready, then
            refresh this page.
          </p>
        </div>
      ) : boardResult.board ? (
        <div className="mt-6 space-y-4">
          <dl className="grid grid-cols-1 gap-3 text-xs text-white/60 sm:grid-cols-2">
            <div className="rounded border border-white/10 bg-white/5 p-3">
              <dt className="font-medium text-white/70">Board ID</dt>
              <dd className="mt-1 font-mono text-xs text-white/80">{boardResult.board.boardId}</dd>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-3">
              <dt className="font-medium text-white/70">Updated At</dt>
              <dd className="mt-1 font-mono text-xs text-white/80">
                {boardResult.board.updatedAt ?? "Unknown"}
              </dd>
            </div>
          </dl>
          <BoardExperience initialGrid={boardResult.board.grid} matchId={boardResult.board.boardId} />
        </div>
      ) : (
        <div className="mt-6 text-xs text-white/60">Loading board data…</div>
      )}
    </section>
  );
}

async function loadBoard(): Promise<BoardResult> {
  try {
    const board = await getBoard();
    return { board, error: null };
  } catch (error) {
    return {
      board: null,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while loading the board.",
    };
  }
}


