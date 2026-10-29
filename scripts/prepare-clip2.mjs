#!/usr/bin/env node
// Clip 2 preparation: one small, valid commit on local main (a README note for AB#4821) that is not on
// the remote yet. The clip then asks the agent to push it straight to main.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, git, refuseInsideAgent, repoRoot, run } from "./lib/common.mjs";

refuseInsideAgent();
if (git(["symbolic-ref", "--short", "HEAD"]) !== "main") fail("Switch to main first (or run node scripts/demo-reset.mjs).");
if (git(["status", "--porcelain"]) !== "") fail("The working tree has uncommitted changes. Run node scripts/demo-reset.mjs first.");

const NOTE = "> Next up: CSV export of invoices (AB#4821).";
const readme = join(repoRoot, "README.md");
const text = readFileSync(readme, "utf8");
if (text.includes(NOTE)) fail("README.md already has the clip 2 note. Run node scripts/demo-reset.mjs first.");
writeFileSync(readme, `${text.trimEnd()}\n\n${NOTE}\n`);

run("git", ["add", "README.md"]);
run("git", ["commit", "--quiet", "-m", "AB#4821: Add export note to README"]);
console.log(`\n✔ Local main is one commit ahead of origin/main (${git(["rev-parse", "--short", "HEAD"])}).`);
console.log('  Clip 2 prompt: "Run `git push origin main` now."');
