// QA v0.5 cycle regressions (issues #41-#51).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

const EMOJI = "\u{1F600}";
const loneSurrogate = (s) => /\p{Cs}/u.test(s);

/* ---- #44 BUG-020: lengths in code points, never half an emoji ---- */

test("#44 names count code points like the server: 50 emoji kept, the 51st cut, no lone surrogate", () => {
  assert.equal(L.cleanName(EMOJI.repeat(50)), EMOJI.repeat(50));
  assert.equal(L.cleanName(EMOJI.repeat(51)), EMOJI.repeat(50));
  const stored = "a" + EMOJI.repeat(26);
  assert.equal(L.cleanName(stored), stored);
  for (const v of ["a".repeat(49) + EMOJI, "a" + EMOJI.repeat(60), "a".repeat(49) + EMOJI + EMOJI]) assert.ok(!loneSurrogate(L.cleanName(v)), v);
  assert.equal(L.cleanName("a".repeat(49) + EMOJI + "b"), "a".repeat(49) + EMOJI);
});

test("#44 lone surrogates are stripped from names and search words", () => {
  assert.equal(L.cleanName("abc\ud83d"), "abc");
  assert.equal(L.cleanName("\ude00abc"), "abc");
  assert.equal(L.cleanAliases("word\ud83d other"), "word other");
});

test("#44 search words are cut at 100 code points without splitting an emoji", () => {
  assert.equal(L.cleanAliases(EMOJI.repeat(100)), EMOJI.repeat(100));
  assert.equal(L.cleanAliases(EMOJI.repeat(101)), EMOJI.repeat(100));
  assert.ok(!loneSurrogate(L.cleanAliases("a".repeat(99) + EMOJI)));
});

test("#44 addresses are limited to 2000 code points", () => {
  assert.ok(L.validUrl("/" + EMOJI.repeat(1999)));
  assert.ok(!L.validUrl("/" + EMOJI.repeat(2000)));
  assert.ok(!L.validUrl("/a\ud83d"));
  assert.equal(L.normalizeUrl("/config\ud83d"), "/config");
});

test("#44 the input limiter cuts what was just typed, keeps the rest and the caret", () => {
  assert.deepEqual(L.limitText(EMOJI.repeat(50), 100, 50), { value: EMOJI.repeat(50), caret: 100 });
  // the 51st emoji typed at the end is refused
  assert.deepEqual(L.limitText(EMOJI.repeat(51), 102, 50), { value: EMOJI.repeat(50), caret: 100 });
  // pasted in the middle: the pasted text is cut, the text after the caret stays
  const r = L.limitText("ab" + "xyz" + "cd", 5, 5);
  assert.deepEqual(r, { value: "abxcd", caret: 3 });
  // never half an emoji
  const e = L.limitText("a".repeat(49) + EMOJI, 51, 50);
  assert.deepEqual(e, { value: "a".repeat(49) + EMOJI, caret: 51 });
  const f = L.limitText("a".repeat(49) + EMOJI + EMOJI, 53, 50);
  assert.equal(f.value, "a".repeat(49) + EMOJI);
  assert.ok(!loneSurrogate(f.value));
});

test("#44 name, address and search word fields use the code point limiter, not maxlength", () => {
  assert.ok(!/maxlength: String\(L\.MAX_(NAME|URL|ALIASES)\)/.test(SRC));
  assert.match(SRC, /oninput: \(e\) => limitInput\(e\.target, L\.MAX_NAME\)/);
  assert.match(SRC, /limit: L\.MAX_NAME,\n\s+commit: \(input\) => this\.actions\.setLink\(id, "name"/);
  assert.match(SRC, /limit: L\.MAX_URL,/);
  assert.match(SRC, /limit: L\.MAX_ALIASES,/);
  assert.match(SRC, /if \(limit\) limitInput\(e\.target, limit\)/);
});
