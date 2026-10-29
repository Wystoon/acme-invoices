#!/usr/bin/env node
// Switches the agent setup: node scripts/demo-mode.mjs none|before|after
// Replaces the root CLAUDE.md, .mcp.json and .claude/ with demo-configs/<mode>/ (keeping
// .claude/settings.local.json). In before mode it also generates the MegaAgent. All of these are gitignored.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { refuseInsideAgent, repoRoot, step } from "./lib/common.mjs";
import { renderMegaAgent } from "./lib/mega-agent.mjs";

const MODES = ["none", "before", "after"];

export function applyMode(mode) {
  if (!MODES.includes(mode)) throw new Error(`Unknown mode "${mode}". Use one of: ${MODES.join(", ")}.`);
  const claudeDir = join(repoRoot, ".claude");
  const localSettings = join(claudeDir, "settings.local.json");
  const keptLocal = existsSync(localSettings) ? readFileSync(localSettings) : null;

  step(`Switching to mode "${mode}"`);
  for (const path of ["CLAUDE.md", ".mcp.json", ".claude"]) rmSync(join(repoRoot, path), { recursive: true, force: true });

  if (mode !== "none") {
    const source = join(repoRoot, "demo-configs", mode);
    cpSync(join(source, ".claude"), claudeDir, { recursive: true });
    const settingsFile = join(claudeDir, "settings.json");
    if (existsSync(settingsFile)) {
      const settings = expandRepoRoot(JSON.parse(readFileSync(settingsFile, "utf8")), repoRoot);
      writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
    }
    cpSync(join(source, ".mcp.json"), join(repoRoot, ".mcp.json"));
    if (existsSync(join(source, "CLAUDE.md"))) cpSync(join(source, "CLAUDE.md"), join(repoRoot, "CLAUDE.md"));
    if (mode === "before") {
      mkdirSync(join(claudeDir, "agents"), { recursive: true });
      const megaAgent = renderMegaAgent(repoRoot);
      writeFileSync(join(claudeDir, "agents", "acme-dev.md"), megaAgent);
      console.log(`  generated .claude/agents/acme-dev.md (${megaAgent.split("\n").length - 1} lines)`);
    }
  }
  if (keptLocal) {
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(localSettings, keptLocal);
    console.log("  warning: kept .claude/settings.local.json; it can change permissions in every mode");
  }

  mkdirSync(join(repoRoot, ".acme", "state"), { recursive: true });
  writeFileSync(join(repoRoot, ".acme", "state", "mode"), `${mode}\n`);
  console.log(`  mode is now "${mode}". Restart Claude Code in this folder.`);
}

/**
 * Allow rules such as `Bash(git -C {{REPO_ROOT}} status *)` name this clone's absolute path, so the only
 * wildcard stays at the end (a `*` in the middle would also match other git subcommands). Bash rules match
 * the command as written, and on Windows the Bash tool is Git Bash, where the same folder can be written
 * C:\…, C:/… or /c/…; each rule is written in all three forms there.
 */
export function expandRepoRoot(settings, root, platform = process.platform) {
  const forms = platform === "win32" ? [root, root.replaceAll("\\", "/"), root.replace(/^([A-Za-z]):[\\/]/, (_, drive) => `/${drive.toLowerCase()}/`).replaceAll("\\", "/")] : [root];
  const expand = (rule) => (rule.includes("{{REPO_ROOT}}") ? [...new Set(forms)].map((form) => rule.replaceAll("{{REPO_ROOT}}", form)) : [rule]);
  const expanded = settings.permissions?.allow ? { ...settings, permissions: { ...settings.permissions, allow: settings.permissions.allow.flatMap(expand) } } : settings;
  if (JSON.stringify(expanded).includes("{{REPO_ROOT}}")) throw new Error("{{REPO_ROOT}} is only supported in permissions.allow.");
  return expanded;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  refuseInsideAgent();
  try {
    applyMode(process.argv[2]);
  } catch (error) {
    console.error(`✖ ${error.message}\nUsage: node scripts/demo-mode.mjs none|before|after`);
    process.exit(1);
  }
}
