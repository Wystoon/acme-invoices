// The focused toolset (after mode): bounded, structured output, and no way to write work items.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdoStore } from "../core/ado-store.js";
import { createPullRequest, PullRequestStore, remoteDir } from "../core/pull-requests.js";
import { MAX_RESULTS, SECTION_CHARS, Wiki } from "../core/wiki.js";
import { buildWorkItemContext, LIMITS, workItemContextSchema, writeContextFiles } from "../core/work-item-context.js";

export function registerFocusedTools(server: McpServer, repoRoot: string): void {
  server.registerTool(
    "get_work_item_context",
    {
      title: "Get work item context",
      description:
        `Returns everything needed to start on one Azure DevOps work item: cleaned description and acceptance criteria, ` +
        `up to ${LIMITS.parentLevels} parent levels, up to ${LIMITS.siblings} siblings, the ${LIMITS.comments} newest comments ` +
        `(each cut to ${LIMITS.commentChars} characters), and whether the item is complete enough to start (complete, missing). ` +
        `Also writes .acme/out/<id>/context.md and context.json. The same work item always gives the same output.`,
      inputSchema: { workItemId: z.number().int().positive().describe("Azure DevOps work item ID, e.g. 4821") },
      outputSchema: workItemContextSchema.shape,
    },
    async ({ workItemId }) => {
      const context = buildWorkItemContext(new AdoStore(repoRoot), workItemId);
      writeContextFiles(repoRoot, context);
      return structured(context);
    },
  );

  server.registerTool(
    "search_wiki",
    {
      title: "Search the engineering wiki",
      description:
        `Searches the Acme engineering wiki (docs/wiki) and returns up to ${MAX_RESULTS} matching sections with a short snippet. ` +
        `Sections whose headings contain more of your words come first. Read a section with get_wiki_section.`,
      inputSchema: {
        query: z.string().min(1).describe("A few specific words, e.g. 'migration down'"),
        limit: z.number().int().min(1).max(MAX_RESULTS).optional(),
      },
      outputSchema: {
        results: z.array(
          z.object({
            page: z.string(),
            heading: z.string(),
            anchor: z.string(),
            snippet: z.string(),
            headingMatches: z.number(),
            score: z.number(),
          }),
        ),
      },
    },
    async ({ query, limit }) => structured({ results: new Wiki(repoRoot).search(query, limit) }),
  );

  server.registerTool(
    "get_wiki_section",
    {
      title: "Read one wiki section",
      description: `Returns one section of a wiki page, including its subsections, cut to ${SECTION_CHARS} characters. Use the page and heading from search_wiki.`,
      inputSchema: {
        page: z.string().describe("Page file name, e.g. coding-standards.md"),
        heading: z.string().describe("Heading text or anchor, e.g. HTTP"),
      },
      outputSchema: { page: z.string(), heading: z.string(), anchor: z.string(), text: z.string(), truncated: z.boolean() },
    },
    async ({ page, heading }) => structured(new Wiki(repoRoot).section(page, heading)),
  );

  server.registerTool(
    "create_pr",
    {
      title: "Open a pull request",
      description:
        "Opens a pull request into main from a pushed feature or bugfix branch. The work item, a summary, the list of changes, " +
        "test evidence and a risk level are required; the description is rendered from the team's PR template.",
      inputSchema: {
        workItemId: z.number().int().positive(),
        sourceBranch: z.string().min(1).describe("Pushed branch, e.g. feature/4821-export-invoices-csv"),
        title: z.string().min(1),
        summary: z.string().min(1),
        changes: z.array(z.string().min(1)).min(1),
        testEvidence: z.string().describe("Test command and result counts"),
        risk: z.enum(["low", "medium", "high"]),
      },
      outputSchema: {
        prId: z.number(),
        url: z.string(),
        workItemId: z.number(),
        sourceBranch: z.string(),
        targetBranch: z.string(),
      },
    },
    async (input) => {
      const pr = createPullRequest(repoRoot, input);
      return structured({ prId: pr.prId, url: pr.url, workItemId: input.workItemId, sourceBranch: pr.sourceBranch, targetBranch: pr.targetBranch });
    },
  );

  server.registerTool(
    "post_pr_comment",
    {
      title: "Comment on a pull request",
      description: "Adds a comment to an open pull request.",
      inputSchema: { prId: z.number().int().positive(), text: z.string().min(1) },
      outputSchema: { prId: z.number(), commentId: z.number() },
    },
    async ({ prId, text }) => {
      const commentId = new PullRequestStore(remoteDir(repoRoot)).addComment(prId, text);
      return structured({ prId, commentId });
    },
  );
}

function structured<T extends Record<string, unknown>>(value: T) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value };
}
