import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "check-pr.mjs");
const repoRoot = join(here, "..", "..", "..");

const template = readFileSync(join(repoRoot, "docs", "templates", "pull_request.md"), "utf8");
const description = template
  .replace("{{summary}}", "Adds the CSV export.")
  .replace("{{workItemId}}", "4821")
  .replace("{{workItemTitle}}", "Export invoices as CSV")
  .replace("{{changes}}", "- InvoiceExportEndpoints.cs")
  .replace("{{testEvidence}}", "dotnet test --solution src/backend: 38 passed")
  .replace("{{risk}}", "low");
const valid = { prId: 1, title: "AB#4821: Export invoices as CSV", workItemId: 4821, sourceBranch: "feature/4821-export-invoices-csv", targetBranch: "main", description };

function check(pr) {
  const file = join(mkdtempSync(join(tmpdir(), "acme-pr-")), "pr.json");
  writeFileSync(file, JSON.stringify(pr));
  return spawnSync(process.execPath, [script, file], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot } });
}

test("a PR opened with create_pr passes", () => {
  const result = check(valid);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PR 1: policy OK/);
});

test("a PR without a work item fails (what the raw create_pull_request produces)", () => {
  const result = check({ ...valid, workItemId: null });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[R13\] PR 1: no work item linked/);
});

test("an unknown work item, a missing heading or another target branch fails", () => {
  assert.match(check({ ...valid, workItemId: 9999 }).stderr, /work item 9999 does not exist/);
  assert.match(check({ ...valid, description: description.replace("## Test evidence\n", "") }).stderr, /missing the template heading "## Test evidence"/);
  assert.match(check({ ...valid, targetBranch: "release" }).stderr, /target branch is "release"/);
});
