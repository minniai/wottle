vi.mock("server-only", () => ({}));
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const originalEnv = { ...process.env };
const originalWindow = globalThis.window;

function restoreEnv(key: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = originalEnv[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function loadSupabaseServerModule() {
  const supabase = await import("@supabase/supabase-js");
  const createClientMock = vi.mocked(supabase.createClient);
  createClientMock.mockReset();

  const serverModule = await import("../../../../lib/supabase/server");
  return { ...serverModule, createClientMock };
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock("server-only", () => ({}));
  vi.doMock("@supabase/supabase-js", () => ({
    createClient: vi.fn(),
  }));
  (globalThis as any).window = undefined;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

afterEach(() => {
  restoreEnv("NEXT_PUBLIC_SUPABASE_URL");
  restoreEnv("SUPABASE_SERVICE_ROLE_KEY");
  (globalThis as any).window = originalWindow;
});

describe("server-side Supabase client factories", () => {
  test("getServiceRoleClient caches the Supabase client instance", async () => {
    const { createClientMock, getServiceRoleClient } = await loadSupabaseServerModule();
    const clientInstance = { supabase: true } as const;
    createClientMock.mockReturnValue(clientInstance as never);

    const first = getServiceRoleClient();
    const second = getServiceRoleClient();

    expect(first).toBe(clientInstance);
    expect(second).toBe(clientInstance);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  test("getServiceRoleClient throws when invoked in a browser context", async () => {
    (globalThis as any).window = {} as Window & typeof globalThis;
    const { getServiceRoleClient } = await loadSupabaseServerModule();

    expect(() => getServiceRoleClient()).toThrow(
      /must never run in the browser/
    );
  });

  test("createServiceRoleClient returns a fresh client on each call", async () => {
    const { createClientMock, createServiceRoleClient } = await loadSupabaseServerModule();
    const firstClient = { id: "first" };
    const secondClient = { id: "second" };
    createClientMock
      .mockReturnValueOnce(firstClient as never)
      .mockReturnValueOnce(secondClient as never);

    const clientA = createServiceRoleClient();
    const clientB = createServiceRoleClient();

    expect(clientA).toBe(firstClient);
    expect(clientB).toBe(secondClient);
    expect(createClientMock).toHaveBeenCalledTimes(2);
  });

  test("both factories fail fast when required env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { getServiceRoleClient, createServiceRoleClient } = await loadSupabaseServerModule();

    expect(() => getServiceRoleClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => createServiceRoleClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

