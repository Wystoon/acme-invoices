#!/usr/bin/env node
// Live demo preparation, run once from a plain terminal before the session:
// resets the demo clone (snapshots in .acme/runs included), switches to after mode, prepares clip 2, checks
// that the MCP server is built, and prints the three windows to open. Safe to run again: every run starts
// from demo-start.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { applyMode } from "./demo-mode.mjs";
import { resetDemo } from "./demo-reset.mjs";
import { currentMode, fail, git, refuseInsideAgent, repoRoot, run, step } from "./lib/common.mjs";

refuseInsideAgent();

resetDemo({ all: true });
if (currentMode() !== "after") applyMode("after");

step("Preparing clip 2");
run(process.execPath, [join("scripts", "prepare-clip2.mjs")]);

step("Checking the MCP server build");
const mcpDir = join(repoRoot, "tools", "acme-mcp");
const stale = sourceFiles(join(mcpDir, "src")).filter((source) => {
  const built = join(mcpDir, "dist", relative(join(mcpDir, "src"), source).replace(/\.ts$/, ".js"));
  return !existsSync(built) || statSync(built).mtimeMs < statSync(source).mtimeMs;
});
if (stale.length > 0) {
  fail(`The MCP server build is missing or older than ${relative(repoRoot, stale[0])}. Run npm run build --prefix tools/acme-mcp, then this script again.`);
}
console.log("  tools/acme-mcp/dist is up to date");

const ahead = git(["rev-list", "--count", "origin/main..main"]);
console.log(`\n✔ Ready for the live demo: mode "${currentMode()}", local main ${ahead} commit(s) ahead of origin/main, .acme/runs empty.`);
console.log(`
Open three windows in ${repoRoot} (start the Claude Code ones now, after this script):
  1. A plain terminal                        end of step 3: level 7, a push to main the server rejects
  2. claude-demo                             step 1: levels 4, 5 and 3, the coordinator
  3. claude-demo --agent acme-implementer    step 3: level 6, the implementer
  Steps 2 and 4 are recorded clips (clips 9 and 10); step 5 is a sentence.`);

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : [],
  );
}
