#!/usr/bin/env node
// Summarises a Claude Code transcript: calls and result size per tool, then the ordered list of calls.
// Works with session transcripts (~/.claude/projects/<project>/<session>.jsonl) and with
// `claude -p --output-format stream-json` output. The format is internal and can change; anything
// unrecognised is skipped, and a file with no tool calls at all is reported as not recognised.
//   node scripts/inspect-transcript.mjs <file.jsonl>
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/inspect-transcript.mjs <transcript.jsonl>");
  process.exit(2);
}

const summary = summarize(readFileSync(file, "utf8"));
if (summary.calls.length === 0) {
  console.error("Format not recognized: no tool calls found in this file.");
  process.exit(1);
}

console.log(`${summary.calls.length} tool calls\n`);
console.log("calls  result chars  tool");
for (const [tool, stats] of [...summary.perTool].sort((a, b) => b[1].calls - a[1].calls)) {
  console.log(`${String(stats.calls).padStart(5)}  ${String(stats.resultChars).padStart(12)}  ${tool}`);
}
console.log("\nOrder of calls:");
summary.calls.forEach((call, index) => console.log(`${String(index + 1).padStart(3)}. ${call.subagent ? "  └ " : ""}${call.name} ${call.input}`));

function summarize(text) {
  const calls = [];
  const byId = new Map();
  const perTool = new Map();
  for (const line of text.split("\n")) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === "tool_use" && typeof part.name === "string") {
        const call = { name: part.name, input: JSON.stringify(part.input ?? {}).slice(0, 100), subagent: Boolean(entry.parent_tool_use_id) };
        calls.push(call);
        byId.set(part.id, call);
        const stats = perTool.get(part.name) ?? { calls: 0, resultChars: 0 };
        stats.calls += 1;
        perTool.set(part.name, stats);
      } else if (part?.type === "tool_result") {
        const call = byId.get(part.tool_use_id);
        if (call) perTool.get(call.name).resultChars += resultText(part.content).length;
      }
    }
  }
  return { calls, perTool };
}

function resultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  return "";
}
