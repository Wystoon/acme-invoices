import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, parseToolset } from "../dist/server.js";
import { APPROVAL_REQUIRED } from "../dist/tools/raw.js";
import { tempRepo, withRemote } from "./helpers.mjs";

const FOCUSED = ["create_pr", "get_wiki_section", "get_work_item_context", "post_pr_comment", "search_wiki"];
const RAW = [
  "create_pull_request",
  "create_work_item",
  "get_child_work_items",
  "get_work_item",
  "get_work_item_comments",
  "list_wiki_pages",
  "post_pr_comment",
  "read_wiki_page",
  "update_work_item",
];

async function connect(toolset, root) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(toolset, root).connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

const toolNames = async (client) => (await client.listTools()).tools.map((tool) => tool.name).sort();

test("the focused toolset offers exactly its five tools and no work item writes", async () => {
  const client = await connect("focused", tempRepo());
  assert.deepEqual(await toolNames(client), FOCUSED);
  const comment = (await client.listTools()).tools.find((tool) => tool.name === "post_pr_comment");
  assert.equal(comment.inputSchema.properties.approved, undefined);
});

test("the raw toolset offers its nine tools and none of the focused ones", async () => {
  const client = await connect("raw", tempRepo());
  assert.deepEqual(await toolNames(client), RAW);
  const comment = (await client.listTools()).tools.find((tool) => tool.name === "post_pr_comment");
  assert.ok(comment.inputSchema.properties.approved);
});

test("get_work_item_context returns structured content equal to the written file", async () => {
  const root = tempRepo();
  const client = await connect("focused", root);
  const result = await client.callTool({ name: "get_work_item_context", arguments: { workItemId: 4821 } });
  assert.equal(result.isError, undefined);
  const written = JSON.parse(readFileSync(join(root, ".acme", "out", "4821", "context.json"), "utf8"));
  assert.deepEqual(result.structuredContent, written);
});

test("an unknown work item is a tool error the model can read", async () => {
  const client = await connect("focused", tempRepo());
  const result = await client.callTool({ name: "get_work_item_context", arguments: { workItemId: 9999 } });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "Work item 9999 not found");
});

test("raw post_pr_comment refuses until the model itself sets approved=true", async () => {
  const root = tempRepo();
  withRemote(root, ["feature/x"]);
  const client = await connect("raw", root);
  await client.callTool({
    name: "create_pull_request",
    arguments: { sourceBranch: "feature/x", targetBranch: "main", title: "t", description: "d" },
  });
  const refused = await client.callTool({ name: "post_pr_comment", arguments: { prId: 1, text: "hi", approved: false } });
  assert.equal(refused.content[0].text, APPROVAL_REQUIRED);
  const posted = await client.callTool({ name: "post_pr_comment", arguments: { prId: 1, text: "hi", approved: true } });
  assert.deepEqual(JSON.parse(posted.content[0].text), { prId: 1, commentId: 1 });
});

test("ACME_TOOLSET accepts only focused or raw", () => {
  assert.equal(parseToolset(undefined), "focused");
  assert.equal(parseToolset("raw"), "raw");
  assert.throws(() => parseToolset("all"), /must be "focused" or "raw"/);
});
