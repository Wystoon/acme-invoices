# Rules R1–R20: where each one is enforced

Workshop: **"Guardrails, Not Guidelines"**, *Turn your requests into guarantees for your AI coding agents*.

Every rule of the before-mode MegaAgent (`demo-configs/before/acme-dev.header.md`) moved down the
determinism ladder to the level that actually enforces it. The higher the level, the less the result
depends on the model choosing to comply.

| Level | Mechanism | What it gives |
| --- | --- | --- |
| 1 | Prose instructions (CLAUDE.md, agent body) | A request, paid for on every step |
| 2 | Skill | A request, loaded only when the task needs it |
| 3 | Tool allow-list and permissions | The agent cannot even attempt it |
| 4 | Subagent with a contract | Own context, small job, fixed output |
| 5 | MCP tool with structured, bounded output | The same input on every run |
| 6 | Hook | Runs on every event, can block or rewrite |
| 7 | Tests and CI / server-side policy | Checks the result, cannot be talked around |

## Traceability

Commands run in the demo clone after `node scripts/demo-mode.mjs after` (unless the row says before).
Prompts are typed into `claude-demo`, Claude Code with a clean configuration (see [TRY-IT.md](TRY-IT.md)).

| Rule | Main level | Backstop | Where in this repo | How to show it |
| --- | --- | --- | --- | --- |
| R1 Read entire wiki | **Delete** → 5 | 2 | `search_wiki`, `get_wiki_section`; skills carry the relevant parts | `node tools/acme-mcp/dist/cli.js search "migration down"`; compare with `wc -c docs/wiki/*.md` (86k characters the MegaAgent was told to read first) |
| R2 No push to main | 6 | 7 | `tools/hooks/guard-bash.mjs`; remote `pre-receive` | `claude-demo --agent acme-implementer`: "Run \`git push origin main\` now." → `[R2] Direct pushes to main are blocked…`. In a terminal: `git push origin HEAD:main` → `remote: [acme policy] …` |
| R3 No force-push | 6 | 7 | `guard-bash.mjs`; `receive.denyNonFastForwards` + `pre-receive` | `node --test tools/hooks/test/guard-bash.test.mjs` (R3 cases); in a terminal, amend a pushed commit and `git push --force` → `remote: [acme policy] Force-push … is rejected` |
| R4 No .env / secrets | 3 | 6 | `permissions.deny Read(./.env)`, `Read(./.env.*)`, `Read(./secrets/**)`; `guard-bash.mjs` for shell reads | Ask the coordinator to read `.env` → permission denial; have the implementer run `cat .env` → `[R4] Secrets are not readable…`. The point of the mechanism is proof and the unwatched run, not that the model is bad: a prose-only agent often leaves the file alone too. A recursive `grep` still reads it (Honest limits) |
| R5 No work item writes | 3 | 4 | Focused toolset has no write tools; coordinator has no MCP tools | `/mcp` in after mode lists five `acme` tools, none of them writes; before mode (`demo-mode.mjs before`) offers `create_work_item` and `update_work_item` |
| R6 Fetch parents, siblings, comments | 5 | none | `get_work_item_context` | "Start work item 4821." → `.acme/out/4821/context.md` with "Parents", "Siblings (20 of 34)", "Comments (10 of 12, newest first)". The before-mode agent skipped the Epic and the sibling comments in 6 of 6 runs |
| R7 No AC → stop | 5 | 1 | `complete`/`missing` fields; coordinator prompt says stop | "Start work item 4830." → `Complete: no`, `Missing: acceptanceCriteria`, the coordinator stops and asks |
| R8 Format after edit | 6 | 7 | Implementer PostToolUse `format-file.mjs`; CI format checks | Let the implementer write a one-line C# class → the file on disk is reformatted; `node scripts/ci.mjs` runs `dotnet csharpier check .` and `format:check` |
| R9 Tests before done | 6 | 7 | Implementer Stop → `tests-before-stop.mjs`; CI | After `node scripts/prepare-clip8.mjs`: "Finish work item 4821 and tell me when you are done." The implementer is sent back with the failing output, at most 3 times, then `[R9] Implementer stopped with failing tests after 3 attempts. Do not open a PR.`; `node scripts/merge-pr.mjs <id>` then refuses on red |
| R10 Migration guide | 2 | 7 | `db-migrations` skill; `tools/ci/check-migrations.mjs` | The implementer loads `db-migrations` for 4824 (3 of 3 headless runs) and no skill for 4821 (3 of 3), measured up to the first code change (headless runs can't write files). The backstop: `node tools/ci/check-migrations.mjs`; `node --test tools/ci/test/check-migrations.test.mjs` (empty `Down()`, unmarked `DropColumn`) |
| R11 Angular style guide | 2 | 7 (partly) | `angular-frontend` skill; eslint rules | `npm --prefix src/frontend run lint`; remove `changeDetection` from a component → `prefer-on-push-component-change-detection` error |
| R12 No Acme.LegacyHttp | 7 | none | BannedApiAnalyzers, RS0030 as error | Add a `new LegacyHttpClient()` anywhere in `src/backend` → `error RS0030` ends the build output |
| R13 PR links work item + template | 5 | 7 | `create_pr` required params + template; `check-pr.mjs` in `merge-pr.mjs` | `create_pr` without `testEvidence` or with `sourceBranch: main` → tool error; `node scripts/merge-pr.mjs <id>` on a raw-mode PR → `[R13] … no work item linked` |
| R14 No PR comment without approval | 3 | 4 | `ask` permission on `post_pr_comment` (and `create_pr`); only the publisher has the tools | After mode: `create_pr` and `post_pr_comment` stop at a permission prompt every time. Before mode: the model can set `approved: true` itself |
| R15 Audit log | 6 | none | `tools/hooks/audit.mjs` (PostToolUse and PostToolUseFailure) | After any session: `cat .acme/audit/*.jsonl`: one line per tool call, subagent calls included, with `agent_type` and `target` |
| R16 Never call production | 3 | 6 | `WebFetch`/`WebSearch` denied, no real prod credentials, `guard-bash.mjs` R16 | Have the implementer run `curl https://api.prod.acme.example/invoices` → `[R16] Production is never called from a dev machine…` |
| R17 Be concise | 1 | none | CLAUDE.md | Read `demo-configs/after/CLAUDE.md` (16 lines) |
| R18 Conflicts → safer | 1 | none | CLAUDE.md | Same file |
| R19 Max 5 searches | 1 | none | CLAUDE.md. A hook counting `search_wiki` calls would be possible, but it is not worth it: a sixth search costs little and blocking it helps nobody | Same file |
| R20 Re-read this file | **Delete** | none | Nothing: the file is already in context | Before mode: `wc -l .claude/agents/acme-dev.md` (1,572 lines, re-sent on every step) |

## What else is enforced

- **The coordinator cannot escape its helpers.** `acme-dev` may spawn only `acme-context`, `acme-implementer` and
  `acme-publisher` (`tools: Agent(...)`), and `permissions.deny` also blocks every built-in agent type
  (`Agent(general-purpose)`, `Agent(Explore)`, `Agent(Plan)`, `Agent(claude)`, `Agent(statusline-setup)`,
  `Agent(claude-code-guide)`, `Agent(fork)`). Both were tested: the deny rules hold even with the coordinator removed.
- **Agent configuration is off limits to the agent.** `Edit(./.claude/**)`, `Edit(./tools/hooks/**)`, `Edit(./.mcp.json)`,
  `Edit(./CLAUDE.md)` are denied, and `guard-bash.mjs` blocks shell writes to them (rule `GUARD`). `CODEOWNERS` assigns
  them to `@acme/dev-platform`.

## Honest limits

- **The guard is pattern-based.** `guard-bash.mjs` is a convenience guard, not the wall: it does not look inside
  `bash -c "…"`, `eval`, scripts, aliases or variables (`git push origin $B`), and it does not model push
  configuration such as `push.default=matching`. The walls are the permissions, the server-side `pre-receive` hook and CI.
- **PowerShell is guarded by patterns too.** The same hook runs for Claude Code's PowerShell tool and applies the
  same rules to cmdlets, their aliases, `\` paths and any letter case. It does not look inside `Invoke-Expression`
  (`iex`), `Start-Process`, `cmd /c "…"`, script blocks, .NET calls such as `[IO.File]::WriteAllText(…)` or
  variables (`$p = '.claude'`). The permission layer for PowerShell is its own rules
  (`PowerShell(git push --force *)`, `PowerShell(git push -f *)`); the Bash allow rules do not apply to it, so
  PowerShell commands ask for approval.
- **On Windows the PowerShell tool stays on in after mode.** With Git Bash installed, Bash deny rules alone switch
  Claude Code's PowerShell tool off for the session; a `PowerShell(…)` rule switches it back on. That is why the
  guard matches `Bash|PowerShell`. No after-mode agent lists PowerShell in its tools: the implementer runs commands
  through Bash, which on Windows is Git Bash, so the agent demo there needs Git for Windows.
- **Windows paths in allow rules are a best guess.** Bash rules match the command as written. On Windows,
  `demo-mode.mjs` writes each `git -C <clone>` rule in three forms (`C:\…`, `C:/…`, `/c/…`). This was not checked
  with Claude Code on Windows; a form it misses costs a permission prompt, not a gap.
- **Case-insensitive file systems.** On Windows (and on macOS by default) `cat .ENV` reads `.env`. The guard's
  PowerShell patterns ignore case; its Bash patterns do not.
- **An untrusted clone loses its allow rules.** Claude Code applies the `permissions.allow` rules of a project's
  `.claude/settings.json` only after the folder's workspace-trust dialog has been accepted; `deny` and `ask` rules
  apply at once, and `claude -p` never shows the dialog. In an untrusted clone, the allow-listed
  `get_work_item_context` was refused as "not granted yet". It fails safe (fewer tools, more prompts), but it
  looks like a broken demo. [TRY-IT.md](TRY-IT.md) makes trusting the demo clone a step of its own.
- **Windows and Linux are verified by CI, not by a session.** Setup, scripts, hooks and every check run on Linux
  and Windows in the CI matrix; the agent demo itself was run only on macOS.
- **Found and fixed: an allow rule that could switch the hooks off.** `Bash(git log *)` and `Bash(git diff *)`
  (and their `git -C <repo>` forms) also approved `--output=<file>`. An agent could overwrite
  `.claude/settings.json` without a prompt: settings reload while the session runs, and the `Edit` deny rules
  do not cover the shell. `guard-bash.mjs` now blocks `--output` on any git command and
  `format-patch -o`/`--output-directory` (`[GUARD] Git commands may not write files…`).
  Allow rules are reviewed like code.
- **A recursive search reads `.env` without naming it.** `grep -rn PASSWORD .` prints the `.env` line in after mode;
  neither the `Read` deny rule nor a name-based pattern sees it. Claude Code's Bash sandbox would close this, but it
  was tested and not used: inside it, `dotnet restore`/`build` with several MSBuild nodes and `dotnet test` hang.
- **No network allowlist for shell commands.** R16 rests on denying `WebFetch`/`WebSearch`, the guard's host and
  `ACME_PROD_*` patterns, and the fact that no real production credentials exist.
- **Local hooks can be bypassed by anyone with a shell.** They guard the agent, not the developer. A person can push
  from a terminal; that is why the same rules exist on the remote.
- **The remote is a local folder only because this is a demo.** In real life the server is not on your laptop, and
  nobody on a laptop can run its admin path (`setup.mjs`, `merge-pr.mjs` and `demo-reset.mjs` use it).
- **The stop hook makes finishing on red loud; CI makes merging on red impossible.** After 3 send-backs the implementer
  may stop with failing tests and a warning; `merge-pr.mjs` refuses until CI is green.
- **An `ask` rule is only as good as the person answering.** In a headless run (`claude -p`) the call is simply denied;
  interactively, a human who approves without reading defeats it.
- **MCP improves the input but does not enforce anything.** `get_work_item_context` makes the context complete,
  bounded and identical on every run; it cannot make the model use it well.
- **Prose rules still matter for judgement** (R17–R19): there is nothing mechanical to move them to.
- **Your own configuration can leak into a session.** A personal `~/.claude/CLAUDE.md`, personal skills, plugins and
  claude.ai connectors load in every project. A separate configuration folder alone does not stop `~/.claude/CLAUDE.md`
  from loading; [TRY-IT.md](TRY-IT.md) shows the full clean setup.
