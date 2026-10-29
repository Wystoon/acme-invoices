#!/usr/bin/env node
// Server-side policy for the Acme demo remote (rules R2 and R3, level 7).
// setup.mjs installs this file as <remote>/hooks/pre-receive. It runs inside `git push` on the server,
// so no client setting, hook or prompt can skip it. Local admin operations (fetch into the bare
// repository, update-ref) do not trigger receive hooks; that is how setup, merge-pr and reset work.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ZERO = /^0+$/;
const problems = [];

for (const line of readFileSync(0, "utf8").split("\n").filter(Boolean)) {
  const [oldRev, newRev, ref] = line.split(" ");
  if (ref === "refs/heads/main") {
    problems.push("Direct pushes to main are rejected. Push a feature/<id>-<slug> branch and open a pull request.");
  } else if (ZERO.test(newRev)) {
    problems.push(`Deleting ${ref} is rejected.`);
  } else if (!ZERO.test(oldRev) && !isAncestor(oldRev, newRev)) {
    problems.push(`Force-push to ${ref} is rejected. Push a new commit on top instead.`);
  }
}

for (const problem of problems) process.stderr.write(`[acme policy] ${problem}\n`);
process.exit(problems.length === 0 ? 0 : 1);

function isAncestor(ancestor, descendant) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant]).status === 0;
}
