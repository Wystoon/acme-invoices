import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { AdoStore } from "../dist/core/ado-store.js";
import { buildWorkItemContext, writeContextFiles } from "../dist/core/work-item-context.js";
import { goldenDir, syntheticRepo, tempRepo } from "./helpers.mjs";

function generate(root, id) {
  const context = buildWorkItemContext(new AdoStore(root), id);
  writeContextFiles(root, context);
  const dir = join(root, ".acme", "out", String(id));
  return { context, json: readFileSync(join(dir, "context.json")), md: readFileSync(join(dir, "context.md")) };
}

for (const id of [4821, 4830, 4840]) {
  test(`context for ${id} matches the golden files`, () => {
    const { json, md } = generate(tempRepo(), id);
    assert.equal(json.toString(), readFileSync(join(goldenDir, `${id}.context.json`), "utf8"));
    assert.equal(md.toString(), readFileSync(join(goldenDir, `${id}.context.md`), "utf8"));
  });
}

test("two runs write byte-identical files", () => {
  const root = tempRepo();
  const first = generate(root, 4821);
  const second = generate(root, 4821);
  assert.ok(first.json.equals(second.json));
  assert.ok(first.md.equals(second.md));
});

test("4821: 3 parents, 20 of 34 siblings, 10 of 12 comments, one comment cut, complete", () => {
  const { context } = generate(tempRepo(), 4821);
  assert.deepEqual(context.parents.map((p) => p.id), [4700, 4500, 4400]);
  assert.equal(context.siblings[0].id, 4840);
  assert.deepEqual(context.truncated, {
    siblings: { returned: 20, total: 34 },
    comments: { returned: 10, total: 12 },
    commentText: [91003],
  });
  assert.equal(context.comments[0].id, 91012);
  assert.ok(context.comments.every((c) => [...c.text].length <= 1000 + " …[cut 9999 chars]".length));
  assert.equal(context.complete, true);
  assert.equal(context.artifactPath, ".acme/out/4821/context.md");
});

test("4830: no acceptance criteria means complete is false", () => {
  const { context } = generate(tempRepo(), 4830);
  assert.equal(context.workItem.acceptanceCriteria, null);
  assert.equal(context.complete, false);
  assert.deepEqual(context.missing, ["acceptanceCriteria"]);
});

test("unknown work item", () => {
  assert.throws(() => buildWorkItemContext(new AdoStore(tempRepo()), 9999), /Work item 9999 not found/);
});

test("follows at most 5 parent levels", () => {
  const items = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, parent: id < 7 ? id + 1 : undefined, ac: "<ul><li>x</li></ul>", description: "d" }));
  const context = buildWorkItemContext(new AdoStore(syntheticRepo(items)), 1);
  assert.deepEqual(context.parents.map((p) => p.id), [2, 3, 4, 5, 6]);
});

test("a missing parent is a warning, not an error", () => {
  const context = buildWorkItemContext(new AdoStore(syntheticRepo([{ id: 1, parent: 99, description: "d", ac: "x" }])), 1);
  assert.deepEqual(context.warnings, ["Parent 99 not found"]);
});

test("siblings are sorted by id and cut at 20", () => {
  const items = [{ id: 1 }, ...Array.from({ length: 25 }, (_, i) => ({ id: 100 - i, parent: 1 }))];
  const context = buildWorkItemContext(new AdoStore(syntheticRepo(items)), 90);
  assert.equal(context.siblings.length, 20);
  assert.deepEqual(context.siblings.slice(0, 3).map((s) => s.id), [76, 77, 78]);
  assert.deepEqual(context.truncated.siblings, { returned: 20, total: 24 });
});

test("comments: newest first, ties by higher id, latest 10, each cut at 1,000 characters", () => {
  const comments = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    text: i === 11 ? "x".repeat(1500) : `comment ${i + 1}`,
    createdBy: { displayName: "Tom Brandt" },
    // Comments 11 and 12 share a timestamp, so the higher id must come first.
    createdDate: i < 2 ? "2026-01-01T00:00:00Z" : `2026-02-${String(Math.min(i, 10)).padStart(2, "0")}T00:00:00Z`,
  }));
  const context = buildWorkItemContext(new AdoStore(syntheticRepo([{ id: 1, comments, description: "d", ac: "x" }])), 1);
  assert.deepEqual(context.comments.map((c) => c.id), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  assert.equal(context.comments[0].text, `${"x".repeat(1000)} …[cut 500 chars]`);
  assert.deepEqual(context.truncated.comments, { returned: 10, total: 12 });
  assert.deepEqual(context.truncated.commentText, [12]);
});

test("description is cut at 4,000 characters; empty description and closed state are reported", () => {
  const long = buildWorkItemContext(new AdoStore(syntheticRepo([{ id: 1, description: "y".repeat(5000), ac: "x" }])), 1);
  assert.deepEqual(long.truncated.description, { returned: 4000, total: 5000 });
  assert.ok(long.workItem.description.endsWith(" …[cut 1000 chars]"));

  const empty = buildWorkItemContext(new AdoStore(syntheticRepo([{ id: 1, state: "Closed", ac: "x" }])), 1);
  assert.deepEqual(empty.missing, ["description"]);
  assert.deepEqual(empty.warnings, ["State is Closed"]);
});
