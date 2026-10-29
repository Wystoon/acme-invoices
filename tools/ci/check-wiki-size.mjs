#!/usr/bin/env node
// Checks that docs/wiki has all expected pages and stays between 60,000 and 90,000 characters.
// The size is part of the demo: "read the entire wiki first" (rule R1) must be visibly expensive.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wikiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "wiki");
const MIN_CHARS = 60_000;
const MAX_CHARS = 90_000;
const PAGES = [
  "index.md",
  "architecture-overview.md",
  "coding-standards.md",
  "database-migrations.md",
  "angular-style-guide.md",
  "git-workflow.md",
  "pull-requests.md",
  "security-and-secrets.md",
  "testing.md",
  "release-process.md",
  "onboarding.md",
  "glossary.md",
  "postmortems-2025.md",
];

let total = 0;
const missing = [];
for (const page of PAGES) {
  const path = join(wikiDir, page);
  if (!existsSync(path)) {
    missing.push(page);
    continue;
  }
  const text = readFileSync(path, "utf8");
  const chars = [...text].length;
  total += chars;
  console.log(`${String(chars).padStart(7)}  ${String(text.split("\n").length - 1).padStart(4)} lines  ${page}`);
}
console.log(`${String(total).padStart(7)}  total characters (allowed ${MIN_CHARS}–${MAX_CHARS})`);

const problems = [
  ...missing.map((page) => `missing page: docs/wiki/${page}`),
  ...(total < MIN_CHARS || total > MAX_CHARS ? [`wiki size ${total} is outside ${MIN_CHARS}–${MAX_CHARS}`] : []),
];
for (const problem of problems) console.error(problem);
process.exit(problems.length === 0 ? 0 : 1);
