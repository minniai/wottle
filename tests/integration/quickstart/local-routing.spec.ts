import { describe, expect, test, vi } from "vitest";

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chmod } from "node:fs/promises";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(__dirname, "../../..");
const QUICKSTART_SCRIPT = resolve(REPO_ROOT, "scripts/supabase/quickstart.sh");

async function createSupabaseStub(jsonPath: string) {
  const dir = await mkdtemp(join(tmpdir(), "supabase-stub-"));
  const binaryPath = join(dir, "supabase");
  const script = `#!/usr/bin/env bash
set -euo pipefail
command="\${1:-}"
shift || true
case "$command" in
  "--version")
    echo "Supabase CLI version 2.0.0"
    ;;
  "start")
    echo '{"event":"stub.supabase.start"}'
    ;;
  "status")
    if [[ "\${1:-}" == "--output" && "\${2:-}" == "json" ]]; then
      cat "${jsonPath}"
    else
      echo "All services running"
    fi
    ;;
  *)
    echo "stub:\${command}"
    ;;
esac
`;
  await writeFile(binaryPath, script, "utf8");
  await chmod(binaryPath, 0o755);
  return { binaryPath };
}

const STATUS_FIXTURE = JSON.stringify(
  {
    status: {
      services: {
        api: {
          url: "http://localhost:54321",
        },
      },
      credentials: {
        apiUrl: "http://localhost:54321",
        anonKey: "anon-anon-anon",
        serviceRoleKey: "service-role-key",
      },
    },
  },
  null,
  2
);

vi.setConfig({ testTimeout: 30_000 });

describe("quickstart env routing guard", () => {
  test("ensures env file points to local Supabase instance", async () => {
    const statusFile = join(await mkdtemp(join(tmpdir(), "status-")), "status.json");
    await writeFile(statusFile, STATUS_FIXTURE, "utf8");
    const { binaryPath } = await createSupabaseStub(statusFile);
    const envDir = await mkdtemp(join(tmpdir(), "env-"));
    const envFile = join(envDir, ".env.local.test");

    await writeFile(
      envFile,
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY=old-key",
        "SUPABASE_ANON_KEY=old-anon",
      ].join("\n"),
      "utf8"
    );

    await execFileAsync("bash", [QUICKSTART_SCRIPT], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        SUPABASE_BIN: binaryPath,
        SUPABASE_ACCESS_TOKEN: "token",
        QUICKSTART_MATCH_ID: "test-match",
        QUICKSTART_ENV_FILE: envFile,
        QUICKSTART_DISABLE_STOP: "1",
        QUICKSTART_SKIP_DOCKER_CHECK: "1",
        QUICKSTART_DRY_RUN: "1",
        NODE_OPTIONS: "--experimental-fetch",
      },
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const contents = await readFile(envFile, "utf8");
    const lines = Object.fromEntries(
      contents
        .trim()
        .split("\n")
        .map((line) => line.split("=") as [string, string])
    );

    expect(lines["NEXT_PUBLIC_SUPABASE_URL"]).toBe("http://localhost:54321");
    expect(lines["SUPABASE_SERVICE_ROLE_KEY"]).toBe("service-role-key");
    expect(lines["SUPABASE_ANON_KEY"]).toBe("anon-anon-anon");
  });
});

