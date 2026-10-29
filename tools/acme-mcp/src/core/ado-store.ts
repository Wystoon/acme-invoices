// Read-only access to the Azure DevOps fixtures in data/ado. Reads files only:
// no clock, no environment, no git state.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface WorkItemJson {
  id: number;
  rev: number;
  fields: Record<string, unknown>;
  relations?: { rel: string; url: string }[];
  url: string;
}

export interface CommentJson {
  id: number;
  text: string;
  createdBy: { displayName: string };
  createdDate: string;
}

const PARENT_LINK = "System.LinkTypes.Hierarchy-Reverse";

export class AdoStore {
  constructor(private readonly repoRoot: string) {}

  ids(): number[] {
    return readdirSync(this.path("workitems"))
      .filter((name) => /^\d+\.json$/.test(name))
      .map((name) => Number.parseInt(name, 10))
      .sort((a, b) => a - b);
  }

  rawWorkItem(id: number): string {
    const file = join(this.path("workitems"), `${id}.json`);
    if (!existsSync(file)) throw new Error(`Work item ${id} not found`);
    return readFileSync(file, "utf8");
  }

  find(id: number): WorkItemJson | undefined {
    const file = join(this.path("workitems"), `${id}.json`);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as WorkItemJson) : undefined;
  }

  get(id: number): WorkItemJson {
    const item = this.find(id);
    if (!item) throw new Error(`Work item ${id} not found`);
    return item;
  }

  rawComments(id: number): string {
    const file = join(this.path("comments"), `${id}.json`);
    return existsSync(file) ? readFileSync(file, "utf8") : '{ "comments": [] }\n';
  }

  /** Comments in file order. */
  comments(id: number): CommentJson[] {
    return (JSON.parse(this.rawComments(id)) as { comments: CommentJson[] }).comments;
  }

  parentId(item: WorkItemJson): number | undefined {
    const link = item.relations?.find((relation) => relation.rel === PARENT_LINK);
    const id = link && /\/(\d+)$/.exec(link.url)?.[1];
    return id ? Number.parseInt(id, 10) : undefined;
  }

  /** Children of a work item, by ascending id. */
  children(parentId: number): WorkItemJson[] {
    return this.ids()
      .map((id) => this.get(id))
      .filter((item) => this.parentId(item) === parentId);
  }

  private path(kind: "workitems" | "comments"): string {
    return join(this.repoRoot, "data", "ado", kind);
  }
}

export function textField(item: WorkItemJson, name: string): string {
  const value = item.fields[name];
  return typeof value === "string" ? value : "";
}

export function personField(item: WorkItemJson, name: string): string | null {
  const value = item.fields[name] as { displayName?: unknown } | undefined;
  return typeof value?.displayName === "string" ? value.displayName : null;
}
