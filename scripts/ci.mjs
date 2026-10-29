#!/usr/bin/env node
// All CI steps, in order, failing fast. The same steps run in .github/workflows/ci.yml.
//   node scripts/ci.mjs          full run
//   node scripts/ci.mjs --fast   what merge-pr.mjs runs: format, Release build, backend tests,
//                                migration check, frontend lint (skips frontend build and tests,
//                                fixture/wiki checks, hook and MCP tests: platform code a PR does not change)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, spawnProgram } from "./lib/common.mjs";

const fast = process.argv.includes("--fast");
const [backend, frontend, mcp] = [join("src", "backend"), join("src", "frontend"), join("tools", "acme-mcp")];
const STEPS = [
  ["C# format (CSharpier)", "dotnet", ["csharpier", "check", "."], true],
  ["Backend build (Release, warnings as errors, banned APIs)", "dotnet", ["build", backend, "-c", "Release", "--nologo"], true],
  ["Backend tests", "dotnet", ["test", "--solution", backend, "-c", "Release", "--no-build"], true],
  ["Migration check (R10)", "node", [join("tools", "ci", "check-migrations.mjs")], true],
  ["Frontend lint", "npm", ["--prefix", frontend, "run", "lint"], true],
  ["Frontend format", "npm", ["--prefix", frontend, "run", "format:check"], false],
  ["Frontend tests", "npm", ["--prefix", frontend, "test"], false],
  ["Frontend build", "npm", ["--prefix", frontend, "run", "build"], false],
  ["Fixture generator is up to date", "node", [join("tools", "fixtures", "generate.mjs"), "--check"], false],
  ["Wiki size", "node", [join("tools", "ci", "check-wiki-size.mjs")], false],
  // node --test reads its arguments as glob patterns, where \ escapes: these stay in / form on every OS.
  ["Hook, CI-check and script tests", "node", ["--test", "tools/hooks/**/*.test.mjs", "tools/ci/**/*.test.mjs", "scripts/**/*.test.mjs"], false],
  ["MCP server tests", "npm", ["--prefix", mcp, "test"], false],
];

const nodeVersionFile = join(repoRoot, ".node-version");
if (existsSync(nodeVersionFile)) {
  const wanted = readFileSync(nodeVersionFile, "utf8").trim().replace(/^v/, "");
  if (!process.versions.node.startsWith(wanted)) {
    console.error(`✖ This repository uses Node ${wanted} (.node-version); you run ${process.versions.node}. Run \`fnm use\`.`);
    process.exit(1);
  }
}

const started = Date.now();
for (const [name, command, args, inFast] of STEPS) {
  if (fast && !inFast) continue;
  console.log(`\n▶ ${name}\n  $ ${[command, ...args].join(" ")}`);
  const stepStarted = Date.now();
  const result = spawnProgram(command, args, { cwd: repoRoot, stdio: "inherit", env: { ...process.env, CI: "true" } });
  if (result.status !== 0) {
    console.error(`\n✖ ${name} failed (exit code ${result.status ?? result.error?.message}).`);
    process.exit(1);
  }
  console.log(`  ✔ ${name} (${((Date.now() - stepStarted) / 1000).toFixed(1)} s)`);
}
console.log(`\n✔ CI ${fast ? "(fast) " : ""}passed in ${((Date.now() - started) / 1000).toFixed(0)} s`);
