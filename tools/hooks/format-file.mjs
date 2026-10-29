#!/usr/bin/env node
// PostToolUse hook for Edit|Write in the implementer (rule R8): formats the file that was just written.
//   .cs                                         → dotnet csharpier format <file>
//   .ts .html .scss .json .md under src/frontend → prettier --write <file>
// Anything else is left alone. If the formatter fails, exit 2 shows its message to the model.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { block, debug, readInput, repoRoot } from "./lib/hook-io.mjs";

const FRONTEND_EXTENSIONS = new Set([".ts", ".html", ".scss", ".json", ".md"]);
const TIMEOUT_MS = 25_000;

const input = readInput();
const root = repoRoot(input);
const filePath = input.tool_input?.file_path;
if (typeof filePath !== "string" || filePath === "") process.exit(0);

const absolute = isAbsolute(filePath) ? filePath : resolve(root, filePath);
// relative() returns an absolute path for a file on another Windows drive.
const inside = relative(root, absolute);
if (inside.startsWith("..") || isAbsolute(inside) || !existsSync(absolute)) process.exit(0);
const path = inside.split(sep).join("/");

const extension = extname(path);
if (extension === ".cs") {
  run("dotnet", ["csharpier", "format", absolute], root);
} else if (path.startsWith("src/frontend/") && FRONTEND_EXTENSIONS.has(extension)) {
  const frontend = join(root, "src", "frontend");
  // Prettier's own script through node: node_modules/.bin/prettier is a .cmd shim on Windows.
  const prettier = join(frontend, "node_modules", "prettier", "bin", "prettier.cjs");
  if (!existsSync(prettier)) block("R8", `Cannot format ${path}: Prettier is not installed. Run npm --prefix src/frontend ci.`);
  run(process.execPath, [prettier, "--write", absolute], frontend);
}
process.exit(0);

function run(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: TIMEOUT_MS });
    debug("format-file", { path, formatter: command }, root);
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-20).join("\n");
    block("R8", `Formatting ${path} failed. Fix the file so the formatter accepts it:\n${output || error.message}`);
  }
}
