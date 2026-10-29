#!/usr/bin/env node
// SessionStart hook (matcher "startup"): a few facts added to the context by code, not by prose.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readInput, repoRoot } from "./lib/hook-io.mjs";

const root = repoRoot(readInput());
const mode = read(() => readFileSync(join(root, ".acme", "state", "mode"), "utf8").trim()) ?? "unknown";
const branch =
  read(() => execFileSync("git", ["symbolic-ref", "--short", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()) ??
  "detached";

process.stdout.write(
  `Acme demo mode: ${mode}. Current branch: ${branch}.\n` +
    "Work item context files are written to .acme/out/<id>/context.md by the acme MCP server.\n",
);

function read(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}
