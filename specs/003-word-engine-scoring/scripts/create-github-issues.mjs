#!/usr/bin/env node
/**
 * Create GitHub issues from specs/003-word-engine-scoring/issues-export.json
 * using the GitHub CLI (gh). Requires: gh auth login, repo minniai/wottle.
 *
 * Usage: node create-github-issues.mjs [--dry-run]
 *   --dry-run  Print titles and skip creating issues
 */

import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportPath = path.resolve(__dirname, "../issues-export.json");
const dryRun = process.argv.includes("--dry-run");

const data = JSON.parse(readFileSync(exportPath, "utf8"));
const repo = data.repo;
const issues = data.issues;

console.log(`Repo: ${repo}`);
console.log(`Issues to create: ${issues.length}`);
if (dryRun) console.log("(dry run — no issues will be created)\n");

for (const issue of issues) {
  const title = issue.title;
  const body = issue.body;
  const labels = issue.labels || [];

  if (dryRun) {
    console.log(`[${issue.id}] ${title}`);
    continue;
  }

  const args = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    title,
    "--body",
    body,
  ];
  if (labels.length) {
    for (const label of labels) {
      args.push("--label", label);
    }
  }

  const result = spawnSync("gh", args, {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error(`Failed [${issue.id}]: ${title}`);
    console.error(result.stderr || result.stdout);
    process.exitCode = 1;
  } else {
    const url = (result.stdout || "").trim();
    console.log(`Created [${issue.id}]: ${url}`);
  }
}

if (!dryRun && !process.exitCode) {
  console.log(`\nDone. Created ${issues.length} issues in ${repo}.`);
}
