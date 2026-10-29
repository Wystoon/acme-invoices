import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runHook, tempRepo, writeFile } from "./helpers.mjs";

function audit(root, input) {
  const result = runHook("audit.mjs", { session_id: "session-1", hook_event_name: "PostToolUse", ...input }, { root });
  assert.equal(result.status, 0);
  const lines = readFileSync(join(root, ".acme", "audit", "session-1.jsonl"), "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1));
}

test("audit: one line per tool call, with the target that matters", () => {
  const root = tempRepo();
  const read = audit(root, { agent_type: "acme-implementer", tool_name: "Read", tool_use_id: "t1", tool_input: { file_path: join(root, "src/backend/Invoice.cs") } });
  assert.deepEqual(
    { ...read, ts: undefined },
    { ts: undefined, event: "PostToolUse", session_id: "session-1", agent_type: "acme-implementer", tool_name: "Read", tool_use_id: "t1", target: "src/backend/Invoice.cs" },
  );
  const failed = audit(root, { hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: { command: "grep -rn PASSWORD ." } });
  assert.equal(failed.event, "PostToolUseFailure");
  assert.match(read.ts, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(audit(root, { tool_name: "Bash", tool_input: { command: "x".repeat(300) } }).target.length, 200);
  assert.equal(audit(root, { tool_name: "PowerShell", tool_input: { command: "Get-ChildItem src" } }).target, "Get-ChildItem src");
  assert.equal(audit(root, { tool_name: "mcp__acme__get_work_item_context", tool_input: { workItemId: 4821 } }).target, 4821);
  assert.equal(audit(root, { tool_name: "mcp__acme__post_pr_comment", tool_input: { prId: 3, text: "hi" } }).target, 3);
  assert.equal(audit(root, { tool_name: "Agent", tool_input: { subagent_type: "acme-context" } }).target, "acme-context");

  const lines = readFileSync(join(root, ".acme", "audit", "session-1.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 7);
});

test("audit never blocks, even on garbage input", () => {
  const result = runHook("audit.mjs", "not json", { root: tempRepo() });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
});

test("session-start adds the mode, the branch and where context files are", () => {
  const root = tempRepo({ branch: "main" });
  writeFile(root, ".acme/state/mode", "after\n");
  const result = runHook("session-start.mjs", { hook_event_name: "SessionStart", source: "startup" }, { root });
  assert.equal(result.status, 0);
  assert.equal(
    result.stdout,
    "Acme demo mode: after. Current branch: main.\nWork item context files are written to .acme/out/<id>/context.md by the acme MCP server.\n",
  );
  assert.ok(result.stdout.length < 300);
});
