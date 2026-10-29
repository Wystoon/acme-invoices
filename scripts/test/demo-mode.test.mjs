// {{REPO_ROOT}} in the allow rules, as demo-mode.mjs writes it on each OS. Pure string tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { expandRepoRoot } from "../demo-mode.mjs";
import { repoRoot } from "../../tools/hooks/test/helpers.mjs";

const settings = { permissions: { allow: ["Bash(git status *)", "Bash(git -C {{REPO_ROOT}} log *)"], deny: ["WebFetch"] } };

test("macOS and Linux: one rule with the absolute path", () => {
  assert.deepEqual(expandRepoRoot(settings, "/home/ada/acme-invoices", "linux").permissions, {
    allow: ["Bash(git status *)", "Bash(git -C /home/ada/acme-invoices log *)"],
    deny: ["WebFetch"],
  });
});

test("Windows: the rule in the three forms Git Bash can see, and valid JSON with the backslashes escaped", () => {
  const expanded = expandRepoRoot(settings, String.raw`C:\Users\ada\acme-invoices`, "win32");
  assert.deepEqual(expanded.permissions.allow, [
    "Bash(git status *)",
    String.raw`Bash(git -C C:\Users\ada\acme-invoices log *)`,
    "Bash(git -C C:/Users/ada/acme-invoices log *)",
    "Bash(git -C /c/Users/ada/acme-invoices log *)",
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(expanded, null, 2)), expanded);
});

test("the after-mode settings expand completely, and a placeholder outside permissions.allow is refused", () => {
  const after = JSON.parse(readFileSync(join(repoRoot, "demo-configs", "after", ".claude", "settings.json"), "utf8"));
  const expanded = expandRepoRoot(after, String.raw`D:\work\acme-invoices`, "win32");
  assert.ok(!JSON.stringify(expanded).includes("{{REPO_ROOT}}"));
  assert.ok(expanded.permissions.allow.includes("Bash(git -C /d/work/acme-invoices status *)"));
  assert.throws(() => expandRepoRoot({ env: { ROOT: "{{REPO_ROOT}}" } }, "/x", "linux"), /only supported in permissions\.allow/);
});
