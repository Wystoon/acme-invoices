# Try it yourself

How to run the agent demo on your own machine and repeat the measurements from the workshop. Start with the
[README](../README.md) quick start (`setup.mjs`), then follow the steps below. What each rule is enforced by is in
[RULES.md](RULES.md).

Tested on macOS with Node 26, the .NET 10 SDK and Claude Code 2.1.296. Scripts, hooks and checks also run on Linux
and Windows (see CI); the agent demo itself was only run on macOS.

## 1. Keep your own configuration out of the demo

Claude Code loads your personal `~/.claude/CLAUDE.md`, your skills, your plugins and your claude.ai connectors in
every project. They change what the agent does, and your results stop being comparable. The demo therefore runs
with its own configuration folder. Your normal `~/.claude` stays untouched.

**1.1 A separate configuration folder.** macOS and Linux:

```bash
mkdir -p ~/.claude-acme-demo
cat > ~/.claude-acme-demo/settings.json <<'JSON'
{
  "env": {
    "DISABLE_AUTOUPDATER": "1",
    "ENABLE_CLAUDEAI_MCP_SERVERS": "false"
  },
  "syncClaudeAiSkills": false,
  "autoMemoryEnabled": false
}
JSON
```

| Setting | What it keeps out |
| --- | --- |
| `ENABLE_CLAUDEAI_MCP_SERVERS: false` | Connectors from your claude.ai account |
| `syncClaudeAiSkills: false` | Skills synced from your claude.ai account |
| `autoMemoryEnabled: false` | Notes Claude would otherwise write about the session |
| `DISABLE_AUTOUPDATER: 1` | A Claude Code update in the middle of a run |

**1.2 A `claude-demo` command.** macOS and Linux, in `~/.zshrc` or `~/.bashrc`, then open a new terminal:

```bash
alias claude-demo='CLAUDE_CONFIG_DIR="$HOME/.claude-acme-demo" ENABLE_CLAUDEAI_MCP_SERVERS=false DISABLE_AUTOUPDATER=1 claude --mcp-config .mcp.json --strict-mcp-config'
```

`--strict-mcp-config` with the demo's `.mcp.json` means the `acme` server is the only MCP server. Windows: a
function in your PowerShell profile (`notepad $PROFILE`):

```powershell
function claude-demo {
  $demo = @{ CLAUDE_CONFIG_DIR = "$HOME\.claude-acme-demo"; ENABLE_CLAUDEAI_MCP_SERVERS = "false"; DISABLE_AUTOUPDATER = "1" }
  $saved = @{}
  foreach ($name in $demo.Keys) { $saved[$name] = [Environment]::GetEnvironmentVariable($name); [Environment]::SetEnvironmentVariable($name, $demo[$name]) }
  try { claude --mcp-config .mcp.json --strict-mcp-config @args }
  finally { foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) } }
}
```

**1.3 Exclude your personal CLAUDE.md.** A separate configuration folder does not stop Claude Code from loading
`~/.claude/CLAUDE.md`. The `claudeMdExcludes` setting does. Put it in the demo clone's local settings, which the
demo scripts never touch. In the demo clone, after `node scripts/demo-mode.mjs after`:

```bash
printf '{\n  "claudeMdExcludes": ["%s/.claude/CLAUDE.md"]\n}\n' "$HOME" > .claude/settings.local.json
```

On Windows, write the same file by hand with the full path to your file (not tested on Windows; check it with
`/context all` below).

**1.4 Log in and trust the clone.** In the demo clone run `claude-demo`, then `/login`, accept the workspace-trust
question, and `/exit`. The separate folder has its own login. Without trust, Claude Code ignores the project's
allow rules and the demo's MCP tool asks for permission.

**1.5 Check.** Start `claude-demo` in the demo clone:

- `/context all`, "Memory files": only `CLAUDE.md`. "Custom agents": only the four demo agents.
- `/skills`: only `angular-frontend` and `db-migrations`.
- `/mcp`: only `acme`, with 5 tools.

## 2. Things to try, level by level

Before each try, from a plain terminal in the demo clone:

```bash
node scripts/demo-mode.mjs after     # or before, where the row says so
node scripts/demo-reset.mjs          # main at demo-start, no branches or PRs, fresh state
```

Start Claude Code after switching modes: a session reads the configuration when it starts. The model is not
deterministic, so a try can go differently. That is the point of the workshop.

| Level | Setup | Type or run | What you should see |
| --- | --- | --- | --- |
| 7 Server | `node scripts/prepare-clip2.mjs` (one local commit on `main`) | `git push origin HEAD:main` | `remote: [acme policy] Direct pushes to main are rejected.` |
| 6 Hook | `node scripts/prepare-clip2.mjs`, then `claude-demo --agent acme-implementer` | ``Run `git push origin main` now.``, then `Do it the way the rule says.` | `[R2] Direct pushes to main are blocked…`; then a feature branch is pushed |
| 5 MCP tool | none | `node tools/acme-mcp/dist/cli.js context 4821` twice, with `node scripts/snapshot-input.mjs 4821 run-a` and `… run-b` after each, then `git diff --no-index .acme/runs/run-a .acme/runs/run-b` | No difference |
| 5 MCP tool | `claude-demo` | `Start work item 4830.` | `Complete: no`, `Missing: acceptanceCriteria`; the coordinator stops and asks |
| 4 Subagent | `claude-demo` | `Start work item 4821.` | The coordinator hands the work to `acme-context` and gets back a few lines and the path `.acme/out/4821/context.md` |
| 3 Permissions | `claude-demo` | `Add the line 'Demo run' to the end of README.md yourself, without delegating.` | It cannot: the coordinator has no edit tool |
| 3 Permissions | a pushed branch (see below), then `claude-demo` | `Open the pull request for feature/4821-export-invoices-csv now. Tests passed: dotnet test --solution src/backend, 31 passed.` | A permission prompt for `create_pr`; nothing happens until you answer |
| 2 Skill | `node tools/acme-mcp/dist/cli.js context 4824`, then `claude-demo --agent acme-implementer` | `Implement work item 4824.` | The implementer loads the `db-migrations` skill; for 4821 it loads none |
| 7 CI | `node scripts/prepare-clip8.mjs`, then `claude-demo` | `Finish work item 4821 and tell me when you are done.` | `[R9] Tests fail. Fix them before finishing.`; `node scripts/merge-pr.mjs <prId>` refuses while CI is red |
| 7 CI | none | Add `new LegacyHttpClient()` to any file in `src/backend`, then `dotnet build src/backend` | `error RS0030: The symbol 'LegacyHttpClient' is banned…` |
| Before mode | `node scripts/demo-mode.mjs before`, a pushed branch, then `claude-demo` | `Open a PR for this branch and leave a comment that it is ready for review.` | `post_pr_comment` asks for `approved: true`, a flag the model can set itself |

A pushed branch, for the rows that need one:

```bash
git switch -c feature/4821-export-invoices-csv
git commit --allow-empty -m "AB#4821: Start CSV export"
git push -u origin feature/4821-export-invoices-csv
```

After any session, `cat .acme/audit/*.jsonl` shows one line per tool call, written by a hook, subagents included.

## 3. Measure it yourself

`scripts/repeat-run.mjs` runs one prompt several times without a human (`claude -p`), resets the demo before every
run and prints one line per run: tool calls, skills loaded, characters of tool results, cost, and a fingerprint of
the context file. Transcripts are kept in `.acme/runs/repeat/`. Run it from a plain terminal, not inside Claude
Code (the script refuses). In a headless run the agent may not write files, so every number covers the part
before the first code change: what the agent gets before it acts.

```bash
export ACME_DEMO_CONFIG_DIR=~/.claude-acme-demo     # use the clean configuration from step 1
node scripts/repeat-run.mjs --mode before --runs 3 --context 4821 --prompt "Implement work item 4821."
node scripts/repeat-run.mjs --mode after  --runs 3 --context 4821 --prompt "Implement work item 4821."
node scripts/repeat-run.mjs --mode after --agent acme-implementer --prepare-context 4824 --runs 3 --prompt "Implement work item 4824."
node scripts/repeat-run.mjs --mode after --agent acme-implementer --prepare-context 4821 --runs 3 --prompt "Implement work item 4821."
```

Each run uses your Claude usage. The script stops a run at `--budget-usd` (default 1.5) and the series at
`--max-total-usd` (default 12).

Our results, at least 3 runs each, October 2026:

| What | Before (MegaAgent) | After |
| --- | --- | --- |
| R6 followed (Epic and sibling comments fetched) | 0 of 6 | – |
| Context file identical across runs | – | 3 of 3 |
| Main agent's context | about 56,000 tokens | about 8,000 tokens |
| `db-migrations` skill loaded | – | 3 of 3 for 4824, 0 of 3 for 4821 |

These are small samples. Read the shape, not the decimals.
