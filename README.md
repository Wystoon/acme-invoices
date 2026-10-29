# Acme Invoices (workshop demo)

Demo repository for the workshop **"Guardrails, Not Guidelines"**: *Turn your requests into guarantees for your AI coding agents*.

## For workshop attendees

**What this repository shows.** One AI coding agent, `acme-dev`, on the same small invoice service and the
same work items, in two setups. *Before*: one long prose agent that is asked to follow twenty rules (R1–R20).
*After*: each rule moved to the mechanism that actually enforces it: permissions, a deterministic MCP tool,
hooks, CI and a server-side push policy.

**Where to start**

1. [docs/RULES.md](docs/RULES.md): the twenty rules, where each one is enforced now, how to show it, and the
   honest limits.
2. The two configurations: [demo-configs/before](demo-configs/before) (the prose agent starts with
   [acme-dev.header.md](demo-configs/before/acme-dev.header.md)) and [demo-configs/after](demo-configs/after)
   (agents, skills, and [settings.json](demo-configs/after/.claude/settings.json) with the permissions and hooks).
3. The input the agent gets for work item 4821, built by the MCP tool:
   [4821.context.md](tools/acme-mcp/test/golden/4821.context.md). After the quick start,
   `node tools/acme-mcp/dist/cli.js context 4821` writes the same file to `.acme/out/4821/context.md`.
4. [docs/TRY-IT.md](docs/TRY-IT.md): run the agent demo yourself, level by level, with a clean Claude Code
   configuration, and repeat the measurements from the workshop.

**Explore without Claude Code** (after the quick start; the lines work the same in bash, zsh and PowerShell):

```bash
node tools/acme-mcp/dist/cli.js context 4821              # the MCP tool's function from the command line
node tools/acme-mcp/dist/cli.js search "migration down"   # wiki search with bounded output
node --test "tools/hooks/**/*.test.mjs"                  # the hook tests: every guard case, Bash and PowerShell
echo '{"tool_name":"Bash","tool_input":{"command":"git push origin main"}}' | node tools/hooks/guard-bash.mjs   # [R2] …
node scripts/ci.mjs                                       # every check CI runs
```

The MCP server and the CI checks are tool-agnostic; the hooks and permissions are Claude Code configuration.
For VS Code's agent mode (GitHub Copilot), [.vscode/mcp.json](.vscode/mcp.json) starts the same `acme` server
with the focused toolset. The hooks and permissions do not apply there.

**Support.** Scripts, hooks and CI are verified on macOS, Linux and Windows by [CI](.github/workflows/ci.yml).
The full agent demo is verified on macOS; on Linux and Windows it is best effort.

Everything here is fictional. "Acme", its people and its URLs (`*.acme.example`) do not exist, and the
values in `.env` and `secrets/` are fake on purpose.

## Quick start

macOS, Linux or Windows with Node 22+ (26 tested), the .NET 10 SDK and git (on Windows: Git for Windows);
Claude Code to try the agent demo. The commands are the same in bash, zsh and PowerShell:

```bash
git clone <this repository> $HOME/acme-invoices-demo
cd $HOME/acme-invoices-demo
node scripts/setup.mjs                # dependencies, a local bare remote with its policy, tag demo-start
node scripts/ci.mjs                   # every check, under a minute
node scripts/demo-mode.mjs after      # or: before | none; then start Claude Code in this folder
node scripts/demo-reset.mjs           # back to the starting state
```

`setup.mjs` creates the remote next to the clone (`<folder>-remote.git`) unless `ACME_REMOTE_DIR` says
otherwise:

| Shell | Command |
| --- | --- |
| bash, zsh (macOS, Linux) | `ACME_REMOTE_DIR=$HOME/elsewhere-remote.git node scripts/setup.mjs` |
| PowerShell (Windows) | `$env:ACME_REMOTE_DIR = "$HOME\elsewhere-remote.git"; node scripts/setup.mjs` |

To try the app itself: `dotnet run --project src/backend/Acme.Invoices.Api --launch-profile http` (API on
port 5080) and `npm --prefix src/frontend start` (UI on port 4200).

## Where things are

| Path | What |
| --- | --- |
| `src/backend`, `src/frontend` | The application the agent works on |
| `data/ado`, `docs/wiki` | Fake Azure DevOps work items and a fake engineering wiki |
| `tools/acme-mcp` | MCP server (focused and raw toolsets) and a CLI for the same functions |
| `tools/hooks`, `tools/ci` | Claude Code hooks and CI checks, with tests |
| `demo-configs/before`, `demo-configs/after` | The two agent setups; `demo-mode.mjs` copies one into place |
| `.vscode/mcp.json` | The same MCP server for VS Code's agent mode |
| `scripts` | Setup, mode switching, reset, demo preparation, repeated measurement runs, simulated PR merge, CI |

## Documentation

- [docs/RULES.md](docs/RULES.md): rules R1–R20, where each one is enforced, how to show it, honest limits
- [docs/TRY-IT.md](docs/TRY-IT.md): run the agent demo yourself with a clean Claude Code configuration, level by level, and repeat the measurements

## License

[MIT](LICENSE).
