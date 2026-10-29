import assert from "node:assert/strict";
import { test } from "node:test";
import { cut, decodeEntities, htmlToItems, htmlToText } from "../dist/core/html-to-text.js";

test("decodes named and numeric entities, keeps unknown ones", () => {
  assert.equal(decodeEntities("a &amp; b &lt;c&gt; &#39;d&#x27; 3&times;2 &unknown;"), "a & b <c> 'd' 3×2 &unknown;");
});

test("&nbsp; becomes a normal space and whitespace collapses", () => {
  assert.equal(htmlToText("<div>one&nbsp;&nbsp; two\n\t three</div>"), "one two three");
});

test("<br> and block elements become line breaks", () => {
  assert.equal(htmlToText("<div>a<br>b</div><p>c</p><div><br></div><div>d</div>"), "a\nb\nc\n\nd");
});

test("lists become markers and nested lists are indented", () => {
  const html = "<ul><li>one<ul><li>inner</li></ul></li><li>two</li></ul><ol><li>first</li><li>second</li></ol>";
  assert.equal(htmlToText(html), "- one\n  - inner\n- two\n1. first\n2. second");
});

test("images become [image] and inline tags are dropped", () => {
  assert.equal(htmlToText('<span style="color:red"><b>see</b> <img src="x.png" alt="Image"></span>'), "see [image]");
});

test("entity-encoded tags stay text", () => {
  assert.equal(htmlToText("<code>&lt;div&gt;</code>"), "<div>");
});

test("at most two blank lines in a row", () => {
  assert.equal(htmlToText("a<br><br><br><br><br><br>b"), "a\n\n\nb");
});

test("acceptance criteria: one item per <li>", () => {
  assert.deepEqual(htmlToItems("<ul><li>First <b>thing</b></li><li>Second&nbsp;thing</li></ul>"), ["First thing", "Second thing"]);
});

test("acceptance criteria: non-list HTML is split on block elements", () => {
  assert.deepEqual(htmlToItems("<div>first</div><div>second</div>"), ["first", "second"]);
});

test("acceptance criteria: absent or empty is null", () => {
  assert.equal(htmlToItems(undefined), null);
  assert.equal(htmlToItems(""), null);
  assert.equal(htmlToItems("<div>&nbsp;</div>"), null);
});

test("cut keeps the first characters and reports how many were cut", () => {
  assert.deepEqual(cut("abcdef", 4), { text: "abcd …[cut 2 chars]", cutChars: 2 });
  assert.deepEqual(cut("abc", 4), { text: "abc", cutChars: 0 });
});
