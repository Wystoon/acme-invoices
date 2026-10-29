#!/usr/bin/env node
// PreToolUse hook for Bash and PowerShell (fails closed: if this script crashes, the command is blocked).
//
// This is a convenience guard, not the wall. A determined command can get past a pattern.
// The walls are permissions, the server-side pre-receive hook and CI.
//
// It splits the command at &&, ||, ;, | and newlines and checks each part on its own. PowerShell commands
// get the same rules, with PowerShell quoting, cmdlets and their aliases, and case-insensitive names and paths.
import { execFileSync } from "node:child_process";
import { basename, isAbsolute, resolve } from "node:path";
import { block, debug, readInput, repoRoot } from "./lib/hook-io.mjs";

const MESSAGES = {
  R2: "Direct pushes to main are blocked. Create a branch feature/<id>-<slug> (or bugfix/<id>-<slug>), push it with git push -u origin <branch>, and open a pull request.",
  R3: "Force-push is not allowed. Push a new commit on top instead; if your branch is behind, merge main into it.",
  R3b: "Push options are not allowed. Push without -o/--push-option.",
  R4: "Secrets are not readable from this session (.env files and secrets/). Ask the user for the value you need.",
  R16: "Production is never called from a dev machine. Use the stubbed development services, for example the exchange-rate stub.",
  GUARD: "Agent configuration (.claude/, tools/hooks/, .mcp.json, CLAUDE.md) and the git remote are managed by the platform team (@acme/dev-platform). Leave them unchanged and tell the user what you would change.",
  GIT_WRITES_FILE: "Git commands may not write files (--output, format-patch -o/--output-directory); print to stdout instead.",
};
// Findings reported under another rule's ID.
const RULE_IDS = { GIT_WRITES_FILE: "GUARD" };

// ".env", ".env.local", "src/.env" or "secrets/..." — but not "environment.ts" or "security-and-secrets.md".
const SECRET_PATH = /(^|[^\w.-])(\.env(\.[\w.-]+)?($|[^\w.-])|secrets[\\/])/;
const SECRET_FOLDER = /^((\.[\\/])?secrets|user-secrets)$/;
const PRODUCTION = /\bprod[\w-]*\.acme\.example|(^|[^\w.-])invoices\.acme\.example|\bACME_PROD_\w*/;
const PROTECTED = /^(\.[\\/])?(\.claude([\\/]|$)|tools[\\/]hooks([\\/]|$)|\.mcp\.json$|CLAUDE\.md$)/;
const GIT_PROGRAM = /(^|[\\/])git(\.exe)?$/;
// "&" is PowerShell's call operator: `& git push`, `& 'C:\Program Files\Git\cmd\git.exe' push`.
const COMMAND_PREFIXES = new Set(["sudo", "env", "command", "time", "nohup", "&"]);
// Global git options whose value is the next word (`git -C <dir> push`, `git --git-dir .git push`).
const GIT_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix"]);
const WRITE_COMMANDS = new Set(["tee", "mv", "rm", "rmdir", "chmod", "chown", "touch", "ln", "truncate", "install", "rsync"]);
// PowerShell aliases and built-in functions for the cmdlets below (Windows PowerShell 5.1 and PowerShell 7).
const POWERSHELL_ALIASES = {
  ac: "add-content", sc: "set-content", clc: "clear-content", ni: "new-item", md: "new-item", mkdir: "new-item",
  rm: "remove-item", ri: "remove-item", del: "remove-item", erase: "remove-item", rd: "remove-item", rmdir: "remove-item",
  mv: "move-item", mi: "move-item", move: "move-item", ren: "rename-item", rni: "rename-item",
  cp: "copy-item", cpi: "copy-item", copy: "copy-item", tee: "tee-object",
};
// Cmdlets that write, create, delete or move every path they are given.
const POWERSHELL_WRITES = new Set(["set-content", "add-content", "clear-content", "out-file", "new-item", "remove-item", "move-item", "rename-item", "tee-object"]);
const COPY_ITEM_SWITCHES = ["recurse", "force", "container", "passthru", "whatif", "confirm", "verbose", "debug"];

let cachedRemote; // the remote's folder, looked up once per run

const input = readInput();
const powershell = input.tool_name === "PowerShell";
const command = String(input.tool_input?.command ?? "");
const cwd = input.cwd ?? repoRoot(input);
const root = repoRoot(input);
// PowerShell command names and Windows paths are case-insensitive.
const caseInsensitive = powershell || process.platform === "win32";
const [secretPath, secretFolder, production, protectedPath, gitProgram] = [SECRET_PATH, SECRET_FOLDER, PRODUCTION, PROTECTED, GIT_PROGRAM].map(
  (pattern) => (powershell ? new RegExp(pattern.source, "i") : pattern),
);
const rootPrefix = rootPrefixPattern(root);

for (const segment of normalize(command).split(/&&|\|\||;|\||\r?\n/)) {
  const finding = check(segment.replace(/\s+/g, " ").trim());
  if (finding) {
    debug("guard-bash", { finding, command: command.slice(0, 200) }, root);
    block(RULE_IDS[finding] ?? finding, MESSAGES[finding]);
  }
}
process.exit(0);

/** PowerShell continues a line with a backtick at its end, and accepts typographic quotes as quotes. */
function normalize(text) {
  if (!powershell) return text;
  return text.replace(/`\r?\n/g, " ").replace(/[‘’‚‛]/g, "'").replace(/[“”„]/g, '"');
}

function check(segment) {
  if (segment === "") return null;
  const words = shellWords(segment.replace(rootPrefix, ""));

  if (touchesRemote(segment, words)) return "GUARD";
  const git = gitCommand(shellWords(segment));
  if (git && writesFile(git)) return "GIT_WRITES_FILE";
  if (git?.subcommand === "push") {
    const rule = checkPush(git);
    if (rule) return rule;
  }
  if (secretPath.test(segment) || words.flatMap(argValues).some((value) => secretFolder.test(value))) return "R4";
  if (production.test(segment)) return "R16";
  if (writesProtectedPath(segment, words)) return "GUARD";
  return null;
}

function checkPush({ args, globalArgs }) {
  const options = args.filter((arg) => arg.startsWith("-"));
  const positionals = args.filter((arg, i) => !arg.startsWith("-") && !["-o", "--push-option"].includes(args[i - 1]));

  if (options.some((o) => o === "-o" || o.startsWith("--push-option"))) return "R3b";
  if (
    options.some((o) => o === "--force" || o.startsWith("--force-with-lease") || o === "--force-if-includes" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(o)) ||
    positionals.slice(1).some((refspec) => refspec.startsWith("+"))
  ) {
    return "R3";
  }
  if (options.some((o) => o === "--all" || o === "--mirror")) return "R2";

  const refspecs = positionals.slice(1);
  if (refspecs.some((refspec) => ["main", "refs/heads/main"].includes(refspec.split(":").at(-1)))) return "R2";
  if (refspecs.length === 0 && currentBranch(globalArgs) === "main") return "R2";
  return null;
}

/**
 * `git log/diff/show --output=<file>` and `git format-patch -o <dir>` write files that the Edit deny rules
 * never see, e.g. over .claude/settings.json, and allow rules such as `Bash(git log *)` approve them.
 */
function writesFile({ subcommand, args }) {
  if (args.some((arg) => arg === "--output" || arg.startsWith("--output="))) return true;
  return subcommand === "format-patch" && args.some((arg) => /^-o/.test(arg) || /^--output-directory(=|$)/.test(arg));
}

/** Parses `[VAR=value] [sudo|env|&|...] git [global options] <subcommand> args...`, or returns null. */
function gitCommand(words) {
  let start = 0;
  while (start < words.length && (/^\w+=/.test(words[start]) || COMMAND_PREFIXES.has(words[start]))) start++;
  if (!gitProgram.test(words[start] ?? "")) return null;
  const globalArgs = [];
  let i = start + 1;
  while (i < words.length && words[i].startsWith("-")) {
    const length = GIT_OPTIONS_WITH_VALUE.has(words[i]) ? 2 : 1;
    globalArgs.push(...words.slice(i, i + length));
    i += length;
  }
  return { subcommand: words[i], args: words.slice(i + 1), globalArgs };
}

/** The branch the command would push from, using the command's own -C/--git-dir options. */
function currentBranch(globalArgs) {
  try {
    return execFileSync("git", [...globalArgs, "symbolic-ref", "--short", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null; // detached HEAD or not a repository: git push decides
  }
}

/** update-ref anywhere, or any mention of the remote's folder (also through --git-dir), with / and \ alike. */
function touchesRemote(segment, words) {
  if (words.includes("update-ref")) return true;
  const remote = remotePath();
  if (remote === null) return false;
  const fold = (text) => (caseInsensitive ? text.toLowerCase() : text).replaceAll("\\", "/");
  return fold(segment).includes(fold(remote)) || fold(segment).includes(fold(basename(remote)));
}

function remotePath() {
  if (cachedRemote !== undefined) return cachedRemote;
  try {
    const url = execFileSync("git", ["config", "--get", "remote.origin.url"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const path = url.replace(/^file:\/\//, "");
    cachedRemote = /^[a-z]+:\/\//i.test(path) || path === "" ? null : isAbsolute(path) ? path : resolve(root, path);
  } catch {
    cachedRemote = null;
  }
  return cachedRemote;
}

function writesProtectedPath(segment, words) {
  const redirect = /(^|[^>])>>?\s*["']?([^\s"']+)/g;
  for (const match of segment.replace(rootPrefix, "").matchAll(redirect)) {
    if (protectedPath.test(match[2])) return true;
  }
  const program = powershell ? cmdletName(words[0] ?? "") : words[0];
  if (powershell && POWERSHELL_WRITES.has(program)) return words.slice(1).flatMap(argValues).some((value) => protectedPath.test(value));
  if (powershell && program === "copy-item") return copyItemDestinations(words.slice(1)).some((value) => protectedPath.test(value));

  const targets = words.slice(1).filter((word) => !word.startsWith("-"));
  if (WRITE_COMMANDS.has(program)) return targets.some((word) => protectedPath.test(word));
  if (program === "cp") return protectedPath.test(targets.at(-1) ?? "");
  if ((program === "sed" || program === "perl") && words.some((word) => /^-[a-zA-Z]*i/.test(word))) {
    return targets.some((word) => protectedPath.test(word));
  }
  return false;
}

/** `Remove-Item`, `Microsoft.PowerShell.Management\Remove-Item` and `del` all become "remove-item". */
function cmdletName(word) {
  const name = word.toLowerCase().replace(/^microsoft\.powershell\.[\w.]+\\/, "");
  return POWERSHELL_ALIASES[name] ?? name;
}

/** The paths in one PowerShell argument: `-Path:a,b` and `a,b` are both ["a", "b"]. Bash words stay whole. */
function argValues(word) {
  if (!powershell) return [word];
  return (/^-[\w-]+:(.*)$/.exec(word)?.[1] ?? word).split(",");
}

/** Where Copy-Item writes: the -Destination value, or every positional path after the source. */
function copyItemDestinations(args) {
  const destinations = [];
  const positionals = [];
  let pathNamed = false;
  for (let i = 0; i < args.length; i++) {
    const option = /^-([\w-]+)(?::(.*))?$/.exec(args[i]);
    if (!option) {
      positionals.push(...argValues(args[i]));
      continue;
    }
    const name = option[1].toLowerCase();
    const isSwitch = !(name.length >= 3 && "destination".startsWith(name)) && COPY_ITEM_SWITCHES.some((s) => s.startsWith(name));
    const value = option[2] ?? (isSwitch ? undefined : args[++i]);
    if (name.length >= 3 && "destination".startsWith(name)) destinations.push(...argValues(value ?? ""));
    else if ((name.length >= 3 && "path".startsWith(name)) || "literalpath".startsWith(name) || ["pspath", "lp"].includes(name)) pathNamed = true;
  }
  return [...destinations, ...(pathNamed ? positionals : positionals.slice(1))];
}

/** Matches the repository's absolute path followed by a separator, with / and \ interchangeable. */
function rootPrefixPattern(path) {
  const escaped = path.replace(/[\\/]+$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped.replace(/\\\\|\//g, "[\\\\/]")}[\\\\/]`, caseInsensitive ? "gi" : "g");
}

/**
 * Splits a command into words like the shell would for quoting: '...' and "..." stay one word. The escape
 * character is \ in Bash and ` in PowerShell, where \ is an ordinary character and '' inside '...' is a quote.
 */
function shellWords(text) {
  const escape = powershell ? "`" : "\\";
  const words = [];
  let word = "";
  let quote = null;
  let started = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (powershell && char === quote && text[i + 1] === quote) word += text[++i];
      else if (char === quote) quote = null;
      else if (char === escape && quote === '"' && i + 1 < text.length) word += text[++i];
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === escape && i + 1 < text.length) {
      word += text[++i];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) words.push(word);
      word = "";
      started = false;
    } else {
      word += char;
      started = true;
    }
  }
  if (started) words.push(word);
  return words;
}
