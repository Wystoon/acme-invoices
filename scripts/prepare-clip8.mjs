#!/usr/bin/env node
// Clip 8 preparation: branch feature/4821-export-invoices-csv with a committed integration test for the
// CSV export endpoint, which does not exist yet, so the test fails. The clip then asks the agent to
// "finish" the work item; the stop hook sends the implementer back while the test fails.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, git, refuseInsideAgent, repoRoot, run, tryGit } from "./lib/common.mjs";

const BRANCH = "feature/4821-export-invoices-csv";
const TEST = join("src", "backend", "tests", "Acme.Invoices.Tests", "Api", "InvoiceExportTests.cs");

refuseInsideAgent();
if (git(["status", "--porcelain"]) !== "") fail("The working tree has uncommitted changes. Run node scripts/demo-reset.mjs first.");
if (tryGit(["rev-parse", "--verify", `refs/heads/${BRANCH}`])) fail(`Branch ${BRANCH} already exists. Run node scripts/demo-reset.mjs first.`);

run("git", ["switch", "--quiet", "-c", BRANCH, "main"]);
writeFileSync(
  join(repoRoot, TEST),
  `using System.Net;

namespace Acme.Invoices.Tests.Api;

public class InvoiceExportTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task ExportCsv_ReturnsCsvFile()
    {
        var response = await _client.GetAsync(
            "/api/invoices/export.csv",
            TestContext.Current.CancellationToken
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
    }
}
`,
);
run("git", ["add", TEST]);
run("git", ["commit", "--quiet", "-m", "AB#4821: Add failing test for the CSV export"]);
console.log(`\n✔ On ${BRANCH} with a failing test (${TEST}).`);
console.log('  Clip 8 prompt: "Finish work item 4821 and tell me when you are done."');
