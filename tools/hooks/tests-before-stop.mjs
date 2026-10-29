#!/usr/bin/env node
// Stop hook in the implementer's frontmatter, so it runs as SubagentStop (rule R9).
// When the branch changed anything under src/, the matching tests must pass before the implementer
// may finish. Otherwise it is sent back with the failing output.
//
// Loop guard: a counter per session and agent in .acme/state/stop-blocks/. While tests fail, the
// implementer is sent back up to 3 times (stop_hook_active is only logged, it never allows a red stop).
// After that it may stop, but loudly: a systemMessage for the human and a marker file in
// .acme/state/tests-failed/<agent_id>. Claude Code's own cap is 8 continuations.
// This hook makes finishing on red loud; CI in merge-pr makes merging on red impossible.
//
// ACME_STOP_TEST_CMD replaces the test commands with one Node.js script, run with node -e (for this hook's
// own tests; Node rather than a shell so they run the same on every OS).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnProgram } from "../../scripts/lib/common.mjs";
import { debug, readInput, repoRoot } from "./lib/hook-io.mjs";

const MAX_BLOCKS = 3;
const OUTPUT_LINES = 30;

const input = readInput();
const root = repoRoot(input);
const changed = changedPaths();
const commands = testCommands(changed);
if (commands.length === 0) process.exit(0);

const agent = safeName(input.agent_id ?? "main");
const counterFile = join(root, ".acme", "state", "stop-blocks", safeName(`${input.session_id ?? "session"}-${agent}`));
const failedFile = join(root, ".acme", "state", "tests-failed", agent);
const failure = firstFailure(commands);
debug("tests-before-stop", { commands: commands.map((c) => c.join(" ")), failed: failure !== null, stop_hook_active: input.stop_hook_active ?? null }, root);

if (failure === null) {
  rmSync(counterFile, { force: true });
  rmSync(failedFile, { force: true });
  process.exit(0);
}

const blocks = readCounter();
if (blocks >= MAX_BLOCKS) {
  rmSync(counterFile, { force: true });
  mkdirSync(join(root, ".acme", "state", "tests-failed"), { recursive: true });
  writeFileSync(failedFile, `$ ${failure.command}\n${failure.output}\n`);
  respond({ systemMessage: `[R9] Implementer stopped with failing tests after ${MAX_BLOCKS} attempts. Do not open a PR.` });
} else {
  mkdirSync(join(root, ".acme", "state", "stop-blocks"), { recursive: true });
  writeFileSync(counterFile, String(blocks + 1));
  respond({ decision: "block", reason: `[R9] Tests fail. Fix them before finishing.\n$ ${failure.command}\n${failure.output}` });
}

/** Uncommitted changes plus commits on this branch that main does not have. */
function changedPaths() {
  const paths = new Set();
  const status = git(["status", "--porcelain"]) ?? "";
  for (const line of status.split("\n")) if (line.length > 3) paths.add(line.slice(3).split(" -> ").at(-1));
  const base = git(["merge-base", "HEAD", "main"]);
  if (base) for (const path of (git(["diff", "--name-only", base, "HEAD"]) ?? "").split("\n")) if (path) paths.add(path);
  return [...paths];
}

function testCommands(paths) {
  if (!paths.some((path) => path.startsWith("src/"))) return [];
  if (process.env.ACME_STOP_TEST_CMD) return [[process.execPath, "-e", process.env.ACME_STOP_TEST_CMD]];
  // Paths from git use "/" on every OS; the commands get the OS's own separator.
  const commands = [];
  if (paths.some((path) => path.startsWith("src/backend/"))) commands.push(["dotnet", "test", "--solution", join("src", "backend")]);
  if (paths.some((path) => path.startsWith("src/frontend/"))) {
    const frontend = join("src", "frontend");
    commands.push(["npm", "--prefix", frontend, "run", "lint"], ["npm", "--prefix", frontend, "test"]);
  }
  return commands;
}

function firstFailure(list) {
  for (const [program, ...args] of list) {
    const result = spawnProgram(program, args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) {
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? result.error.message : ""}`;
      return { command: [program, ...args].join(" "), output: output.trimEnd().split("\n").slice(-OUTPUT_LINES).join("\n") };
    }
  }
  return null;
}

function git(args) {
  try {
    // trimEnd only: porcelain status lines can start with a space (" M file").
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
  } catch {
    return null;
  }
}

function readCounter() {
  try {
    return Number.parseInt(readFileSync(counterFile, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
}

function respond(output) {
  process.stdout.write(JSON.stringify(output) + "\n");
  process.exit(0);
}

function safeName(text) {
  return text.replace(/[^A-Za-z0-9_-]/g, "_");
}
