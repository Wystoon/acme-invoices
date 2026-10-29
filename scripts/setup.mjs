#!/usr/bin/env node
// One-time setup after cloning: tools, dependencies, the bare remote with its server-side policy,
// the demo-start tag, and mode "none". Safe to run again.
//   ACME_REMOTE_DIR=<path> node scripts/setup.mjs     (default: <repo folder>-remote.git next to the repo)
// In a CI checkout (CI=true and a detached HEAD, e.g. a pull request's merge commit) it first creates
// main at HEAD; everywhere else it must run on main. ACME_SETUP_SKIP_INSTALL=1 skips the tools and
// dependencies (for setup's own tests).
import { chmodSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { applyMode } from "./demo-mode.mjs";
import { defaultRemoteDir, fail, git, refuseInsideAgent, repoRoot, run, spawnProgram, step, tryGit } from "./lib/common.mjs";

refuseInsideAgent();

step("Checking prerequisites");
const [nodeMajor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 22) fail(`Node ${process.versions.node} is too old; Node 22 or later is required.`);
const nodeVersionFile = join(repoRoot, ".node-version");
if (existsSync(nodeVersionFile)) {
  const wanted = readFileSync(nodeVersionFile, "utf8").trim().replace(/^v/, "");
  if (!process.versions.node.startsWith(wanted)) fail(`This repository uses Node ${wanted} (.node-version); you run ${process.versions.node}. Run \`fnm use\`.`);
}
console.log(`  node ${process.versions.node}`);
for (const [tool, args, required] of [["dotnet", ["--version"], true], ["git", ["--version"], true], ["claude", ["--version"], false]]) {
  const result = spawnProgram(tool, args, { encoding: "utf8" });
  if (result.status === 0) console.log(`  ${tool} ${result.stdout.trim()}`);
  else if (required) fail(`${tool} is not installed or not on PATH.`);
  else console.log(`  warning: ${tool} not found; install Claude Code to record the demo`);
}

step("Checking the repository");
if (!tryGit(["rev-parse", "--verify", "HEAD"])) fail("The repository has no commit yet. Commit the files first; setup never commits for you.");
if (git(["status", "--porcelain"]) !== "") fail("The working tree has uncommitted changes. Commit or stash them, then run setup again.");
const branch = tryGit(["symbolic-ref", "--short", "HEAD"]);
if (branch === null && process.env.CI === "true") {
  console.log("  CI checkout with a detached HEAD: creating main at HEAD");
  run("git", ["switch", "--quiet", "-C", "main"]);
} else if (branch !== "main") {
  fail("Run setup on the main branch.");
}

if (process.env.ACME_SETUP_SKIP_INSTALL === "1") {
  console.log("\n  ACME_SETUP_SKIP_INSTALL=1: skipping tools and dependencies");
} else {
  step("Installing tools and dependencies");
  const mcp = join("tools", "acme-mcp");
  run("dotnet", ["tool", "restore"]);
  run("dotnet", ["restore", join("src", "backend")]);
  run("npm", ["ci", "--prefix", join("src", "frontend")]);
  run("npm", ["ci", "--prefix", mcp]);
  run("npm", ["run", "build", "--prefix", mcp]);
}

const remote = defaultRemoteDir();
step(`Setting up the remote at ${remote}`);
if (!existsSync(remote)) run("git", ["init", "--bare", "--quiet", remote]);
if (git(["rev-parse", "--is-bare-repository"], { cwd: remote }) !== "true") fail(`${remote} exists but is not a bare git repository.`);
run("git", ["--git-dir", remote, "config", "receive.denyNonFastForwards", "true"]);
run("git", ["--git-dir", remote, "config", "receive.denyDeletes", "true"]);
const hook = join(remote, "hooks", "pre-receive");
copyFileSync(join(repoRoot, "scripts", "lib", "pre-receive.mjs"), hook);
// Windows has no execute bit: Git for Windows runs a hook whose first line is #! through its own sh.
chmodSync(hook, 0o755);
console.log("  installed hooks/pre-receive (rejects pushes to main, force-pushes and deletions)");
if (!tryGit(["--git-dir", remote, "rev-parse", "--verify", "refs/heads/main"])) {
  // Admin path: a fetch into the bare repository does not run receive hooks. --update-shallow accepts
  // the history of a shallow clone (git clone --depth 1, or a CI checkout).
  run("git", ["--git-dir", remote, "fetch", "--quiet", "--update-shallow", repoRoot, "main:main"]);
}
if (tryGit(["remote", "get-url", "origin"]) === null) run("git", ["remote", "add", "origin", remote]);
else run("git", ["remote", "set-url", "origin", remote]);
run("git", ["fetch", "--quiet", "origin"]);
run("git", ["branch", "--quiet", "--set-upstream-to=origin/main", "main"]);

step("Tagging the starting point");
const head = git(["rev-parse", "HEAD"]);
const tagged = tryGit(["rev-parse", "--verify", "demo-start^{commit}"]);
if (!tagged) run("git", ["tag", "demo-start", head]);
else if (tagged !== head) console.log(`  warning: demo-start already points at ${tagged.slice(0, 7)}; left unchanged`);
else console.log("  demo-start already points at HEAD");

applyMode("none");
console.log("\n✔ Setup complete. Next: node scripts/ci.mjs, then node scripts/demo-mode.mjs before|after.");
