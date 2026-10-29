#!/usr/bin/env node
// Checks that no real company, person or tool name appears in the repository.
// The list itself must stay outside the repository (it would leak the names), one name per line.
// Matches are case-insensitive whole words; the output names only file:line, never the matched name.
//   node tools/ci/check-forbidden-names.mjs ~/.acme-forbidden-names.txt [folder-to-scan]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKIP_DIRS = new Set([".git", "node_modules", "bin", "obj", "dist", ".angular", ".acme"]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const [namesArg, rootArg] = process.argv.slice(2);
if (!namesArg) {
  console.error("Usage: node tools/ci/check-forbidden-names.mjs <names-file> [folder-to-scan]");
  process.exit(2);
}
const namesFile = resolve(namesArg);
const root = resolve(rootArg ?? repoRoot);
if (!existsSync(namesFile)) {
  console.error(`Names file not found: ${namesFile}`);
  process.exit(2);
}
if (!relative(root, namesFile).startsWith("..")) {
  console.error("The names file is inside the folder being scanned. Keep it outside the repository: the list itself would leak the names.");
  process.exit(2);
}

const names = readFileSync(namesFile, "utf8").split("\n").map((name) => name.trim()).filter(Boolean);
if (names.length === 0) {
  console.error(`No names in ${namesFile}.`);
  process.exit(2);
}
const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${names.map(escape).join("|")})($|[^\\p{L}\\p{N}])`, "iu");

let files = 0;
const hits = [];
for (const file of walk(root)) {
  files++;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (pattern.test(line)) hits.push(`${relative(root, file).split(sep).join("/")}:${index + 1}`);
    });
}

for (const hit of hits) console.error(hit);
console.log(`${names.length} name(s) checked in ${files} file(s): ${hits.length} hit(s)`);
process.exit(hits.length === 0 ? 0 : 1);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path);
    } else if (entry.isFile() && statSync(path).size <= MAX_FILE_BYTES && !isBinary(path)) {
      yield path;
    }
  }
}

function isBinary(path) {
  return readFileSync(path).subarray(0, 8000).includes(0);
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
