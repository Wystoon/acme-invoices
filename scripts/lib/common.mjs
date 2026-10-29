// Shared helpers for scripts/*.mjs (and the hooks that run npm): run commands visibly, talk to git,
// find the demo remote.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Programs that are .cmd shims on Windows (npm installs them that way). Node starts a .cmd only through a shell.
const WINDOWS_SHIMS = new Set(["npm", "npx", "claude"]);
// Arguments that cmd.exe passes through unchanged: no spaces, quotes, %, ^, &, |, <, > or parentheses.
const PLAIN_ARGUMENT = /^[\w@+=:,./\\-]+$/;

/**
 * spawnSync that also starts npm, npx and claude on Windows. There they run through cmd.exe, with a command
 * line built only from plain arguments; an argument that would need quoting is refused instead of escaped.
 */
export function spawnProgram(command, args, options = {}) {
  if (process.platform !== "win32" || !WINDOWS_SHIMS.has(command)) return spawnSync(command, args, options);
  const unsafe = args.find((arg) => !PLAIN_ARGUMENT.test(arg));
  if (unsafe !== undefined) throw new Error(`${command}: the argument ${JSON.stringify(unsafe)} cannot be passed through cmd.exe unquoted`);
  return spawnSync([command, ...args].join(" "), { ...options, shell: true });
}

export function step(message) {
  console.log(`\n▶ ${message}`);
}

export function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

/** Runs a command with inherited output; exits with a clear message when it fails. */
export function run(command, args, { cwd = repoRoot, env } = {}) {
  console.log(`  $ ${[command, ...args].join(" ")}`);
  const result = spawnProgram(command, args, { cwd, stdio: "inherit", env: env ? { ...process.env, ...env } : process.env });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
}

/** Runs git and returns its trimmed output (throws on failure). */
export function git(args, { cwd = repoRoot } = {}) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function tryGit(args, options) {
  try {
    return git(args, options);
  } catch {
    return null;
  }
}

/**
 * These scripts change git state and agent configuration, so they must not run inside a Claude Code session.
 * Claude Code sets CLAUDECODE for the commands its shell tools run, and CLAUDE_PROJECT_DIR for hooks and MCP servers.
 */
export function refuseInsideAgent() {
  if (process.env.CLAUDECODE || process.env.CLAUDE_PROJECT_DIR) {
    fail("Run this script from a normal terminal, not from inside a Claude Code session.");
  }
}

/** The remote's folder: ACME_REMOTE_DIR, else <repo folder>-remote.git next to the repository. */
export function defaultRemoteDir() {
  const configured = process.env.ACME_REMOTE_DIR;
  if (configured) return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  return join(dirname(repoRoot), `${basename(repoRoot)}-remote.git`);
}

/** The remote as configured in git (the source of truth after setup). */
export function configuredRemoteDir() {
  const url = tryGit(["config", "--get", "remote.origin.url"]);
  if (!url) fail("No git remote 'origin'. Run node scripts/setup.mjs first.");
  const path = url.replace(/^file:\/\//, "");
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

export function currentMode() {
  const file = join(repoRoot, ".acme", "state", "mode");
  return existsSync(file) ? readFileSync(file, "utf8").trim() : "none";
}
