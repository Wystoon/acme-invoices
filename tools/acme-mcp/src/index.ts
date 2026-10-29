#!/usr/bin/env node
// stdio entry point for Claude Code (.mcp.json). ACME_TOOLSET selects "focused" (default) or "raw".
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, parseToolset, repoRoot } from "./server.js";

const server = createServer(parseToolset(process.env.ACME_TOOLSET), repoRoot());
await server.connect(new StdioServerTransport());
