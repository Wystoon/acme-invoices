import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, runHook, tempRepo, writeFile } from "./helpers.mjs";

const FAILING = "console.log('Failed AddsLineTotals: expected 2.02, got 2.01'); process.exit(1)";

function stop(root, { failing = true, stopHookActive = false, agentId = "implementer-1" } = {}) {
  const result = runHook(
    "tests-before-stop.mjs",
    { hook_event_name: "SubagentStop", session_id: "s1", agent_id: agentId, agent_type: "acme-implementer", stop_hook_active: stopHookActive },
    { root, env: { ACME_STOP_TEST_CMD: failing ? FAILING : "console.log('ok')" } },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() === "" ? null : JSON.parse(result.stdout);
}

test("no changes under src/: the implementer may stop without running tests", () => {
  const root = tempRepo({ branch: "feature/docs" });
  writeFile(root, "docs/notes.md", "changed\n");
  assert.equal(stop(root), null);
});

test("failing tests send the implementer back with the output", () => {
  const root = tempRepo({ branch: "feature/4840-rounding" });
  writeFile(root, "src/backend/Invoice.cs", "// changed\n");
  const output = stop(root);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /^\[R9\] Tests fail\. Fix them before finishing\./);
  assert.match(output.reason, /expected 2\.02, got 2\.01/);
});

test("committed changes on the branch still count (a clean working tree is not enough)", () => {
  const root = tempRepo({ branch: "feature/4840-rounding" });
  writeFile(root, "src/backend/Invoice.cs", "// changed\n");
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "AB#4840: Round each line first"]);
  assert.equal(git(root, ["status", "--porcelain"]), "");
  assert.equal(stop(root).decision, "block");
});

test("passing tests let the implementer stop and reset the counter", () => {
  const root = tempRepo({ branch: "feature/4840-rounding" });
  writeFile(root, "src/frontend/src/app/x.ts", "changed\n");
  assert.equal(stop(root).decision, "block");
  assert.equal(stop(root, { failing: false }), null);
  const counters = join(root, ".acme", "state", "stop-blocks");
  assert.ok(!existsSync(counters) || readdirSync(counters).length === 0);
});

test("stop_hook_active alone does not allow a red stop", () => {
  const root = tempRepo({ branch: "feature/4840-rounding" });
  writeFile(root, "src/backend/Invoice.cs", "// changed\n");
  assert.equal(stop(root, { stopHookActive: true }).decision, "block");
  assert.equal(stop(root, { stopHookActive: true }).decision, "block");
});

test("3 blocks per agent, then a warned stop with a marker on disk", () => {
  const root = tempRepo({ branch: "feature/4840-rounding" });
  writeFile(root, "src/backend/Invoice.cs", "// changed\n");
  const outputs = [false, true, true, true].map((stopHookActive) => stop(root, { stopHookActive }));
  assert.deepEqual(outputs.map((o) => o.decision ?? "allow"), ["block", "block", "block", "allow"]);
  assert.equal(outputs[3].systemMessage, "[R9] Implementer stopped with failing tests after 3 attempts. Do not open a PR.");

  const marker = join(root, ".acme", "state", "tests-failed", "implementer-1");
  assert.match(readFileSync(marker, "utf8"), /expected 2\.02, got 2\.01/);
  assert.equal(stop(root, { agentId: "implementer-2" }).decision, "block");

  assert.equal(stop(root, { failing: false }), null);
  assert.ok(!existsSync(marker), "a green run removes the marker");
});
