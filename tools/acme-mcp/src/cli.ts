#!/usr/bin/env node
// Command-line access to the same core functions the MCP server uses.
//   node tools/acme-mcp/dist/cli.js context 4821        writes .acme/out/4821/*, prints the JSON
//   node tools/acme-mcp/dist/cli.js search "migration down"
import { AdoStore } from "./core/ado-store.js";
import { Wiki } from "./core/wiki.js";
import { buildWorkItemContext, writeContextFiles } from "./core/work-item-context.js";
import { repoRoot } from "./server.js";

const USAGE = 'Usage: cli.js context <workItemId> | cli.js search "<query>"';

function run(command: string | undefined, argument: string | undefined): unknown {
  const root = repoRoot();
  if (command === "context" && argument && /^\d+$/.test(argument)) {
    const context = buildWorkItemContext(new AdoStore(root), Number(argument));
    writeContextFiles(root, context);
    return context;
  }
  if (command === "search" && argument) return new Wiki(root).search(argument);
  throw new Error(USAGE);
}

try {
  const [command, argument] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(run(command, argument), null, 2) + "\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
