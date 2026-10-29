#!/usr/bin/env node
// Back to a clean starting state between takes: main at demo-start, no feature/bugfix branches
// (local or remote), no PRs, no runtime state, a fresh SQLite database, and the current mode re-applied.
//   node scripts/demo-reset.mjs [--all]     (--all also deletes the snapshots in .acme/runs)
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applyMode } from "./demo-mode.mjs";
import { configuredRemoteDir, currentMode, fail, git, refuseInsideAgent, repoRoot, run, step, tryGit } from "./lib/common.mjs";

export function resetDemo({ all = false, quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  const mode = currentMode();
  const start = tryGit(["rev-parse", "--verify", "demo-start^{commit}"]);
  if (!start) fail("Tag demo-start is missing. Run node scripts/setup.mjs first.");
  const remote = configuredRemoteDir();
  const exec = quiet ? (command, args) => git(args) : run;

  if (!quiet) step("Resetting the working copy to demo-start");
  exec("git", ["switch", "--force", "--quiet", "main"]);
  exec("git", ["reset", "--hard", "--quiet", start]);
  // Keep dependencies and build output; everything else that is ignored or untracked goes.
  exec("git", ["clean", "-fdxq", "-e", ".acme/runs", "-e", "node_modules", "-e", "bin", "-e", "obj", "-e", "dist", "-e", ".angular", "-e", ".claude/settings.local.json"]);

  if (!quiet) step("Removing feature and bugfix branches, locally and on the remote");
  const branchesIn = (gitDirArgs) =>
    (tryGit([...gitDirArgs, "for-each-ref", "--format=%(refname:short)", "refs/heads/feature", "refs/heads/bugfix"]) ?? "").split("\n").filter(Boolean);
  for (const branch of branchesIn([])) exec("git", ["branch", "--quiet", "-D", branch]);
  // Admin path on the bare repository: no receive hooks run.
  for (const branch of branchesIn(["--git-dir", remote])) exec("git", ["--git-dir", remote, "branch", "--quiet", "-D", branch]);
  exec("git", ["--git-dir", remote, "update-ref", "refs/heads/main", start]);
  exec("git", ["fetch", "--quiet", "--prune", "origin"]);

  if (!quiet) step("Clearing pull requests and runtime state");
  rmSync(join(remote, "acme-prs"), { recursive: true, force: true });
  for (const dir of ["out", "audit", "state", "debug"]) rmSync(join(repoRoot, ".acme", dir), { recursive: true, force: true });
  if (all) rmSync(join(repoRoot, ".acme", "runs"), { recursive: true, force: true });
  log(`  ${all ? "deleted" : "kept"} .acme/runs${all ? "" : " (use --all to delete snapshots)"}`);

  applyMode(mode);
  const left = readdirSync(join(repoRoot, ".acme")).join(", ");
  log(`\n✔ Reset complete: main at demo-start (${start.slice(0, 7)}), mode "${mode}", .acme contains: ${left}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  refuseInsideAgent();
  resetDemo({ all: process.argv.includes("--all") });
}
