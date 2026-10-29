import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "check-migrations.mjs");

function check(files) {
  const dir = mkdtempSync(join(tmpdir(), "acme-migrations-"));
  for (const [name, source] of Object.entries(files)) writeFileSync(join(dir, name), source);
  return spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
}

const migration = (up, down) => `public partial class X : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
${up}
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
${down}
    }
}
`;

const ADD = `        migrationBuilder.AddColumn<int>(name: "PaymentTermsDays", table: "Customers", nullable: false, defaultValue: 14);`;
const DROP = `        migrationBuilder.DropColumn(name: "PaymentTermsDays", table: "Customers");`;

test("the repository's own migrations pass", () => {
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("an additive migration with a Down() that drops the new column passes", () => {
  const result = check({ "20261101090000_AddCustomerPaymentTerms.cs": migration(ADD, DROP), "20261101090000_AddCustomerPaymentTerms.Designer.cs": "// generated" });
  assert.equal(result.status, 0, result.stderr);
});

test("a name without the 14-digit timestamp or PascalCase fails", () => {
  for (const name of ["AddCustomerPaymentTerms.cs", "20261101090000_addCustomerPaymentTerms.cs", "2026110109_AddX.cs"]) {
    const result = check({ [name]: migration(ADD, DROP) });
    assert.equal(result.status, 1, name);
    assert.match(result.stderr, /\[R10\] .*name must be/);
  }
});

test("an empty Down(), or one that only throws, fails", () => {
  for (const down of ["", "        // nothing to undo", "        throw new NotSupportedException();"]) {
    const result = check({ "20261101090000_AddX.cs": migration(ADD, down) });
    assert.equal(result.status, 1, JSON.stringify(down));
    assert.match(result.stderr, /Down\(\) is empty/);
  }
});

test("DropColumn or DropTable in Up() needs the approval marker on the line above", () => {
  const unmarked = check({ "20261101090000_RemoveLegacyReference.cs": migration(DROP, ADD) });
  assert.equal(unmarked.status, 1);
  assert.match(unmarked.stderr, /DropColumn in Up\(\) needs "\/\/ acme:destructive-approved AB#<ticket>"/);

  const marked = check({
    "20261101090000_RemoveLegacyReference.cs": migration(`        // acme:destructive-approved AB#4907\n${DROP}`, ADD),
  });
  assert.equal(marked.status, 0, marked.stderr);

  const noTicket = check({
    "20261101090000_RemoveLegacyReference.cs": migration(`        // acme:destructive-approved\n${DROP}`, ADD),
  });
  assert.equal(noTicket.status, 1);
});
