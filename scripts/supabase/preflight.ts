import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PreflightCheck {
  name: string;
  status: "pass";
  detail?: string;
}

export interface PreflightResult {
  status: "pass";
  checks: PreflightCheck[];
}

type RunCommand = (
  command: string,
  args?: readonly string[],
  options?: { env?: NodeJS.ProcessEnv }
) => Promise<{ stdout: string; stderr: string }>;

export interface PreflightOptions {
  env?: NodeJS.ProcessEnv;
  run?: RunCommand;
}

const DEFAULT_RUN: RunCommand = async (command, args = [], options) => {
  const { stdout, stderr } = await execFileAsync(command, args, {
    env: options?.env,
  });
  return { stdout, stderr };
};

const DOCKER_CHECK: PreflightCheck = { name: "docker", status: "pass" };
const SUPABASE_CHECK: PreflightCheck = { name: "supabaseCli", status: "pass" };
const TOKEN_CHECK: PreflightCheck = { name: "supabaseAccessToken", status: "pass" };

export async function runPreflight(options: PreflightOptions = {}): Promise<PreflightResult> {
  const env = { ...process.env, ...options.env };
  const run = options.run ?? DEFAULT_RUN;
  const checks: PreflightCheck[] = [];

  const dockerCommand = env.DOCKER_BIN ?? "docker";
  const supabaseCommand = env.SUPABASE_BIN ?? "supabase";
  // Auto-skip Docker check when running inside act container (ACT=true is set by act)
  const isInsideAct = env.ACT === "true";
  const skipDocker = env.QUICKSTART_SKIP_DOCKER_CHECK === "1" || isInsideAct;

  if (!skipDocker) {
    try {
      await run(dockerCommand, ["info"], { env });
      checks.push(DOCKER_CHECK);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Docker daemon is not reachable";
      const hint = " (Hint: Set QUICKSTART_SKIP_DOCKER_CHECK=1 to skip this check)";
      throw new Error(`Docker prerequisite failed: ${message}${hint}`);
    }
  } else {
    const reason = isInsideAct ? "running inside act container" : "explicitly skipped";
    checks.push({ ...DOCKER_CHECK, detail: reason });
  }

  try {
    await run(supabaseCommand, ["--version"], { env });
    checks.push(SUPABASE_CHECK);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Supabase CLI is not installed";
    throw new Error(`Supabase CLI prerequisite failed: ${message}`);
  }

  const skipTokenCheck = env.QUICKSTART_SKIP_TOKEN_CHECK === "1";
  
  if (skipTokenCheck) {
    checks.push({ ...TOKEN_CHECK, detail: "skipped for local development" });
  } else {
    if (!env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN.trim().length === 0) {
      throw new Error("Missing SUPABASE_ACCESS_TOKEN environment variable for Supabase login");
    }
    checks.push(TOKEN_CHECK);
  }

  return {
    status: "pass",
    checks,
  };
}

function emit(event: string, payload: Record<string, unknown>) {
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  console.log(JSON.stringify(entry));
}

async function main() {
  try {
    const result = await runPreflight();
    emit("supabase.preflight.success", { checks: result.checks });
  } catch (error) {
    emit("supabase.preflight.failure", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

