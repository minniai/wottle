import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * Tables whose time to sit down has run out (spec 069 FR-015). The comparison
 * is made by the database clock inside `find_due_tables`, never by this instance's.
 */
export async function findDueTables(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("find_due_tables");

  if (error) {
    throw new Error(`find_due_tables failed: ${error.message}`);
  }

  return (data as string[] | null) ?? [];
}
