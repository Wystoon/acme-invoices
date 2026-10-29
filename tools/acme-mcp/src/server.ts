import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFocusedTools } from "./tools/focused.js";
import { registerRawTools } from "./tools/raw.js";

export type Toolset = "focused" | "raw";

export function parseToolset(value: string | undefined): Toolset {
  if (value === undefined || value === "" || value === "focused") return "focused";
  if (value === "raw") return "raw";
  throw new Error(`ACME_TOOLSET must be "focused" or "raw", not "${value}".`);
}

/** The repository root: set by Claude Code for MCP servers, otherwise the working directory. */
export function repoRoot(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

export function createServer(toolset: Toolset, root: string): McpServer {
  const server = new McpServer({ name: "acme", version: "1.0.0" });
  if (toolset === "focused") registerFocusedTools(server, root);
  else registerRawTools(server, root);
  return server;
}
