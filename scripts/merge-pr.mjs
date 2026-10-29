#!/usr/bin/env node
// The simulated "Complete pull request" button: PR policy check (R13), then CI on the PR's branch,
// then a fast-forward of the remote's main through the admin path. Refuses on red.
//   node scripts/merge-pr.mjs <prId>
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configuredRemoteDir, fail, git, refuseInsideAgent, repoRoot, run, step, tryGit } from "./lib/common.mjs";

refuseInsideAgent();
const prId = process.argv[2];
if (!/^\d+$/.test(prId ?? "")) fail("Usage: node scripts/merge-pr.mjs <prId>");

const remote = configuredRemoteDir();
const prFile = join(remote, "acme-prs", `${prId}.json`);
if (!existsSync(prFile)) fail(`Pull request ${prId} not found in ${join(remote, "acme-prs")}.`);
const pr = JSON.parse(readFileSync(prFile, "utf8"));
if (pr.status !== "active") fail(`Pull request ${prId} is ${pr.status}, not active.`);

step(`Pull request ${prId}: policy check`);
run("node", [join("tools", "ci", "check-pr.mjs"), prFile]);

if (git(["status", "--porcelain"]) !== "") fail("The working tree has uncommitted changes. Commit or stash them first.");
run("git", ["fetch", "--quiet", "origin"]);
const head = tryGit(["rev-parse", "--verify", `origin/${pr.sourceBranch}`]);
if (!head) fail(`Branch ${pr.sourceBranch} is not on the remote.`);
const main = git(["rev-parse", "origin/main"]);
if (spawnSync("git", ["merge-base", "--is-ancestor", main, head], { cwd: repoRoot }).status !== 0) {
  fail(`${pr.sourceBranch} does not contain the latest main. Merge main into the branch and push again.`);
}

step(`Pull request ${prId}: CI on ${pr.sourceBranch} (${head.slice(0, 7)})`);
const previous = tryGit(["symbolic-ref", "--short", "HEAD"]) ?? git(["rev-parse", "HEAD"]);
run("git", ["switch", "--quiet", "--detach", head]);
const ci = spawnSync("node", [join("scripts", "ci.mjs"), "--fast"], { cwd: repoRoot, stdio: "inherit" });
run("git", ["switch", "--quiet", previous]);
if (ci.status !== 0) fail(`CI failed on ${pr.sourceBranch}. Pull request ${prId} was not merged.`);

step(`Pull request ${prId}: fast-forwarding main to ${head.slice(0, 7)}`);
// Admin path: update-ref in the bare repository does not run the pre-receive hook.
run("git", ["--git-dir", remote, "update-ref", "refs/heads/main", head, main]);
writeFileSync(prFile, JSON.stringify({ ...pr, status: "completed", mergeCommit: head }, null, 2) + "\n");
run("git", ["fetch", "--quiet", "origin"]);
console.log(`\n✔ Pull request ${prId} completed: main is now ${head.slice(0, 7)}. Update your local main with: git switch main && git merge --ff-only origin/main`);
