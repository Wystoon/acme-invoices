// Runs a hook the way Claude Code does: JSON on stdin, exit code and stderr/stdout back.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const hooksDir = join(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = join(hooksDir, "..", "..");

export function runHook(script, input, { root, env = {} } = {}) {
  const stdin = typeof input === "string" ? input : JSON.stringify({ cwd: root, ...input });
  const started = performance.now();
  const result = spawnSync(process.execPath, [join(hooksDir, script)], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ACME_HOOK_DEBUG: "0", ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, ms: performance.now() - started };
}

export function tempDir(prefix = "acme-hooks-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** A git repository on `branch` with one commit, optionally with an origin remote folder. */
export function tempRepo({ branch = "main", origin } = {}) {
  const root = tempDir();
  git(root, ["init", "--quiet", "-b", "main"]);
  writeFile(root, "README.md", "demo\n");
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "init"]);
  if (branch !== "main") git(root, ["switch", "--quiet", "-c", branch]);
  if (origin) git(root, ["remote", "add", "origin", origin]);
  return root;
}

export function writeFile(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

export function git(root, args) {
  return execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@acme.example", ...args], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}
