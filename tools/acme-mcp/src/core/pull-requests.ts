// Simulated pull requests, stored as JSON next to the bare remote (<remote>/acme-prs/<n>.json).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { AdoStore, textField } from "./ado-store.js";

export interface PullRequestJson {
  prId: number;
  url: string;
  title: string;
  workItemId: number | null;
  sourceBranch: string;
  targetBranch: string;
  status: "active" | "completed";
  description: string;
  comments: { id: number; text: string; approved?: boolean }[];
}

export interface CreatePrInput {
  workItemId: number;
  sourceBranch: string;
  title: string;
  summary: string;
  changes: string[];
  testEvidence: string;
  risk: "low" | "medium" | "high";
}

/** The bare remote's folder, from `git config --get remote.origin.url` in the repository. */
export function remoteDir(repoRoot: string): string {
  let url: string;
  try {
    url = execFileSync("git", ["config", "--get", "remote.origin.url"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    throw new Error("No git remote 'origin' is configured. Run node scripts/setup.mjs first.");
  }
  const path = url.replace(/^file:\/\//, "");
  if (/^[a-z]+:\/\//i.test(path) || /^[^/]+@[^:]+:/.test(path)) {
    throw new Error(`Remote origin (${url}) is not a local folder.`);
  }
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

export function branchExistsOnRemote(remote: string, branch: string): boolean {
  try {
    execFileSync("git", ["--git-dir", remote, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class PullRequestStore {
  private readonly dir: string;

  constructor(remote: string) {
    this.dir = join(remote, "acme-prs");
  }

  create(fields: Omit<PullRequestJson, "prId" | "url" | "status" | "comments">): PullRequestJson {
    mkdirSync(this.dir, { recursive: true });
    const ids = readdirSync(this.dir)
      .map((name) => /^(\d+)\.json$/.exec(name)?.[1])
      .filter((id): id is string => id !== undefined)
      .map(Number);
    const prId = Math.max(0, ...ids) + 1;
    const pr: PullRequestJson = { prId, url: pullRequestUrl(prId), ...fields, status: "active", comments: [] };
    this.save(pr);
    return pr;
  }

  get(prId: number): PullRequestJson {
    const file = join(this.dir, `${prId}.json`);
    if (!existsSync(file)) throw new Error(`Pull request ${prId} not found`);
    return JSON.parse(readFileSync(file, "utf8")) as PullRequestJson;
  }

  addComment(prId: number, text: string, extra: { approved?: boolean } = {}): number {
    const pr = this.get(prId);
    const id = pr.comments.length + 1;
    pr.comments.push({ id, text, ...extra });
    this.save(pr);
    return id;
  }

  private save(pr: PullRequestJson): void {
    writeFileSync(join(this.dir, `${pr.prId}.json`), JSON.stringify(pr, null, 2) + "\n");
  }
}

export const pullRequestUrl = (prId: number) => `https://dev.acme.example/acme/invoices/pullrequest/${prId}`;

/**
 * Opens a PR into main. The required inputs are the policy: a pushed non-main branch,
 * an existing work item, test evidence, and a description rendered from the team template.
 */
export function createPullRequest(repoRoot: string, input: CreatePrInput): PullRequestJson {
  const branch = input.sourceBranch.trim().replace(/^refs\/heads\//, "");
  if (branch === "main") {
    throw new Error("sourceBranch must not be main. Push a feature/<id>-<slug> branch and open the PR from it.");
  }
  const workItem = new AdoStore(repoRoot).get(input.workItemId);
  if (input.testEvidence.trim() === "") {
    throw new Error("testEvidence is empty. Run the tests (dotnet test --solution src/backend) and paste the result.");
  }
  const remote = remoteDir(repoRoot);
  if (!branchExistsOnRemote(remote, branch)) {
    throw new Error(`Branch "${branch}" does not exist on the remote. Push it first: git push -u origin ${branch}`);
  }

  const workItemTitle = textField(workItem, "System.Title");
  const prefix = `AB#${input.workItemId}:`;
  const description = readFileSync(join(repoRoot, "docs", "templates", "pull_request.md"), "utf8")
    .replaceAll("{{summary}}", input.summary.trim())
    .replaceAll("{{workItemId}}", String(input.workItemId))
    .replaceAll("{{workItemTitle}}", workItemTitle)
    .replaceAll("{{changes}}", input.changes.map((change) => `- ${change.trim()}`).join("\n"))
    .replaceAll("{{testEvidence}}", input.testEvidence.trim())
    .replaceAll("{{risk}}", input.risk);

  return new PullRequestStore(remote).create({
    title: input.title.startsWith(prefix) ? input.title : `${prefix} ${input.title}`,
    workItemId: input.workItemId,
    sourceBranch: branch,
    targetBranch: "main",
    description,
  });
}
