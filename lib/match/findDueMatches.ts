import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * Matches still in progress whose shared clock has run out (spec 050,
 * contracts/settlement.md). The comparison is made by the database clock
 * inside `find_due_matches`, never by this instance's.
 */
export async function findDueMatches(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("find_due_matches");

  if (error) {
    throw new Error(`find_due_matches failed: ${error.message}`);
  }

  return (data as string[] | null) ?? [];
}
