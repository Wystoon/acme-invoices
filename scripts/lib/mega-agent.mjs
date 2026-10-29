// Builds the before-mode "MegaAgent": the verbatim header and rules R1–R20
// (demo-configs/before/acme-dev.header.md), followed by the full text of the wiki pages
// the rules point to. Used by scripts/demo-mode.mjs before.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PASTED = [
  ["The Acme database migration guide (R10)", "database-migrations.md"],
  ["The Acme Angular style guide (R11)", "angular-style-guide.md"],
];
const EDGE_CASES = ["git-workflow.md", "pull-requests.md", "security-and-secrets.md"];

export function renderMegaAgent(repoRoot) {
  const wiki = (page) => readFileSync(join(repoRoot, "docs", "wiki", page), "utf8").trimEnd();
  const parts = [readFileSync(join(repoRoot, "demo-configs", "before", "acme-dev.header.md"), "utf8").trimEnd()];
  for (const [title, page] of PASTED) {
    parts.push(`---\n\n# ${title}\n\nPasted from docs/wiki/${page}.\n\n${wiki(page)}`);
  }
  parts.push(`---\n\n# Edge cases\n\nPasted from docs/wiki: ${EDGE_CASES.join(", ")}.`);
  for (const page of EDGE_CASES) parts.push(wiki(page));
  return parts.join("\n\n") + "\n";
}
