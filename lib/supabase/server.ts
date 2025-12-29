import "./server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function ensureServerContext() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase service_role client must never run in the browser");
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createServiceRoleClient(): SupabaseClient {
  ensureServerContext();

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getServiceRoleClient(): SupabaseClient {
  ensureServerContext();

  if (!cachedClient) {
    cachedClient = createServiceRoleClient();
  }

  return cachedClient;
}
