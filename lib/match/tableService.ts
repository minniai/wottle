import "server-only";

import { z } from "zod";

import { TABLE_LEAD_MS } from "@/lib/constants/table";
import { pokePlayers, type PlayerPokeKind } from "@/lib/realtime/pokes";
import type { Language } from "@/lib/types/game-config";

import { MATCH_CLOCK_MS, startingBoardFor } from "./startingBoard";

/**
 * The only TypeScript door to the table's database functions (spec 069):
 * seat, start, leave and void. Each call is one locked RPC; the database
 * decides, this module parses, logs and publishes.
 */
type RpcReply = PromiseLike<{ data: unknown; error: { message: string } | null }>;
// The Supabase client's builder types are too deep to restate; the shape used is `from().select().eq().maybeSingle()`.
type TableClient = { rpc: (fn: string, args: Record<string, unknown>) => RpcReply; from: (table: string) => any };

export interface TableDeps {
  client: TableClient;
  /** Broadcasts the match's new state; the loader's lazy path passes none. */
  publish?: (matchId: string) => Promise<void>;
}

export type StartOutcome = { status: "started"; startedAt: string; deadlineAt: string; serverNow: string };
export type SeatOutcome = { status: "seated" | "void" | "ended" | "not_found" } | StartOutcome;
export type VoidOutcome = { status: "void" | "not_pending" | "not_due" };
export type StartIfSeatedOutcome = StartOutcome | { status: "waiting" | "void" | "ended" | "not_found" };

const started = z.object({ status: z.literal("started"), startedAt: z.string(), deadlineAt: z.string(), serverNow: z.string() });
const seatReply = z.union([started, z.object({ status: z.enum(["seated", "late", "void", "ended", "not_found"]) })]);
const startReply = z.union([started, z.object({ status: z.enum(["waiting", "void", "ended", "not_found"]) })]);
const voidReply = z.union([
  z.object({ status: z.literal("void"), reason: z.enum(["not_seated", "left"]), voidedBy: z.string().nullable() }),
  z.object({ status: z.enum(["not_pending", "not_due", "invalid"]) }),
]);

async function call<T>(client: TableClient, fn: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn}: unexpected reply ${JSON.stringify(data)}`);
  return parsed.data;
}

async function boardOf(client: TableClient, matchId: string): Promise<string[][]> {
  const { data, error } = await client.from("matches").select("id, board_seed, language").eq("id", matchId).maybeSingle();
  if (error || !data) throw new Error(`table board: ${error?.message ?? "no match"}`);
  return startingBoardFor(data as { id: string; board_seed: string | null; language: Language | null });
}

/** Every tab of both players hears the table change (spec 070 US9); a failed read or poke is not the seat's failure. */
async function pokeBoth(client: TableClient, matchId: string, kind: PlayerPokeKind): Promise<void> {
  try {
    const { data } = await client.from("matches").select("player_a_id, player_b_id").eq("id", matchId).maybeSingle();
    if (data) await pokePlayers([data.player_a_id as string, data.player_b_id as string], kind);
  } catch (error) {
    console.warn(JSON.stringify({ event: "table.poke.failed", matchId, kind, error: error instanceof Error ? error.message : String(error) }));
  }
}

function log(event: string, fields: Record<string, unknown>): void {
  console.info(JSON.stringify({ event, ...fields }));
}

async function startArgs(client: TableClient, matchId: string) {
  return { p_board: await boardOf(client, matchId), p_lead_ms: TABLE_LEAD_MS, p_clock_ms: MATCH_CLOCK_MS };
}

export async function seatPlayer(deps: TableDeps, matchId: string, playerId: string): Promise<SeatOutcome> {
  const reply = await call(deps.client, "seat_player", { p_match: matchId, p_player: playerId, ...(await startArgs(deps.client, matchId)) }, seatReply);
  if (reply.status === "late") return voidDueTable(deps, matchId) as Promise<SeatOutcome>;
  if (reply.status === "seated") log("table.seated", { matchId, playerId });
  if (reply.status === "started") log("table.started", { matchId, playerId, startedAt: reply.startedAt });
  if (reply.status === "seated" || reply.status === "started") {
    await deps.publish?.(matchId);
    await pokeBoth(deps.client, matchId, "seat");
  }
  return reply as SeatOutcome;
}

export async function startTableIfSeated(deps: TableDeps, matchId: string): Promise<StartIfSeatedOutcome> {
  const reply = await call(deps.client, "start_table_if_seated", { p_match: matchId, ...(await startArgs(deps.client, matchId)) }, startReply);
  if (reply.status === "started") log("table.started", { matchId, startedAt: reply.startedAt });
  return reply;
}

async function voidTable(deps: TableDeps, matchId: string, reason: "not_seated" | "left", by: string | null): Promise<VoidOutcome> {
  const reply = await call(deps.client, "void_table", { p_match: matchId, p_reason: reason, p_by: by }, voidReply);
  if (reply.status !== "void") return { status: reply.status === "invalid" ? "not_pending" : reply.status };
  log("table.void", { matchId, reason: reply.reason, voidedBy: reply.voidedBy });
  await deps.publish?.(matchId);
  await pokeBoth(deps.client, matchId, "table");
  return { status: "void" };
}

export function voidDueTable(deps: TableDeps, matchId: string): Promise<VoidOutcome> {
  return voidTable(deps, matchId, "not_seated", null);
}

export function leaveTable(deps: TableDeps, matchId: string, playerId: string): Promise<VoidOutcome> {
  return voidTable(deps, matchId, "left", playerId);
}
