#!/usr/bin/env node
// Debug hook: writes each hook input to .acme/debug/<event>-<n>.json so the real
// payloads can be inspected. Register it on any event; it never blocks.
// Not part of any demo configuration.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(0, "utf8");
let input;
try {
  input = JSON.parse(raw);
} catch {
  input = { unparsed: raw };
}

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const event = input.hook_event_name ?? "unknown";
const dir = join(root, ".acme", "debug");
mkdirSync(dir, { recursive: true });

// Names only: some CLAUDE_* variables carry session tokens. CLAUDE_PROJECT_DIR is the
// one value worth seeing (it shows whether ${CLAUDE_PROJECT_DIR} reached the hook).
const env = {
  CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? null,
  names: Object.keys(process.env).filter((key) => key.startsWith("CLAUDE")).sort(),
};
const record = { input, argv: process.argv.slice(1), env };

// "wx" fails if the file exists, so parallel hooks never overwrite each other.
for (let n = 1; ; n++) {
  try {
    writeFileSync(join(dir, `${event}-${n}.json`), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
    break;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
