import { beforeEach, describe, expect, test } from "vitest";

import { runPreflight } from "../../../scripts/supabase/preflight";

const SUCCESS = Promise.resolve({ stdout: "", stderr: "" });
const FAILURE = (message: string) =>
  Promise.reject(Object.assign(new Error(message), { stderr: message }));

describe("runPreflight", () => {
  const baseEnv = { ...process.env };
  delete baseEnv.SUPABASE_ACCESS_TOKEN;
  delete baseEnv.QUICKSTART_SKIP_TOKEN_CHECK;

  beforeEach(() => {
    process.env = { ...baseEnv };
    delete process.env.SUPABASE_ACCESS_TOKEN;
    delete process.env.QUICKSTART_SKIP_TOKEN_CHECK;
  });

  test("fails when Docker is unavailable", async () => {
    await expect(
      runPreflight({
        env: { 
          SUPABASE_ACCESS_TOKEN: "token", 
          NODE_ENV: "test",
          QUICKSTART_SKIP_TOKEN_CHECK: "",
        },
        run: (command) => {
          if (command === "docker") {
            return FAILURE("docker unavailable");
          }
          return SUCCESS;
        },
      })
    ).rejects.toThrow(/docker/i);
  });

  test("fails when Supabase CLI is missing", async () => {
    await expect(
      runPreflight({
        env: { 
          SUPABASE_ACCESS_TOKEN: "token", 
          NODE_ENV: "test",
          QUICKSTART_SKIP_TOKEN_CHECK: "",
        },
        run: (command) => {
          if (command === "supabase") {
            return FAILURE("not found");
          }
          return SUCCESS;
        },
      })
    ).rejects.toThrow(/supabase cli/i);
  });

  test("fails when Supabase access token is missing", async () => {
    await expect(
      runPreflight({
        env: { 
          NODE_ENV: "test",
          QUICKSTART_SKIP_TOKEN_CHECK: "",
        },
        run: () => SUCCESS,
      })
    ).rejects.toThrow(/SUPABASE_ACCESS_TOKEN/i);
  });

  test("passes when all checks succeed", async () => {
    const result = await runPreflight({
      env: { 
        SUPABASE_ACCESS_TOKEN: "token", 
        NODE_ENV: "test",
        QUICKSTART_SKIP_TOKEN_CHECK: "",
      },
      run: () => SUCCESS,
    });

    expect(result.status).toBe("pass");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "docker", status: "pass" }),
        expect.objectContaining({ name: "supabaseCli", status: "pass" }),
        expect.objectContaining({ name: "supabaseAccessToken", status: "pass" }),
      ])
    );
  });

  test("passes when token check is skipped", async () => {
    const result = await runPreflight({
      env: { QUICKSTART_SKIP_TOKEN_CHECK: "1", NODE_ENV: "test" },
      run: () => SUCCESS,
    });

    expect(result.status).toBe("pass");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "docker", status: "pass" }),
        expect.objectContaining({ name: "supabaseCli", status: "pass" }),
        expect.objectContaining({
          name: "supabaseAccessToken",
          status: "pass",
          detail: "skipped for local development",
        }),
      ])
    );
  });
});

