import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOTS = ["app", "components"];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const FORBIDDEN_PATTERNS = [/SUPABASE_SERVICE_ROLE_KEY/, /service_role/];

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (FILE_EXTENSIONS.has(getExtension(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function getExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index) : "";
}

async function scan() {
  const offenses: { file: string; pattern: string }[] = [];

  for (const root of ROOTS) {
    const files = await collectFiles(root).catch(() => []);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          offenses.push({ file, pattern: pattern.source });
        }
      }
    }
  }

  if (offenses.length > 0) {
    console.error(
      JSON.stringify({
        event: "guard.no-service-role.failure",
        offenses,
        remediation:
          "Move service_role usage into server-only modules (e.g. lib/supabase/server.ts)",
      })
    );
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify({
        event: "guard.no-service-role.success",
        scannedRoots: ROOTS,
      })
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scan().catch((error) => {
    console.error(
      JSON.stringify({
        event: "guard.no-service-role.error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
    process.exitCode = 1;
  });
}

export { scan };
