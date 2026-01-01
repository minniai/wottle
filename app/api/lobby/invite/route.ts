import { NextResponse } from "next/server";

import {
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
    const result = await sendDirectInvite(supabase, {
      senderId: session.player.id,
      recipientId,
      ttlSeconds: TTL_SECONDS,
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
    const pending = await listPendingInvites(
      supabase,
      session.player.id,
      TTL_SECONDS
    );
    return NextResponse.json({ pending }, { headers: NO_CACHE_HEADERS });
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


