// setup.mjs on a normal clone and in a CI checkout, and the server-side policy it installs (pre-receive).
// Each test runs setup on a throwaway repository that holds a copy of scripts/, without installing
// dependencies (ACME_SETUP_SKIP_INSTALL=1).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { git, repoRoot, tempDir, writeFile } from "../../tools/hooks/test/helpers.mjs";

/** A repository with this repository's scripts/ and .gitignore, one commit on main. */
function fixtureRepo() {
  const root = tempDir("acme-setup-");
  cpSync(join(repoRoot, "scripts"), join(root, "scripts"), { recursive: true });
  cpSync(join(repoRoot, ".gitignore"), join(root, ".gitignore"));
  git(root, ["init", "--quiet", "-b", "main"]);
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "init"]);
  return root;
}

function setup(root, { ci = false } = {}) {
  const remote = join(tempDir("acme-remote-"), "acme-remote.git");
  const env = { ...process.env, ACME_SETUP_SKIP_INSTALL: "1", ACME_REMOTE_DIR: remote, CI: ci ? "true" : "" };
  delete env.CLAUDECODE;
  delete env.CLAUDE_PROJECT_DIR;
  const result = spawnSync(process.execPath, [join(root, "scripts", "setup.mjs")], { cwd: root, encoding: "utf8", env });
  return { status: result.status, output: `${result.stdout}${result.stderr}`, remote };
}

/** git push with its exit code and output; the remote's hook output arrives on stderr. */
function push(root, args) {
  const result = spawnSync("git", ["push", ...args], { cwd: root, encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

test("a normal clone: the remote gets main and the policy, main tracks it, demo-start marks HEAD", () => {
  const root = fixtureRepo();
  const { status, output, remote } = setup(root);
  assert.equal(status, 0, output);
  const head = git(root, ["rev-parse", "HEAD"]);
  assert.equal(git(root, ["--git-dir", remote, "rev-parse", "refs/heads/main"]), head);
  assert.equal(git(root, ["rev-parse", "--abbrev-ref", "main@{upstream}"]), "origin/main");
  assert.equal(git(root, ["rev-parse", "demo-start^{commit}"]), head);
});

test("the installed pre-receive hook rejects a push to main and accepts a feature branch (node runs it on every OS)", () => {
  const root = fixtureRepo();
  const { status, output } = setup(root);
  assert.equal(status, 0, output);
  writeFile(root, "notes.md", "a change\n");
  git(root, ["add", "notes.md"]);
  git(root, ["commit", "--quiet", "-m", "AB#4821: Add notes"]);

  const toMain = push(root, ["origin", "HEAD:main"]);
  assert.notEqual(toMain.status, 0);
  assert.match(toMain.stderr, /\[acme policy\] Direct pushes to main are rejected\./);
  assert.match(toMain.stderr, /pre-receive hook declined/);

  const toFeature = push(root, ["origin", "HEAD:refs/heads/feature/4821-notes"]);
  assert.equal(toFeature.status, 0, toFeature.stderr);
});

test("a CI checkout (shallow, detached HEAD, no local main) is set up when CI=true", () => {
  const source = fixtureRepo();
  const root = join(tempDir("acme-ci-"), "checkout");
  git(source, ["clone", "--quiet", "--depth", "1", pathToFileURL(source).href, root]);
  git(root, ["switch", "--quiet", "--detach"]);
  git(root, ["branch", "--quiet", "-D", "main"]);

  const { status, output, remote } = setup(root, { ci: true });
  assert.equal(status, 0, output);
  assert.equal(git(root, ["symbolic-ref", "--short", "HEAD"]), "main");
  assert.equal(git(root, ["--git-dir", remote, "rev-parse", "refs/heads/main"]), git(root, ["rev-parse", "HEAD"]));
});

test("the main-branch check still holds: a detached HEAD outside CI, or another branch in CI, is refused", () => {
  const detached = fixtureRepo();
  git(detached, ["switch", "--quiet", "--detach"]);
  const outsideCi = setup(detached);
  assert.equal(outsideCi.status, 1);
  assert.match(outsideCi.output, /Run setup on the main branch\./);

  const feature = fixtureRepo();
  git(feature, ["switch", "--quiet", "-c", "feature/4821-x"]);
  const inCi = setup(feature, { ci: true });
  assert.equal(inCi.status, 1);
  assert.match(inCi.output, /Run setup on the main branch\./);
});
