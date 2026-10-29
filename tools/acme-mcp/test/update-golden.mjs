// Regenerates test/golden/<id>.context.{json,md} from the current fixtures (npm run golden).
// Review the diff before committing: a golden change means the model's input changed.
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { AdoStore } from "../dist/core/ado-store.js";
import { buildWorkItemContext, writeContextFiles } from "../dist/core/work-item-context.js";
import { goldenDir, tempRepo } from "./helpers.mjs";

const root = tempRepo();
for (const id of [4821, 4830, 4840]) {
  writeContextFiles(root, buildWorkItemContext(new AdoStore(root), id));
  for (const ext of ["json", "md"]) {
    copyFileSync(join(root, ".acme", "out", String(id), `context.${ext}`), join(goldenDir, `${id}.context.${ext}`));
  }
  console.log(`updated test/golden/${id}.context.{json,md}`);
}
