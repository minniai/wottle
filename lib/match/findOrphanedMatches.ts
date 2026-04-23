import { getServiceRoleClient } from "@/lib/supabase/server";

export async function findOrphanedMatches(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("find_orphaned_matches");

  if (error) {
    throw new Error(`find_orphaned_matches failed: ${error.message}`);
  }

  return (data as string[] | null) ?? [];
}
