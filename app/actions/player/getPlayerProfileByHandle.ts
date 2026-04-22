"use server";

import "server-only";
import { z } from "zod";

import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import type { GetPlayerProfileResult } from "@/app/actions/player/getPlayerProfile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const handleSchema = z
  .string()
  .trim()
  .min(3, "Handle must be at least 3 characters.")
  .max(24, "Handle must be fewer than 25 characters.")
  .regex(
    /^[A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö0-9_-]+$/,
    "Invalid handle characters.",
  );

export async function getPlayerProfileByHandle(
  handle: string,
): Promise<GetPlayerProfileResult> {
  const parsed = handleSchema.safeParse(handle);
  if (!parsed.success) {
    return { status: "error", error: "Invalid handle." };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("username", parsed.data.toLowerCase())
    .maybeSingle();

  if (error) {
    return { status: "error", error: "Lookup failed." };
  }
  if (!data) {
    return { status: "not_found" };
  }

  return getPlayerProfile(data.id);
}
