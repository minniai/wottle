import { afterEach, describe, expect, test } from "vitest";

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
    if [[ "\${1:-}" == "--json" ]]; then
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

const CLEANUP: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (CLEANUP.length > 0) {
    const dispose = CLEANUP.pop();
    if (dispose) {
      await dispose();
    }
  }
});

describe("supabase quickstart script", () => {
  test("runs the automation and reports healthy status", async () => {
    const statusFile = join(await mkdtemp(join(tmpdir(), "status-")), "status.json");
    await writeFile(statusFile, STATUS_FIXTURE, "utf8");
    const { binaryPath } = await createSupabaseStub(statusFile);
    const envFile = join(await mkdtemp(join(tmpdir(), "env-")), ".env.local.test");

    const { stdout } = await execFileAsync("bash", [QUICKSTART_SCRIPT], {
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

    const jsonLines = stdout
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{") && line.endsWith("}"));

    expect(jsonLines.length).toBeGreaterThan(0);
    const summary = JSON.parse(jsonLines.at(-1) ?? "{}");
    expect(summary.event).toBe("supabase.quickstart.success");
    expect(summary.startupDurationMs).toBeGreaterThanOrEqual(0);
    expect(summary.seedDurationMs).toBeGreaterThanOrEqual(0);
    expect(summary.supabaseUrl).toBe("http://localhost:54321");
    expect(summary.matchId).toBe("test-match");
  });
});

