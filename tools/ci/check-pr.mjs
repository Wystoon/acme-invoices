#!/usr/bin/env node
// PR policy check (rule R13, level 7), run by scripts/merge-pr.mjs before a PR is completed:
// the PR links an existing work item, its description has every heading of the PR template
// and mentions AB#<id>, and it targets main.
// Usage: node tools/ci/check-pr.mjs <pr-id | path/to/pr.json>
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argument = process.argv[2];
if (!argument) {
  console.error("Usage: node tools/ci/check-pr.mjs <pr-id | path/to/pr.json>");
  process.exit(2);
}

const file = /^\d+$/.test(argument) ? join(remoteDir(), "acme-prs", `${argument}.json`) : resolve(argument);
if (!existsSync(file)) {
  console.error(`[R13] Pull request file not found: ${file}`);
  process.exit(1);
}
const pr = JSON.parse(readFileSync(file, "utf8"));
const problems = checkPullRequest(pr);
for (const problem of problems) console.error(`[R13] PR ${pr.prId ?? "?"}: ${problem}`);
if (problems.length === 0) console.log(`PR ${pr.prId}: policy OK (AB#${pr.workItemId}, template complete, target main)`);
process.exit(problems.length === 0 ? 0 : 1);

function checkPullRequest(pr) {
  const problems = [];
  const description = String(pr.description ?? "");
  if (!Number.isInteger(pr.workItemId) || pr.workItemId <= 0) {
    problems.push("no work item linked (workItemId is missing). Open the PR with create_pr and the work item ID.");
  } else {
    if (!existsSync(join(root, "data", "ado", "workitems", `${pr.workItemId}.json`))) problems.push(`work item ${pr.workItemId} does not exist.`);
    if (!description.includes(`AB#${pr.workItemId}`)) problems.push(`the description does not mention AB#${pr.workItemId}.`);
  }
  const template = readFileSync(join(root, "docs", "templates", "pull_request.md"), "utf8");
  for (const heading of template.split("\n").filter((line) => line.startsWith("## "))) {
    if (!description.split("\n").includes(heading)) problems.push(`the description is missing the template heading "${heading}".`);
  }
  if (pr.targetBranch !== "main") problems.push(`target branch is "${pr.targetBranch}", expected "main".`);
  return problems;
}

function remoteDir() {
  const url = execFileSync("git", ["config", "--get", "remote.origin.url"], { cwd: root, encoding: "utf8" }).trim().replace(/^file:\/\//, "");
  return isAbsolute(url) ? url : resolve(root, url);
}
