// Shared helpers for the Acme Claude Code hooks. No dependencies, so every hook starts fast.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The hook input from stdin. Invalid JSON throws, which makes a fail-closed hook block. */
export function readInput() {
  const raw = readFileSync(0, "utf8");
  return raw.trim() === "" ? {} : JSON.parse(raw);
}

/** Claude Code sets CLAUDE_PROJECT_DIR for hooks; fall back to the session's working directory. */
export function repoRoot(input = {}) {
  return process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
}

/**
 * Blocks the action: "[<ruleId>] <message>" on stderr and exit code 2.
 * The model reads the message, so it must say what was blocked and what to do instead.
 */
export function block(ruleId, message) {
  process.stderr.write(`[${ruleId}] ${message}\n`);
  process.exit(2);
}

/** Appends to .acme/debug/hooks.jsonl when ACME_HOOK_DEBUG=1. */
export function debug(event, data, root = repoRoot()) {
  if (process.env.ACME_HOOK_DEBUG !== "1") return;
  const dir = join(root, ".acme", "debug");
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "hooks.jsonl"), JSON.stringify({ event, ...data }) + "\n");
}
