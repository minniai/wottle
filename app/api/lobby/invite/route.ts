import { playableLanguageSchema } from "@/lib/game-engine/languagePack";
import { NextResponse } from "next/server";

import {
  expireStaleInvites,
  getOutgoingInvite,
  listPendingInvites,
  sendDirectInvite,
} from "@/lib/matchmaking/inviteService";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const TTL_SECONDS = Number(process.env.PLAYTEST_INVITE_EXPIRY_SECONDS ?? "30");
const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function POST(request: Request) {
  const session = await readLobbySession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const recipientId = typeof payload?.recipientId === "string" ? payload.recipientId : null;
  if (!recipientId) {
    return NextResponse.json(
      { error: "recipientId is required." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = getServiceRoleClient();
    const language = playableLanguageSchema.safeParse(payload?.language);
    if (!language.success) {
      return NextResponse.json({ error: "Unsupported language." }, { status: 400, headers: NO_CACHE_HEADERS });
    }
    const result = await sendDirectInvite(supabase, {
      senderId: session.player.id,
      recipientId,
      ttlSeconds: TTL_SECONDS,
      language: language.data,
    });
    return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invite failed.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function GET() {
  const session = await readLobbySession();
  if (!session) {
    return NextResponse.json(
      { pending: [] },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = getServiceRoleClient();
    // Nothing else expires a challenge: without this an unanswered one is
    // pending forever and its sender is never told.
    await expireStaleInvites(supabase, { ttlSeconds: TTL_SECONDS });
    const [pending, outgoing] = await Promise.all([
      listPendingInvites(supabase, session.player.id, TTL_SECONDS),
      getOutgoingInvite(supabase, session.player.id),
    ]);
    return NextResponse.json({ pending, outgoing }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        pending: [],
        error: error instanceof Error ? error.message : "Unable to load invites.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}


