import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createPullRequest, PullRequestStore, remoteDir } from "../dist/core/pull-requests.js";
import { tempRepo, withRemote } from "./helpers.mjs";

const BRANCH = "feature/4821-export-invoices-csv";
const input = {
  workItemId: 4821,
  sourceBranch: BRANCH,
  title: "Export invoices as CSV",
  summary: "Adds GET /api/invoices/export.csv.",
  changes: ["InvoiceExportEndpoints.cs", "Integration tests"],
  testEvidence: "dotnet test --solution src/backend: 38 passed, 0 failed",
  risk: "low",
};

function repoWithRemote() {
  const root = tempRepo();
  return { root, remote: withRemote(root, [BRANCH]) };
}

test("main is rejected as source branch", () => {
  const { root } = repoWithRemote();
  assert.throws(() => createPullRequest(root, { ...input, sourceBranch: "main" }), /must not be main/);
  assert.throws(() => createPullRequest(root, { ...input, sourceBranch: "refs/heads/main" }), /must not be main/);
});

test("an unknown work item is rejected", () => {
  const { root } = repoWithRemote();
  assert.throws(() => createPullRequest(root, { ...input, workItemId: 9999 }), /Work item 9999 not found/);
});

test("empty test evidence is rejected", () => {
  const { root } = repoWithRemote();
  assert.throws(() => createPullRequest(root, { ...input, testEvidence: "  " }), /testEvidence is empty/);
});

test("a branch that is not on the remote is rejected", () => {
  const { root } = repoWithRemote();
  assert.throws(
    () => createPullRequest(root, { ...input, sourceBranch: "feature/4821-not-pushed" }),
    /does not exist on the remote\. Push it first: git push -u origin feature\/4821-not-pushed/,
  );
});

test("a valid PR is rendered from the template and stored next to the remote", () => {
  const { root, remote } = repoWithRemote();
  const pr = createPullRequest(root, input);
  assert.equal(pr.prId, 1);
  assert.equal(pr.url, "https://dev.acme.example/acme/invoices/pullrequest/1");
  assert.equal(pr.title, "AB#4821: Export invoices as CSV");
  assert.equal(pr.targetBranch, "main");
  for (const heading of ["## Summary", "## Work item", "## Changes", "## Test evidence", "## Risk"]) {
    assert.ok(pr.description.includes(heading), heading);
  }
  assert.match(pr.description, /AB#4821: Export invoices as CSV/);
  assert.match(pr.description, /- Integration tests/);
  assert.doesNotMatch(pr.description, /\{\{/);
  assert.deepEqual(JSON.parse(readFileSync(join(remote, "acme-prs", "1.json"), "utf8")), pr);

  const second = createPullRequest(root, { ...input, title: "AB#4821: Second" });
  assert.equal(second.prId, 2);
  assert.equal(second.title, "AB#4821: Second");
});

test("comments are appended to the stored PR", () => {
  const { root, remote } = repoWithRemote();
  createPullRequest(root, input);
  const store = new PullRequestStore(remoteDir(root));
  assert.equal(store.addComment(1, "Ready for review"), 1);
  assert.deepEqual(store.get(1).comments, [{ id: 1, text: "Ready for review" }]);
  assert.throws(() => store.addComment(7, "x"), /Pull request 7 not found/);
  assert.ok(existsSync(join(remote, "acme-prs", "1.json")));
});

test("no origin remote gives a clear error", () => {
  assert.throws(() => remoteDir(tempRepo()), /No git remote 'origin'/);
});
