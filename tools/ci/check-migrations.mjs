#!/usr/bin/env node
// CI check for EF Core migrations (rule R10, level 7). For every migration in Migrations/:
//   - the file name is <14-digit timestamp>_<PascalCaseName>
//   - Down() makes at least one real call (a lone `throw` counts as empty)
//   - every DropColumn/DropTable in Up() has `// acme:destructive-approved AB#<ticket>` on the line above.
//     Down() is not checked: dropping what the same migration's Up() added is not destructive.
// Usage: node tools/ci/check-migrations.mjs [migrations-folder]
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "backend", "Acme.Invoices.Infrastructure", "Migrations");
const NAME = /^\d{14}_[A-Z][A-Za-z0-9]+$/;
const DESTRUCTIVE = /\.\s*(DropColumn|DropTable)\s*[<(]/;
const MARKER = /\/\/\s*acme:destructive-approved\s+AB#\d+/;

const dir = process.argv[2] ?? DEFAULT_DIR;
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".cs") && !file.endsWith(".Designer.cs") && !file.endsWith("ModelSnapshot.cs"))
  .sort();

const problems = files.flatMap((file) => checkMigration(file, readFileSync(join(dir, file), "utf8")));
for (const problem of problems) console.error(`[R10] ${problem}`);
console.log(problems.length === 0 ? `${files.length} migration(s) OK` : `${problems.length} problem(s) in ${files.length} migration(s)`);
process.exit(problems.length === 0 ? 0 : 1);

function checkMigration(file, source) {
  const name = basename(file, ".cs");
  const problems = [];
  if (!NAME.test(name)) problems.push(`${file}: name must be <14-digit timestamp>_<PascalCaseName>, e.g. 20261027115532_AddCustomerPaymentTerms`);

  const down = methodBody(source, "Down");
  if (down === null || !/\b\w+\s*\.\s*\w+\s*[<(]/.test(stripComments(down))) {
    problems.push(`${file}: Down() is empty. Implement it so the migration can be rolled back.`);
  }

  const upLines = (methodBody(source, "Up") ?? "").split("\n");
  upLines.forEach((line, index) => {
    if (!DESTRUCTIVE.test(line) || line.trimStart().startsWith("//")) return;
    const previous = upLines.slice(0, index).reverse().find((candidate) => candidate.trim() !== "") ?? "";
    if (!MARKER.test(previous)) {
      problems.push(`${file}: ${line.trim().split("(")[0]} in Up() needs "// acme:destructive-approved AB#<ticket>" on the line above, and approval from the database owner.`);
    }
  });
  return problems;
}

/** The text between the braces of `override void <name>(...)`, or null. */
function methodBody(source, name) {
  const start = source.search(new RegExp(`override\\s+void\\s+${name}\\s*\\(`));
  if (start === -1) return null;
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  return null;
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
