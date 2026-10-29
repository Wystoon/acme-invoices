import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { repoRoot, runHook, tempDir, writeFile } from "./helpers.mjs";

// A throwaway root that can format: the dotnet tool manifest, and the frontend's Prettier setup.
const root = tempDir();
cpSync(join(repoRoot, ".config"), join(root, ".config"), { recursive: true });
mkdirSync(join(root, "src", "frontend"), { recursive: true });
cpSync(join(repoRoot, "src", "frontend", ".prettierrc"), join(root, "src", "frontend", ".prettierrc"));
// A junction on Windows: it needs no administrator rights or Developer Mode (the type is ignored elsewhere).
symlinkSync(join(repoRoot, "src", "frontend", "node_modules"), join(root, "src", "frontend", "node_modules"), "junction");

const format = (path) => runHook("format-file.mjs", { tool_name: "Edit", tool_input: { file_path: join(root, path) } }, { root });

test("C# files are formatted with CSharpier", () => {
  writeFile(root, "src/backend/Messy.cs", "namespace Acme;public class Messy{public int Value(){return 1;}}\n");
  const result = format("src/backend/Messy.cs");
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(root, "src/backend/Messy.cs"), "utf8"), /public class Messy\n\{\n/);
});

test("a C# file the formatter cannot parse is reported to the model", () => {
  writeFile(root, "src/backend/Broken.cs", "public class {\n");
  const result = format("src/backend/Broken.cs");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^\[R8\] Formatting src\/backend\/Broken\.cs failed\./);
});

test("frontend files are formatted with Prettier", () => {
  writeFile(root, "src/frontend/src/app/x.ts", "export const x = {a:1}\n");
  const result = format("src/frontend/src/app/x.ts");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(root, "src/frontend/src/app/x.ts"), "utf8"), "export const x = { a: 1 };\n");
});

test("other files and files outside the repository are left alone", () => {
  writeFile(root, "notes.txt", "a   b\n");
  assert.equal(format("notes.txt").status, 0);
  assert.equal(readFileSync(join(root, "notes.txt"), "utf8"), "a   b\n");
  const outside = runHook("format-file.mjs", { tool_input: { file_path: "/tmp/elsewhere.cs" } }, { root });
  assert.equal(outside.status, 0);
});
