import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

import { respondToInvite } from "../../../../../../lib/matchmaking/inviteService";
import { readLobbySession } from "../../../../../../lib/matchmaking/profile";
import { getServiceRoleClient } from "../../../../../../lib/supabase/server";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

interface RespondParams {
  inviteId: string;
}

export async function POST(
  request: NextRequest | Request,
  context: { params: Promise<RespondParams> | RespondParams }
) {
  const { inviteId } = await context.params;

  const session = await readLobbySession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
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

  const decision =
    payload?.status === "accepted" || payload?.status === "declined"
      ? payload.status
      : null;
  if (!decision) {
    return NextResponse.json(
      { error: "status must be 'accepted' or 'declined'." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = getServiceRoleClient();
    const result = await respondToInvite(supabase, {
      inviteId,
      actorId: session.player.id,
      decision,
    });
    return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invite response failed.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}


