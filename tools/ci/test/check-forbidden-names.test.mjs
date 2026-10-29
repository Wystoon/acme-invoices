import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "check-forbidden-names.mjs");

function setup(files) {
  const base = mkdtempSync(join(tmpdir(), "acme-names-"));
  const root = join(base, "repo");
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const names = join(base, "names.txt");
  writeFileSync(names, "Globexcorp\nInitrode Labs\n");
  return { root, names };
}

const check = (names, root) => spawnSync(process.execPath, [script, names, root], { encoding: "utf8" });

test("hits are reported as file:line only, never the matched name", () => {
  const { root, names } = setup({ "docs/a.md": "line one\nworked at globexcorp before\n", "src/b.ts": "// initrode labs\n" });
  const result = check(names, root);
  assert.equal(result.status, 1);
  assert.deepEqual(result.stderr.trim().split("\n").sort(), ["docs/a.md:2", "src/b.ts:1"]);
  assert.doesNotMatch(result.stdout + result.stderr, /globexcorp|initrode/i);
});

test("only whole words match, and build folders are skipped", () => {
  const { root, names } = setup({ "a.md": "Globexcorporation is a longer word\n", "node_modules/x/c.js": "Globexcorp\n" });
  const result = check(names, root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 name\(s\) checked in 1 file\(s\): 0 hit\(s\)/);
});

test("a names file inside the scanned folder is refused", () => {
  const { root } = setup({ "a.md": "x\n" });
  writeFileSync(join(root, "names.txt"), "Globexcorp\n");
  const result = check(join(root, "names.txt"), root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Keep it outside the repository/);
});
