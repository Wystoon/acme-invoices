import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Wiki } from "../dist/core/wiki.js";
import { repoRoot } from "./helpers.mjs";

function syntheticWiki(pages) {
  const root = mkdtempSync(join(tmpdir(), "acme-wiki-"));
  mkdirSync(join(root, "docs", "wiki"), { recursive: true });
  for (const [name, text] of Object.entries(pages)) writeFileSync(join(root, "docs", "wiki", name), text);
  return new Wiki(root);
}

test("search is deterministic, ranked and capped at 5 results", () => {
  const wiki = new Wiki(repoRoot);
  const results = wiki.search("migration down");
  assert.deepEqual(wiki.search("migration down"), results);
  assert.ok(results.length > 0 && results.length <= 5);
  assert.ok(
    results.every((r, i) => {
      const previous = results[i - 1];
      return !previous || previous.headingMatches > r.headingMatches || (previous.headingMatches === r.headingMatches && previous.score >= r.score);
    }),
  );
  assert.ok(results.every((r) => r.snippet.length <= 300));
  assert.equal(wiki.search("migration down", 2).length, 2);
});

test("heading boost: the guide's own sections win over sections that merely repeat a word", () => {
  const wiki = new Wiki(repoRoot);
  const migration = wiki.search("migration down")[0];
  assert.equal(`${migration.page}#${migration.anchor}`, "database-migrations.md#part-4-down-is-mandatory");
  assert.equal(migration.heading, "Part 4: Down() is mandatory");
  const http = wiki.search("HTTP client")[0];
  assert.equal(`${http.page}#${http.anchor}`, "coding-standards.md#http");
});

test("more query words in the heading path beat a higher word count", () => {
  const wiki = syntheticWiki({
    "p.md": "# Alpha guide\n## Beta\nx\n## Other\nalpha alpha alpha beta beta beta\n",
  });
  assert.deepEqual(wiki.search("alpha beta").map((r) => [r.anchor, r.headingMatches, r.score]), [
    ["beta", 2, 3],
    ["other", 1, 6],
    ["alpha-guide", 1, 3],
  ]);
});

test("a plural in the text matches a singular query word", () => {
  const wiki = syntheticWiki({ "p.md": "## Migrations\nAlways test them.\n" });
  assert.equal(wiki.search("migration")[0].headingMatches, 1);
});

test("ties are broken by page, then by section order", () => {
  const wiki = syntheticWiki({ "b.md": "# B\nalpha\n## Second\nalpha\n", "a.md": "# A\nalpha\n" });
  assert.deepEqual(wiki.search("alpha").map((r) => `${r.page}#${r.anchor}`), ["a.md#a", "b.md#b", "b.md#second"]);
});

test("a query of only stop words is rejected", () => {
  assert.throws(() => new Wiki(repoRoot).search("the and of"), /no searchable words/);
});

test("get_wiki_section finds a section by heading or anchor", () => {
  const wiki = new Wiki(repoRoot);
  const section = wiki.section("coding-standards.md", "HTTP");
  assert.match(section.text, /^## HTTP/);
  assert.match(section.text, /IHttpClientFactory/);
  assert.equal(section.truncated, false);
  assert.deepEqual(wiki.section("coding-standards", "http"), section);
});

test("unknown heading or page lists the valid ones", () => {
  const wiki = new Wiki(repoRoot);
  assert.throws(() => wiki.section("coding-standards.md", "Nope"), /Valid headings: .*HTTP/);
  assert.throws(() => wiki.section("nope.md", "HTTP"), /Valid pages: .*coding-standards\.md/);
});

test("headings inside code fences are ignored and subsections are included", () => {
  const wiki = syntheticWiki({ "p.md": "# Title\n## Part\ntext\n```bash\n# not a heading\n```\n### Sub\nsub text\n## Next\n" });
  const section = wiki.section("p.md", "Part");
  assert.equal(section.text, "## Part\ntext\n```bash\n# not a heading\n```\n### Sub\nsub text");
});

test("long sections are cut at 4,000 characters", () => {
  const wiki = syntheticWiki({ "p.md": `## Long\n${"z".repeat(5000)}\n` });
  const section = wiki.section("p.md", "Long");
  assert.equal(section.truncated, true);
  assert.match(section.text, / …\[cut \d+ chars\]$/);
});
