#!/usr/bin/env node
// Generates the 33 filler user stories under Feature 4700 (AB#4841–AB#4873) in data/ado.
// Every value is derived from the story's position in TITLES: no clock, no randomness,
// so re-running it produces byte-identical files.
//
//   node tools/fixtures/generate.mjs           write the files
//   node tools/fixtures/generate.mjs --check   exit 1 if the files on disk differ
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API = "https://dev.acme.example/acme/_apis/wit/workItems";
const FIRST_ID = 4841;
const PARENT_ID = 4700;

const TITLES = [
  "Export filter by currency",
  "Schedule monthly export",
  "Export credit notes",
  "Include customer VAT number in export",
  "Export invoice lines as a separate file",
  "Email the export link to Finance",
  "Remember the last export filters",
  "Export audit trail",
  "Export in the customer's language",
  "Add export button to invoice list",
  "Export paid invoices only",
  "Export date range presets",
  "Add a totals row to the export",
  "Run large exports as a background job",
  "Export overdue invoices for Collections",
  "Export the exchange rates used",
  "Zip multiple export files",
  "Choose export columns",
  "Export by customer group",
  "Export cancelled invoices with reason",
  "Export draft invoices for review",
  "Keep export time under 5 seconds for 10k rows",
  "Export file naming per region",
  "Export permissions for the Finance role",
  "Export retention policy",
  "Show export progress",
  "Export error report",
  "Add ISO week numbers to the export",
  "Add payment date column to the export",
  "Export due-date ageing buckets",
  "Export in accounting system format",
  "Export changelog for auditors",
  "Export invoices per cost centre",
];

const STATES = [
  ["New", "New"],
  ["New", "New"],
  ["Active", "Implementation started"],
  ["Resolved", "Code complete and unit tests pass"],
  ["Closed", "Acceptance tests pass"],
  ["New", "New"],
  ["Active", "Implementation started"],
];
const ASSIGNEES = ["Dana Novak", "Jonas Eklund", "Tom Brandt", null];
const TAGS = ["finance", "ux", "performance", "compliance"];
const POINTS = [1, 2, 3, 5, 8];

const person = (name) => ({
  displayName: name,
  uniqueName: `${name.toLowerCase().replace(" ", ".")}@acme.example`,
});

function workItem(index, title) {
  const id = FIRST_ID + index;
  const [state, reason] = STATES[index % STATES.length];
  const assignee = ASSIGNEES[index % ASSIGNEES.length];
  const day = String((index % 28) + 1).padStart(2, "0");
  return {
    id,
    rev: 1 + (index % 6),
    fields: {
      "System.AreaPath": "Acme\\Billing",
      "System.TeamProject": "Acme",
      "System.IterationPath": `Acme\\2026\\Sprint ${19 + (index % 6)}`,
      "System.WorkItemType": "User Story",
      "System.State": state,
      "System.Reason": reason,
      ...(assignee ? { "System.AssignedTo": person(assignee) } : {}),
      "System.CreatedDate": `2026-0${3 + (index % 6)}-${day}T09:00:00Z`,
      "System.CreatedBy": person("Mira Castell"),
      "System.ChangedDate": `2026-09-${day}T16:30:00Z`,
      "System.ChangedBy": person(assignee ?? "Mira Castell"),
      "System.CommentCount": 0,
      "System.Title": title,
      "System.Tags": `export; ${TAGS[index % TAGS.length]}`,
      "System.Description":
        `<div style="font-family:Segoe UI,sans-serif;font-size:10pt"><div><b>${title}</b>: requested by Finance ` +
        `so that month-end close needs fewer manual steps.</div><div><br></div>` +
        `<div>Raised in the export refinement session.&nbsp;Details to be agreed with Finance.</div></div>`,
      "Microsoft.VSTS.Common.AcceptanceCriteria":
        `<ul><li>${title}.</li><li>Covered by tests.</li></ul>`,
      "Microsoft.VSTS.Scheduling.StoryPoints": POINTS[index % POINTS.length],
      "Microsoft.VSTS.Common.Priority": 2 + (index % 3),
    },
    relations: [
      {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        url: `${API}/${PARENT_ID}`,
        attributes: { isLocked: false, name: "Parent" },
      },
    ],
    url: `${API}/${id}`,
  };
}

const toJson = (value) => JSON.stringify(value, null, 2) + "\n";

const files = new Map();
TITLES.forEach((title, index) => {
  const id = FIRST_ID + index;
  files.set(`data/ado/workitems/${id}.json`, toJson(workItem(index, title)));
  files.set(`data/ado/comments/${id}.json`, toJson({ comments: [] }));
});

if (process.argv.includes("--check")) {
  const stale = [...files].filter(
    ([path, content]) =>
      !existsSync(join(repoRoot, path)) || readFileSync(join(repoRoot, path), "utf8") !== content,
  );
  for (const [path] of stale) console.error(`out of date: ${path}`);
  console.log(stale.length === 0 ? `${files.size} generated files are up to date` : "");
  process.exit(stale.length === 0 ? 0 : 1);
}

for (const [path, content] of files) {
  mkdirSync(dirname(join(repoRoot, path)), { recursive: true });
  writeFileSync(join(repoRoot, path), content);
}
console.log(`wrote ${files.size} files for AB#${FIRST_ID}–AB#${FIRST_ID + TITLES.length - 1}`);
