#!/usr/bin/env node
// Keeps a copy of a work item's context files so two runs can be compared (clip 3).
//   node scripts/snapshot-input.mjs <workItemId> <label>   copies .acme/out/<id>/ to .acme/runs/<label>/<id>/
import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fail, repoRoot } from "./lib/common.mjs";

const [id, label] = process.argv.slice(2);
if (!/^\d+$/.test(id ?? "") || !/^[\w.-]+$/.test(label ?? "")) {
  fail("Usage: node scripts/snapshot-input.mjs <workItemId> <label>   (label: letters, digits, . _ -)");
}
const source = join(repoRoot, ".acme", "out", id);
if (!existsSync(source)) fail(`No context files in .acme/out/${id}. Ask the agent to start work item ${id} first.`);

const target = join(repoRoot, ".acme", "runs", label, id);
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Copied .acme/out/${id}/ to .acme/runs/${label}/${id}/ (${readdirSync(target).join(", ")})`);

// Suggest the most recent other snapshot as the comparison.
const runsDir = join(repoRoot, ".acme", "runs");
const others = readdirSync(runsDir)
  .filter((name) => name !== label && name !== "repeat")
  .sort((a, b) => statSync(join(runsDir, b)).mtimeMs - statSync(join(runsDir, a)).mtimeMs);
const other = others[0] ?? "<other-label>";
console.log(`Compare two runs:\n  git diff --no-index .acme/runs/${other} .acme/runs/${label}\n  echo $?    # 0 means identical`);
