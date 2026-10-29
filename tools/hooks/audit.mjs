#!/usr/bin/env node
// PostToolUse and PostToolUseFailure hook for every tool (rule R15): one JSON line per tool call in
// .acme/audit/<session_id>.jsonl, failed calls included. Written by code, not by the model describing
// itself. Never blocks: any error is swallowed.
import { appendFileSync, mkdirSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { readInput, repoRoot } from "./lib/hook-io.mjs";

try {
  const input = readInput();
  const root = repoRoot(input);
  const entry = {
    ts: new Date().toISOString(),
    event: input.hook_event_name ?? null,
    session_id: input.session_id ?? null,
    agent_type: input.agent_type ?? null,
    tool_name: input.tool_name ?? null,
    tool_use_id: input.tool_use_id ?? null,
    target: target(input.tool_name ?? "", input.tool_input ?? {}, root),
  };
  const dir = join(root, ".acme", "audit");
  mkdirSync(dir, { recursive: true });
  const file = String(input.session_id ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  appendFileSync(join(dir, `${file}.jsonl`), JSON.stringify(entry) + "\n");
} catch {
  // An audit failure must never stop the agent.
}
process.exit(0);

function target(tool, toolInput, root) {
  if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool) && typeof toolInput.file_path === "string") {
    const path = toolInput.file_path;
    const inside = isAbsolute(path) ? relative(root, path) : path;
    // relative() returns an absolute path for a file on another Windows drive.
    return inside.startsWith("..") || isAbsolute(inside) ? path : inside.split(sep).join("/");
  }
  if (tool === "Bash" || tool === "PowerShell") return String(toolInput.command ?? "").slice(0, 200);
  if (tool === "Agent" || tool === "Task") return toolInput.subagent_type ?? null;
  if (tool.startsWith("mcp__acme__")) return toolInput.workItemId ?? toolInput.prId ?? null;
  return null;
}
