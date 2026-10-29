// A small, deterministic HTML-to-text converter for Azure DevOps rich-text fields.
// Not a general HTML parser: it handles the tags work items actually contain.

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  times: "×",
  rarr: "→",
  larr: "←",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  euro: "€",
};

const BLOCK_TAGS = new Set([
  "div", "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "tr", "pre", "blockquote", "section", "header", "footer",
]);

// Marks list indentation so that trimming lines does not remove it.
const INDENT = "\u0000";

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return value === 0xa0 ? " " : String.fromCodePoint(value);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Converts work item HTML to plain text: entities decoded, `<br>` and block elements become
 * line breaks, list items become `- ` or `1. `, images become `[image]`, whitespace is collapsed,
 * lines are trimmed and at most two blank lines remain in a row.
 */
export function htmlToText(html: string): string {
  const lists: { ordered: boolean; count: number }[] = [];
  let out = "";
  // Block boundaries start a new line once; only <br> adds extra (blank) lines.
  const lineBreak = () => {
    out = out.replace(/ +$/, "");
    if (out !== "" && !out.endsWith("\n")) out += "\n";
  };
  for (const token of html.split(/(<[^>]*>)/)) {
    if (!token.startsWith("<")) {
      out += decodeEntities(token.replace(/\s+/g, " "));
      continue;
    }
    const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)/i.exec(token);
    if (!match) continue;
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (tag === "br") {
      out += "\n";
    } else if (tag === "img") {
      out += "[image]";
    } else if (tag === "ul" || tag === "ol") {
      if (closing) lists.pop();
      else lists.push({ ordered: tag === "ol", count: 0 });
      lineBreak();
    } else if (tag === "li") {
      lineBreak();
      const list = lists.at(-1);
      if (!closing && list) {
        const marker = list.ordered ? `${++list.count}. ` : "- ";
        out += INDENT.repeat(2 * (lists.length - 1)) + marker;
      }
    } else if (BLOCK_TAGS.has(tag)) {
      lineBreak();
    } else if ((tag === "td" || tag === "th") && closing) {
      out += " ";
    }
  }
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim().replaceAll(INDENT, " "))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/**
 * Turns an acceptance-criteria field into one string per criterion: one per `<li>` for lists,
 * one per line otherwise. Returns null when the field is absent or empty.
 */
export function htmlToItems(html: string | undefined): string[] | null {
  if (!html) return null;
  const lines = htmlToText(html)
    .split("\n")
    .filter((line) => line.trim() !== "");
  if (!/<li[\s>]/i.test(html)) return lines.length > 0 ? lines : null;

  const items: string[] = [];
  for (const line of lines) {
    const item = /^(?:- |\d+\. )(.*)$/.exec(line);
    if (item) items.push(item[1]);
    else if (items.length > 0) items[items.length - 1] += ` ${line.trim()}`;
    else items.push(line);
  }
  return items.length > 0 ? items : null;
}

/** Keeps the first `max` characters and says how many were cut. */
export function cut(text: string, max: number): { text: string; cutChars: number } {
  const chars = [...text];
  if (chars.length <= max) return { text, cutChars: 0 };
  const cutChars = chars.length - max;
  return { text: `${chars.slice(0, max).join("").trimEnd()} …[cut ${cutChars} chars]`, cutChars };
}
