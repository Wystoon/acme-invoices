// get_work_item_context: the input for one work item, assembled by code with fixed limits.
// Same fixtures in, same bytes out: no clock, no randomness, no absolute paths, stable order.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AdoStore, personField, textField, type WorkItemJson } from "./ado-store.js";
import { cut, htmlToItems, htmlToText } from "./html-to-text.js";

export const LIMITS = {
  parentLevels: 5,
  siblings: 20,
  comments: 10,
  commentChars: 1000,
  descriptionChars: 4000,
} as const;

const workItemRef = z.object({ id: z.number(), type: z.string(), title: z.string(), state: z.string() });
const counts = z.object({ returned: z.number(), total: z.number() });

export const workItemContextSchema = z.object({
  schema: z.literal("acme.work-item-context/v1"),
  workItem: z.object({
    id: z.number(),
    type: z.string(),
    title: z.string(),
    state: z.string(),
    assignedTo: z.string().nullable(),
    tags: z.array(z.string()),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()).nullable(),
  }),
  parents: z.array(workItemRef),
  siblings: z.array(workItemRef),
  comments: z.array(z.object({ id: z.number(), author: z.string(), date: z.string(), text: z.string() })),
  complete: z.boolean(),
  missing: z.array(z.string()),
  warnings: z.array(z.string()),
  truncated: z.object({
    description: counts.optional(),
    siblings: counts.optional(),
    comments: counts.optional(),
    commentText: z.array(z.number()).optional(),
  }),
  limits: z.object({
    parentLevels: z.number(),
    siblings: z.number(),
    comments: z.number(),
    commentChars: z.number(),
    descriptionChars: z.number(),
  }),
  artifactPath: z.string(),
});

export type WorkItemContext = z.infer<typeof workItemContextSchema>;
type WorkItemRef = z.infer<typeof workItemRef>;

const CLOSED_STATES = ["Closed", "Removed", "Resolved"];

export function buildWorkItemContext(store: AdoStore, id: number): WorkItemContext {
  const item = store.get(id);
  const warnings: string[] = [];

  const description = cut(htmlToText(textField(item, "System.Description")), LIMITS.descriptionChars);
  const acceptanceCriteria = htmlToItems(textField(item, "Microsoft.VSTS.Common.AcceptanceCriteria"));

  const parents: WorkItemRef[] = [];
  for (let parentId = store.parentId(item); parentId !== undefined && parents.length < LIMITS.parentLevels; ) {
    const parent = store.find(parentId);
    if (!parent) {
      warnings.push(`Parent ${parentId} not found`);
      break;
    }
    parents.push(toRef(parent));
    parentId = store.parentId(parent);
  }

  const allSiblings = parents.length > 0 ? store.children(parents[0].id).filter((child) => child.id !== id) : [];
  const siblings = allSiblings.slice(0, LIMITS.siblings).map(toRef);

  const allComments = [...store.comments(id)].sort(
    (a, b) => compare(b.createdDate, a.createdDate) || b.id - a.id,
  );
  const commentText: number[] = [];
  const comments = allComments.slice(0, LIMITS.comments).map((comment) => {
    const text = cut(htmlToText(comment.text), LIMITS.commentChars);
    if (text.cutChars > 0) commentText.push(comment.id);
    return { id: comment.id, author: comment.createdBy.displayName, date: comment.createdDate.slice(0, 10), text: text.text };
  });

  const missing: string[] = [];
  if (acceptanceCriteria === null) missing.push("acceptanceCriteria");
  if (description.text === "") missing.push("description");

  const state = textField(item, "System.State");
  if (CLOSED_STATES.includes(state)) warnings.push(`State is ${state}`);

  const truncated: WorkItemContext["truncated"] = {};
  if (description.cutChars > 0) {
    truncated.description = { returned: LIMITS.descriptionChars, total: LIMITS.descriptionChars + description.cutChars };
  }
  if (allSiblings.length > siblings.length) truncated.siblings = { returned: siblings.length, total: allSiblings.length };
  if (allComments.length > comments.length) truncated.comments = { returned: comments.length, total: allComments.length };
  if (commentText.length > 0) truncated.commentText = commentText.sort((a, b) => a - b);

  return {
    schema: "acme.work-item-context/v1",
    workItem: {
      id: item.id,
      type: textField(item, "System.WorkItemType"),
      title: textField(item, "System.Title"),
      state,
      assignedTo: personField(item, "System.AssignedTo"),
      tags: textField(item, "System.Tags")
        .split(";")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== "")
        .sort(compare),
      description: description.text,
      acceptanceCriteria,
    },
    parents,
    siblings,
    comments,
    complete: missing.length === 0,
    missing,
    warnings,
    truncated,
    limits: { ...LIMITS },
    artifactPath: `.acme/out/${item.id}/context.md`,
  };
}

export function renderContextMarkdown(context: WorkItemContext): string {
  const { workItem, truncated } = context;
  const lines = [
    `# AB#${workItem.id} · ${workItem.title}`,
    [
      workItem.type,
      workItem.state,
      workItem.assignedTo ?? "unassigned",
      `tags: ${workItem.tags.length > 0 ? workItem.tags.join(", ") : "none"}`,
    ].join(" · "),
    "",
    "## Acceptance criteria",
    ...(workItem.acceptanceCriteria?.map((criterion, index) => `${index + 1}. ${criterion}`) ?? [
      "_None. The work item has no acceptance criteria._",
    ]),
    "",
    "## Description",
    workItem.description || "_None._",
    "",
    "## Parents",
    ...listOrNone(context.parents.map((p) => `- ${p.type} ${p.id} · ${p.title} (${p.state})`)),
    "",
    `## Siblings (${countLabel(context.siblings.length, truncated.siblings?.total)})`,
    ...listOrNone(context.siblings.map((s) => `- ${s.id} · ${s.title} (${s.state})`)),
    "",
    `## Comments (${countLabel(context.comments.length, truncated.comments?.total)}${context.comments.length > 0 ? ", newest first" : ""})`,
    ...(context.comments.length > 0
      ? context.comments.flatMap((c) => ["", `### ${c.date} · ${c.author}`, c.text])
      : ["_None._"]),
    "",
    "## Completeness",
    `Complete: ${context.complete ? "yes" : "no"}`,
    `Missing: ${context.missing.length > 0 ? context.missing.join(", ") : "none"}`,
    `Warnings: ${context.warnings.length > 0 ? context.warnings.join("; ") : "none"}`,
    `Cut: ${describeCuts(truncated)}`,
    "",
    "_Generated by acme-mcp get_work_item_context from data/ado. Same input, same file._",
  ];
  return lines.join("\n") + "\n";
}

/** Writes .acme/out/<id>/context.json and context.md, each through a temporary file and a rename. */
export function writeContextFiles(repoRoot: string, context: WorkItemContext): void {
  const dir = join(repoRoot, ".acme", "out", String(context.workItem.id));
  mkdirSync(dir, { recursive: true });
  writeAtomically(join(dir, "context.json"), JSON.stringify(context, null, 2) + "\n");
  writeAtomically(join(dir, "context.md"), renderContextMarkdown(context));
}

function writeAtomically(path: string, content: string): void {
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, content);
  renameSync(temporary, path);
}

function toRef(item: WorkItemJson): WorkItemRef {
  return {
    id: item.id,
    type: textField(item, "System.WorkItemType"),
    title: textField(item, "System.Title"),
    state: textField(item, "System.State"),
  };
}

function describeCuts(truncated: WorkItemContext["truncated"]): string {
  const cuts: string[] = [];
  if (truncated.description) cuts.push("description (text)");
  if (truncated.commentText) {
    const noun = truncated.commentText.length === 1 ? "comment" : "comments";
    cuts.push(`${noun} ${truncated.commentText.join(", ")} (text)`);
  }
  if (truncated.siblings) cuts.push(plural(truncated.siblings.total - truncated.siblings.returned, "sibling"));
  if (truncated.comments) cuts.push(plural(truncated.comments.total - truncated.comments.returned, "oldest comment"));
  return cuts.length > 0 ? cuts.join(", ") : "nothing";
}

const countLabel = (returned: number, total?: number) => (returned === 0 ? "0" : `${returned} of ${total ?? returned}`);
const listOrNone = (lines: string[]) => (lines.length > 0 ? lines : ["_None._"]);
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
