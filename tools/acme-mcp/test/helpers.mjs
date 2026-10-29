// Test helpers: every test works on a temporary copy of the fixtures, never on the real repository.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..", "..", "..");
export const goldenDir = join(here, "golden");

/** A temporary repository root with copies of data/ado and docs. */
export function tempRepo() {
  const root = mkdtempSync(join(tmpdir(), "acme-mcp-test-"));
  cpSync(join(repoRoot, "data", "ado"), join(root, "data", "ado"), { recursive: true });
  cpSync(join(repoRoot, "docs"), join(root, "docs"), { recursive: true });
  return root;
}

/** A temporary root with hand-made work items: { id, type, title, state, parent, description, ac, comments }. */
export function syntheticRepo(items) {
  const root = mkdtempSync(join(tmpdir(), "acme-mcp-synthetic-"));
  mkdirSync(join(root, "data", "ado", "workitems"), { recursive: true });
  mkdirSync(join(root, "data", "ado", "comments"), { recursive: true });
  for (const item of items) {
    const fields = {
      "System.WorkItemType": item.type ?? "User Story",
      "System.Title": item.title ?? `Item ${item.id}`,
      "System.State": item.state ?? "New",
      ...(item.description !== undefined ? { "System.Description": item.description } : {}),
      ...(item.ac !== undefined ? { "Microsoft.VSTS.Common.AcceptanceCriteria": item.ac } : {}),
    };
    const relations = item.parent
      ? [{ rel: "System.LinkTypes.Hierarchy-Reverse", url: `https://dev.acme.example/acme/_apis/wit/workItems/${item.parent}` }]
      : [];
    writeFileSync(join(root, "data", "ado", "workitems", `${item.id}.json`), JSON.stringify({ id: item.id, rev: 1, fields, relations }));
    writeFileSync(join(root, "data", "ado", "comments", `${item.id}.json`), JSON.stringify({ comments: item.comments ?? [] }));
  }
  return root;
}

/** Makes `root` a git repository whose origin is a bare remote with `main` and the given branches. */
export function withRemote(root, branches = []) {
  const remote = join(root, "remote.git");
  git(["init", "--bare", "--quiet", remote]);
  git(["init", "--quiet", root]);
  git(["-C", root, "remote", "add", "origin", remote]);
  const tree = git(["--git-dir", remote, "hash-object", "-t", "tree", "-w", "--stdin"], "");
  const commit = git(["--git-dir", remote, "commit-tree", tree, "-m", "init"]);
  for (const branch of ["main", ...branches]) git(["--git-dir", remote, "update-ref", `refs/heads/${branch}`, commit]);
  return remote;
}

function git(args, input) {
  return execFileSync("git", args, {
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@acme.example",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@acme.example",
    },
  }).trim();
}
