// The raw toolset (before mode): what a typical "connect the agent to everything" integration offers.
// Unbounded output, write access to work items, no validation, and an approval flag the model fills in itself.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdoStore } from "../core/ado-store.js";
import { PullRequestStore, remoteDir } from "../core/pull-requests.js";
import { Wiki } from "../core/wiki.js";

export const APPROVAL_REQUIRED =
  "Comment requires user approval. Set approved=true once the user has approved.";

export function registerRawTools(server: McpServer, repoRoot: string): void {
  const ado = () => new AdoStore(repoRoot);

  server.registerTool(
    "get_work_item",
    { description: "Get a work item by ID from Azure DevOps.", inputSchema: { id: z.number().int() } },
    async ({ id }) => text(ado().rawWorkItem(id)),
  );

  server.registerTool(
    "get_work_item_comments",
    { description: "Get all comments of a work item.", inputSchema: { id: z.number().int() } },
    async ({ id }) => text(ado().rawComments(id)),
  );

  server.registerTool(
    "get_child_work_items",
    { description: "Get all child work items of a work item.", inputSchema: { id: z.number().int() } },
    async ({ id }) => text(JSON.stringify(ado().children(id), null, 2)),
  );

  server.registerTool(
    "list_wiki_pages",
    { description: "List all pages of the engineering wiki." },
    async () => text(new Wiki(repoRoot).pageNames().map((name) => `docs/wiki/${name}`).join("\n")),
  );

  server.registerTool(
    "read_wiki_page",
    { description: "Read a wiki page.", inputSchema: { path: z.string() } },
    async ({ path }) => text(new Wiki(repoRoot).pageText(path)),
  );

  server.registerTool(
    "create_work_item",
    {
      description: "Create a work item in Azure DevOps.",
      inputSchema: { type: z.string(), title: z.string(), parentId: z.number().int(), description: z.string() },
    },
    async (input) => text(JSON.stringify({ id: logWrite(repoRoot, { op: "create", ...input }) })),
  );

  server.registerTool(
    "update_work_item",
    {
      description: "Update fields of a work item in Azure DevOps.",
      inputSchema: { id: z.number().int(), fields: z.record(z.string(), z.unknown()) },
    },
    async (input) => {
      logWrite(repoRoot, { op: "update", ...input });
      return text(JSON.stringify({ id: input.id, updated: Object.keys(input.fields) }));
    },
  );

  server.registerTool(
    "create_pull_request",
    {
      description: "Create a pull request.",
      inputSchema: { sourceBranch: z.string(), targetBranch: z.string(), title: z.string(), description: z.string() },
    },
    async (input) => {
      const pr = new PullRequestStore(remoteDir(repoRoot)).create({ ...input, workItemId: null });
      return text(JSON.stringify({ prId: pr.prId, url: pr.url }));
    },
  );

  server.registerTool(
    "post_pr_comment",
    {
      description: "Post a comment on a pull request.",
      inputSchema: {
        prId: z.number().int(),
        text: z.string(),
        approved: z.boolean().describe("Whether the user approved posting this comment."),
      },
    },
    async ({ prId, text: comment, approved }) => {
      if (approved !== true) return text(APPROVAL_REQUIRED);
      const commentId = new PullRequestStore(remoteDir(repoRoot)).addComment(prId, comment, { approved });
      return text(JSON.stringify({ prId, commentId }));
    },
  );
}

/** Appends to .acme/state/ado-writes.jsonl and returns a fake work item ID. */
function logWrite(repoRoot: string, entry: Record<string, unknown>): number {
  const dir = join(repoRoot, ".acme", "state");
  const file = join(dir, "ado-writes.jsonl");
  mkdirSync(dir, { recursive: true });
  appendFileSync(file, JSON.stringify(entry) + "\n");
  const lines = existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").length : 1;
  return 90000 + lines;
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}
