// Search and section access for docs/wiki. Pages are split at Markdown headings.
// Ranking is deterministic, so the same query always gives the same order:
//   1. headingMatches: how many distinct query words appear in the section's heading path
//      (page title, parent headings, own heading)
//   2. score: term frequency in the section and its subsections; a word in the section's
//      own heading counts HEADING_WEIGHT times
//   3. page name, then section order
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cut } from "./html-to-text.js";

export const SECTION_CHARS = 4000;
export const SNIPPET_CHARS = 300;
export const MAX_RESULTS = 5;
const HEADING_WEIGHT = 3;
const STOP_WORDS = new Set(["a", "an", "and", "are", "for", "how", "in", "is", "of", "on", "or", "the", "to", "what", "with"]);

interface Section {
  page: string;
  heading: string;
  level: number;
  anchor: string;
  order: number;
  /** Line index of the heading. */
  start: number;
  /** Line index after the section's own text (the next heading of any level). */
  end: number;
}

interface Page {
  name: string;
  lines: string[];
  sections: Section[];
}

export interface SearchResult {
  page: string;
  heading: string;
  anchor: string;
  snippet: string;
  headingMatches: number;
  score: number;
}

export class Wiki {
  private readonly pages: Page[];

  constructor(repoRoot: string) {
    const dir = join(repoRoot, "docs", "wiki");
    this.pages = readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => parsePage(name, readFileSync(join(dir, name), "utf8")));
  }

  pageNames(): string[] {
    return this.pages.map((page) => page.name);
  }

  pageText(name: string): string {
    return this.page(name).lines.join("\n");
  }

  search(query: string, limit = MAX_RESULTS): SearchResult[] {
    const terms = [...new Set(tokenize(query).filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
    if (terms.length === 0) throw new Error("The query has no searchable words. Use a few specific terms.");

    const results: (SearchResult & { order: number })[] = [];
    for (const page of this.pages) {
      const path: Section[] = [];
      page.sections.forEach((section, index) => {
        while (path.length > 0 && path[path.length - 1].level >= section.level) path.pop();
        path.push(section);
        const headingPath = tokenize(path.map((s) => s.heading).join(" "));
        const headingMatches = terms.filter((term) => headingPath.includes(term)).length;

        // A page title (level 1) is scored on its own text only; with subsections it would contain the whole page.
        const end = section.level === 1 ? section.end : extent(page, index);
        const body = page.lines.slice(section.start + 1, end).join(" ").replace(/\s+/g, " ").trim();
        const headingTokens = tokenize(section.heading);
        const bodyTokens = tokenize(body);
        const score = terms.reduce(
          (sum, term) => sum + HEADING_WEIGHT * count(headingTokens, term) + count(bodyTokens, term),
          0,
        );
        if (score > 0) {
          results.push({ page: page.name, heading: section.heading, anchor: section.anchor, snippet: snippet(body, terms), headingMatches, score, order: section.order });
        }
      });
    }
    return results
      .sort(
        (a, b) =>
          b.headingMatches - a.headingMatches ||
          b.score - a.score ||
          (a.page < b.page ? -1 : a.page > b.page ? 1 : 0) ||
          a.order - b.order,
      )
      .slice(0, Math.min(Math.max(limit, 1), MAX_RESULTS))
      .map(({ order: _order, ...result }) => result);
  }

  /** The section with its subsections, cut to SECTION_CHARS. */
  section(pageName: string, heading: string): { page: string; heading: string; anchor: string; text: string; truncated: boolean } {
    const page = this.page(pageName);
    const wanted = heading.replace(/^#+\s*/, "").trim().toLowerCase();
    const index = page.sections.findIndex(
      (section) => section.heading.toLowerCase() === wanted || section.anchor === wanted,
    );
    if (index === -1) {
      const valid = page.sections.map((section) => section.heading).join("; ");
      throw new Error(`Unknown heading "${heading}" in ${page.name}. Valid headings: ${valid}`);
    }
    const section = page.sections[index];
    const text = cut(page.lines.slice(section.start, extent(page, index)).join("\n").trim(), SECTION_CHARS);
    return { page: page.name, heading: section.heading, anchor: section.anchor, text: text.text, truncated: text.cutChars > 0 };
  }

  private page(name: string): Page {
    const wanted = name.replace(/^docs\/wiki\//, "").replace(/\.md$/, "") + ".md";
    const page = this.pages.find((candidate) => candidate.name === wanted);
    if (!page) throw new Error(`Unknown page "${name}". Valid pages: ${this.pageNames().join(", ")}`);
    return page;
  }
}

function parsePage(name: string, text: string): Page {
  const lines = text.split("\n");
  const sections: Section[] = [];
  const anchors = new Map<string, number>();
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const match = !inFence && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return;
    const base = slug(match[2]);
    const seen = anchors.get(base) ?? 0;
    anchors.set(base, seen + 1);
    const previous = sections.at(-1);
    if (previous) previous.end = index;
    sections.push({ page: name, heading: match[2], level: match[1].length, anchor: seen === 0 ? base : `${base}-${seen}`, order: sections.length, start: index, end: lines.length });
  });
  return { name, lines, sections };
}

/** GitHub-style heading anchor: "## HTTP" becomes "http". */
function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** Line index after the section including its subsections (the next heading of the same or a higher level). */
function extent(page: Page, index: number): number {
  const level = page.sections[index].level;
  return page.sections.slice(index + 1).find((other) => other.level <= level)?.start ?? page.lines.length;
}

/** Lower-case words, with a plural "s" folded away so "Migrations" matches "migration". */
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((word) =>
    word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word,
  );
}

function count(tokens: string[], term: string): number {
  return tokens.reduce((sum, token) => sum + (token === term ? 1 : 0), 0);
}

function snippet(body: string, terms: string[]): string {
  const lower = body.toLowerCase();
  const hits = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const first = hits.length > 0 ? Math.min(...hits) : 0;
  const start = Math.max(0, first - 80);
  const prefix = start > 0 ? "…" : "";
  const room = SNIPPET_CHARS - prefix.length - 1;
  return prefix + body.slice(start, start + room) + (start + room < body.length ? "…" : "");
}
