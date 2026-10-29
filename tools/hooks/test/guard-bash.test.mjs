import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { runHook, tempDir, tempRepo } from "./helpers.mjs";

const workspace = tempRepo({ branch: "feature/4821-export-invoices-csv" });
const guard = (command, root = workspace) => runHook("guard-bash.mjs", { tool_name: "Bash", tool_input: { command } }, { root });
// The PowerShell tool sends the same input with tool_name "PowerShell". No PowerShell is needed to run these.
const guardPowerShell = (command, root = workspace) => runHook("guard-bash.mjs", { tool_name: "PowerShell", tool_input: { command } }, { root });

const CASES = [
  // R2: pushes to main
  ["git push origin main", "R2"],
  ["git push origin HEAD:main", "R2"],
  ["git push -u origin main", "R2"],
  ["git push --set-upstream origin HEAD:main", "R2"],
  ["git push origin feature/x:main", "R2"],
  ["git push origin :main", "R2"],
  ["git push origin refs/heads/main", "R2"],
  ["git -C . push origin main", "R2"],
  ["git push --all origin", "R2"],
  // Git options before the subcommand change nothing
  ["git -C /some/path push origin main", "R2"],
  ["git --git-dir=.git push origin main", "R2"],
  ["git --git-dir .git push origin main", "R2"],
  ["git --work-tree . push origin HEAD:main", "R2"],
  ["git -c push.default=current -C . push origin main", "R2"],
  ["git -c x=y push --force origin feature/x", "R3"],
  ["/usr/bin/git push origin main", "R2"],
  ["git -C /some/path push -u origin feature/4821-export-invoices-csv", null],
  ["git push -u origin feature/4821-export-invoices-csv", null],
  ["git push --set-upstream origin bugfix/4840-invoice-total-rounding", null],
  // R3 and R3b: force and push options
  ["git push --force origin feature/x", "R3"],
  ["git push -f origin feature/x", "R3"],
  ["git push -uf origin feature/x", "R3"],
  ["git push origin +feature/x", "R3"],
  ["git push --force-with-lease", "R3"],
  ["git push --force-with-lease=feature/x:abc123 origin feature/x", "R3"],
  ["git push --force-if-includes origin feature/x", "R3"],
  ["git push -o ci.skip origin feature/x", "R3b"],
  ["git push --push-option=ci.skip origin feature/x", "R3b"],
  // R4: secrets
  ["cat .env", "R4"],
  ["less .env", "R4"],
  ["head -5 .env", "R4"],
  ["source .env", "R4"],
  ["grep PASSWORD .env.local", "R4"],
  ["cat secrets/signing-key.pem.example", "R4"],
  ["ls secrets", "R4"],
  [`node -e "console.log(require('fs').readFileSync('.env', 'utf8'))"`, "R4"],
  ["dotnet user-secrets list", "R4"],
  ["cat src/frontend/src/environments/environment.ts", null],
  ["cat docs/wiki/security-and-secrets.md", null],
  ['git commit -m "Document how secrets are handled"', null],
  // R16: production
  ["curl https://api.prod.acme.example/invoices", "R16"],
  ["psql -h prod-db.acme.example", "R16"],
  ["curl https://invoices.acme.example/", "R16"],
  ["echo $ACME_PROD_DB", "R16"],
  ["curl https://invoices.test.acme.example/", null],
  // GUARD: agent configuration
  ["echo hi > .claude/settings.json", "GUARD"],
  ["echo '{}' >> .mcp.json", "GUARD"],
  ["cat notes.md | tee CLAUDE.md", "GUARD"],
  ["sed -i '' 's/exit(2)/exit(0)/' tools/hooks/guard-bash.mjs", "GUARD"],
  ["rm -rf .claude", "GUARD"],
  ["mv evil.md .claude/agents/acme-dev.md", "GUARD"],
  ["cp evil.mjs tools/hooks/audit.mjs", "GUARD"],
  ["git --git-dir=../acme-invoices-remote.git update-ref refs/heads/main HEAD", "GUARD"],
  ["git update-ref refs/heads/main HEAD", "GUARD"],
  // GUARD: git commands that write files (an allowed `git log *` could overwrite .claude/settings.json)
  ["git log --output=.claude/settings.json", "GUARD"],
  ["git -C /some/repo diff --output x.txt", "GUARD"],
  ["git show HEAD --output=notes.txt", "GUARD"],
  ["git format-patch -o out/ HEAD~1", "GUARD"],
  ["git format-patch --output-directory=out HEAD~1", "GUARD"],
  ["git log --oneline", null],
  ["git log --oneline -5 -- src/backend", null],
  ["git diff --stat", null],
  ["cat .claude/settings.json", null],
  ["cp .claude/settings.json /tmp/settings-copy.json", null],
  // Ordinary work and false positives
  ["dotnet test --solution src/backend", null],
  ["dotnet build src/backend", null],
  ["npm --prefix src/frontend run lint", null],
  ["git status && git diff", null],
  ['echo "main" && git push origin feature/x', null],
  ["echo git push origin main", null],
  ['git commit -m "Merge main into feature/4821-export-invoices-csv"', null],
];

const POWERSHELL_CASES = [
  // R2 and R3: git is the same program, called the PowerShell ways
  ["git push origin main", "R2"],
  ["& git push origin main", "R2"],
  [String.raw`& 'C:\Program Files\Git\cmd\git.exe' push origin HEAD:main`, "R2"],
  ["git.exe push -u origin main", "R2"],
  ["GIT push origin main", "R2"],
  ["git push `\n  origin main", "R2"],
  ["git push origin ‘main’", "R2"],
  [String.raw`Set-Location src\backend; git push origin main`, "R2"],
  ["git push --force origin feature/x", "R3"],
  ["git push -f origin feature/x", "R3"],
  ["git push origin +feature/x", "R3"],
  ["git push --force-with-lease", "R3"],
  ["git push -o ci.skip origin feature/x", "R3b"],
  ["git push -u origin feature/4821-export-invoices-csv", null],
  ["Write-Output 'git push origin main'", null],
  ["git commit -m 'Merge main into feature/4821-export-invoices-csv'", null],
  // R4: secrets, with cmdlets, aliases, backslashes and any case
  ["Get-Content .env", "R4"],
  [String.raw`Get-Content -Path .\.env`, "R4"],
  ["gc .env.local", "R4"],
  ["cat .env", "R4"],
  ["type .env", "R4"],
  ["Get-Content .ENV", "R4"],
  ["Select-String -Path .env -Pattern PASSWORD", "R4"],
  ["sls PASSWORD .env.local", "R4"],
  [String.raw`Copy-Item .env $env:TEMP\env.txt`, "R4"],
  [String.raw`Get-Content secrets\signing-key.pem.example`, "R4"],
  [String.raw`Get-Content -LiteralPath:SECRETS\signing-key.pem.example`, "R4"],
  [String.raw`Get-ChildItem .\secrets`, "R4"],
  ["dir Secrets", "R4"],
  [String.raw`Copy-Item -Path secrets\* -Destination C:\Temp`, "R4"],
  [String.raw`Get-Content src\frontend\src\environments\environment.ts`, null],
  [String.raw`Get-Content docs\wiki\security-and-secrets.md`, null],
  ["Write-Output $env:PATH", null],
  // R16: production
  ["Invoke-WebRequest https://api.prod.acme.example/invoices", "R16"],
  ["irm https://INVOICES.acme.example/", "R16"],
  ["Write-Output $env:ACME_PROD_DB", "R16"],
  ["Invoke-RestMethod https://invoices.test.acme.example/", null],
  // GUARD: writes into agent configuration
  [String.raw`Set-Content .claude\settings.json '{}'`, "GUARD"],
  [String.raw`Set-Content -Path .claude\settings.json -Value '{}'`, "GUARD"],
  ["sc -Path:.mcp.json -Value x", "GUARD"],
  ["Add-Content CLAUDE.md 'x'", "GUARD"],
  [String.raw`'x' | Out-File -FilePath tools\hooks\audit.mjs`, "GUARD"],
  [String.raw`'{}' > .claude\settings.json`, "GUARD"],
  [String.raw`'x' >> .\CLAUDE.md`, "GUARD"],
  ["Get-Content notes.md | Tee-Object -FilePath claude.md", "GUARD"],
  [String.raw`(Get-Content tools\hooks\guard-bash.mjs) -replace 'exit\(2\)','exit(0)' | Set-Content tools\hooks\guard-bash.mjs`, "GUARD"],
  [String.raw`Copy-Item evil.mjs tools\hooks\audit.mjs`, "GUARD"],
  [String.raw`Copy-Item -Recurse evil .claude`, "GUARD"],
  [String.raw`Copy-Item -Path evil.md -Destination .claude\agents\acme-dev.md`, "GUARD"],
  [String.raw`Copy-Item -Destination:.claude\agents\acme-dev.md evil.md`, "GUARD"],
  ["cp evil.mjs tools/hooks/audit.mjs", "GUARD"],
  [String.raw`Move-Item evil.md .claude\agents\acme-dev.md`, "GUARD"],
  [String.raw`Move-Item .claude\settings.json settings.bak`, "GUARD"],
  ["Remove-Item -Recurse -Force .claude", "GUARD"],
  ["ri .MCP.json", "GUARD"],
  [String.raw`del tools\hooks\guard-bash.mjs`, "GUARD"],
  ["Rename-Item .claude .claude-off", "GUARD"],
  [String.raw`New-Item -ItemType File -Force .claude\settings.json`, "GUARD"],
  [String.raw`Remove-Item a.txt,.claude\settings.json`, "GUARD"],
  [String.raw`Microsoft.PowerShell.Management\Remove-Item .claude`, "GUARD"],
  [String.raw`git log --output=.claude\settings.json`, "GUARD"],
  ["git update-ref refs/heads/main HEAD", "GUARD"],
  [String.raw`Get-Content .claude\settings.json`, null],
  [String.raw`Copy-Item .claude\settings.json $env:TEMP\settings-copy.json`, null],
  [String.raw`Copy-Item -Path .claude\settings.json -Destination C:\Temp\settings.json`, null],
  [String.raw`Copy-Item .claude\settings.json -Destination C:\Temp`, null],
  ["Set-Content -Path notes.md -Value 'hello'", null],
  [String.raw`Remove-Item src\frontend\dist -Recurse`, null],
  // Ordinary work
  [String.raw`dotnet test --solution src\backend`, null],
  ["npm --prefix src/frontend run lint", null],
  ["git status; git diff", null],
];

for (const [cases, run, label] of [[CASES, guard, ""], [POWERSHELL_CASES, guardPowerShell, "PowerShell "]]) {
  for (const [command, rule] of cases) {
    test(`${label}${rule ?? "allow"}: ${command}`, () => {
      const result = run(command);
      if (rule === null) {
        assert.equal(result.status, 0, result.stderr);
      } else {
        assert.equal(result.status, 2);
        assert.match(result.stderr, new RegExp(`^\\[${rule}\\] `));
      }
    });
  }
}

test("every block message says what to do instead", () => {
  for (const [command, rule] of [["git push origin main", "R2"], ["git push -f origin x", "R3"], ["cat .env", "R4"]]) {
    const { stderr } = guard(command);
    assert.match(stderr, /\. [A-Z].+\.\n$/, `${rule}: ${stderr}`);
  }
  assert.match(guard("git push origin main").stderr, /^\[R2\] Direct pushes to main are blocked\. Create a branch feature\/<id>-<slug>/);
});

test("a bare git push is blocked on main and allowed on a feature branch", () => {
  const onMain = tempRepo({ branch: "main" });
  assert.equal(guard("git push", onMain).status, 2);
  assert.equal(guard("git push origin", onMain).status, 2);
  assert.equal(guard("git push", workspace).status, 0);
  assert.equal(guardPowerShell("git push", onMain).status, 2);
  assert.equal(guardPowerShell("git push", workspace).status, 0);
});

test("a bare git push into another repository is judged by that repository's branch", () => {
  // In a Bash command \ escapes, so a Windows path is written with / (as Git Bash accepts it).
  const onMain = tempRepo({ branch: "main" }).replaceAll("\\", "/");
  assert.match(guard(`git -C ${onMain} push`).stderr, /^\[R2\]/);
  assert.match(guard(`git --git-dir=${onMain}/.git push origin`).stderr, /^\[R2\]/);
  assert.equal(guard(`git -C ${workspace.replaceAll("\\", "/")} push`, onMain).status, 0);
});

test("the remote's folder is off limits, by absolute path or by name", () => {
  const remote = join(tempDir(), "acme-invoices-remote.git");
  const root = tempRepo({ branch: "feature/x", origin: remote });
  assert.match(guard(`rm -rf ${remote}/refs`, root).stderr, /^\[GUARD\]/);
  assert.match(guard("ls ../acme-invoices-remote.git/hooks", root).stderr, /^\[GUARD\]/);
  assert.match(guard(`git --git-dir=${remote} log`, root).stderr, /^\[GUARD\]/);
  assert.equal(guard("git push -u origin feature/x", root).status, 0);
  assert.equal(guard("git --git-dir=.git log --oneline -3", root).status, 0);
  assert.match(guardPowerShell(String.raw`Get-ChildItem ..\ACME-INVOICES-REMOTE.git\hooks`, root).stderr, /^\[GUARD\]/);
  assert.match(guardPowerShell(`Remove-Item -Recurse ${remote.replaceAll("/", "\\")}\\refs`, root).stderr, /^\[GUARD\]/);
});

test("a write through the absolute path of the repository is caught", () => {
  assert.equal(guard(`echo x > ${workspace}/.claude/settings.json`).status, 2);
  assert.equal(guardPowerShell(`Set-Content '${workspace}\\.claude\\settings.json' x`).status, 2);
});

test("a PowerShell write through a Windows path of the repository is caught, with either separator and any case", () => {
  const root = String.raw`C:\work\acme-invoices`;
  assert.match(guardPowerShell(String.raw`Set-Content 'C:\work\acme-invoices\.claude\settings.json' x`, root).stderr, /^\[GUARD\]/);
  assert.match(guardPowerShell("Remove-Item c:/Work/Acme-Invoices/tools/hooks -Recurse", root).stderr, /^\[GUARD\]/);
  assert.equal(guardPowerShell(String.raw`Set-Content C:\work\acme-invoices\notes.md x`, root).status, 0);
});

test("invalid input crashes the hook, so onFailure: block stops the command (fail closed)", () => {
  const result = runHook("guard-bash.mjs", "{ not json", { root: workspace });
  assert.notEqual(result.status, 0);
  assert.notEqual(result.status, 2);
});

test("the guard is fast", (t) => {
  const fastest = Math.min(...Array.from({ length: 5 }, () => guard("git push -u origin feature/x").ms));
  // Shared GitHub Actions runners (Windows above all) are too noisy for a time limit: there it is reported, not enforced.
  if (process.env.GITHUB_ACTIONS === "true") t.diagnostic(`fastest of 5 runs: ${Math.round(fastest)} ms (limit 300 ms, not enforced on GitHub Actions)`);
  else assert.ok(fastest < 300, `fastest run took ${fastest} ms`);
});
