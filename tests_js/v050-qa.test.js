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

/* ---- #46 BUG-022: host with a port typed without a scheme ---- */

test("#46 a host name with a port gets https:// like a domain or an IP", () => {
  for (const [typed, want] of [
    ["nas.local:5000", "https://nas.local:5000"],
    ["homeassistant.local:8123", "https://homeassistant.local:8123"],
    ["homeassistant.local:8123/x", "https://homeassistant.local:8123/x"],
    ["my-nas.lan:5000", "https://my-nas.lan:5000"],
    ["192.168.1.251:5000", "https://192.168.1.251:5000"],
    ["localhost:8123", "https://localhost:8123"],
    ["nas.local:5000?a=1", "https://nas.local:5000?a=1"],
    ["nas.local", "https://nas.local"],
  ])
    assert.equal(L.normalizeUrl(typed), want, typed);
});

test("#46 real schemes are still refused", () => {
  for (const bad of ["javascript:alert(1)", "javascript:1", "mailto:a@b.com", "tel:0501234567", "tel:12345", "data:text/html,x", "vbscript:x", "ftp://nas.local:21", "file:///c:/x"])
    assert.equal(L.normalizeUrl(bad), null, bad);
});

/* ---- #47 BUG-023: whitespace controls become a space ---- */

test("#47 tab, newline, CR, VT, FF and line / paragraph separators become a space in names", () => {
  assert.equal(L.cleanName("Living\tRoom סלון"), "Living Room סלון");
  for (const c of ["\n", "\r", "\v", "\f", " ", " "]) assert.equal(L.cleanName(`a${c}b`), "a b", JSON.stringify(c));
  // NEL and the x1c-x1f separators are still removed, as before (BUG-014)
  for (const c of ["\x1f", "\x85"]) assert.equal(L.cleanName(`a${c}b`), "ab", JSON.stringify(c));
  assert.equal(L.cleanName("a\r\nb"), "a  b");
  // inner spaces are kept as before; other control characters are still removed
  assert.equal(L.cleanName("a  b"), "a  b");
  assert.equal(L.cleanName("a\x00b\x07c"), "abc");
  assert.equal(L.cleanName("\tname\t"), "name");
});

test("#47 search words: a tab separates words", () => {
  assert.equal(L.cleanAliases("מילה   word\tתג"), "מילה word תג");
  assert.equal(L.cleanAliases("a\tb c"), "a b c");
  assert.equal(L.cleanAliases("a\u2028b\x00c"), "a bc");
});

/* ---- #45 BUG-021: Done refuses while an option field shows an error ---- */

const strings = (lang) => {
  const start = SRC.indexOf(`  ${lang}: {`);
  return SRC.slice(start, SRC.indexOf("\n  },", start));
};

test("#45 an empty link name has its own message in both languages", () => {
  assert.match(strings("en"), /linkNameRequired: "Enter a link name",/);
  assert.match(strings("he"), /linkNameRequired: "צריך שם לקישור",/);
  assert.match(SRC, /if \(!name\) return t\(lang\(\), "linkNameRequired"\);\n\s+link\.name = name;/);
});

test("#45 Done and Set as default refuse while an option field is in error", () => {
  assert.equal(SRC.match(/if \(e\.focusInvalidName\(\) \|\| e\.focusInvalidOption\(\) \|\| e\.focusInvalidLink\(\)\) return;/g)?.length, 2);
  const body = SRC.slice(SRC.indexOf("  focusInvalidOption() {"), SRC.indexOf("  /** A link that cannot be saved"));
  assert.match(body, /this\.set\(\{ optionsOpen: row \}, focusKey\)/);
  assert.match(body, /error\.textContent = "";\n\s+setTimeout\(\(\) => \(error\.textContent = message\), 50\)/);
});

test("#45 every ⋮ text field records its error and shows it again after a re-render", () => {
  const panel = SRC.slice(SRC.indexOf("  optionsPanel(key) {"), SRC.indexOf("  /** A link's name or icon changed"));
  // link name, address, icon, badge + show-when (one helper), search words
  assert.equal(panel.match(/errors,\n\s+row: key,/g)?.length, 5);
  const field = SRC.slice(SRC.indexOf("function optField("), SRC.indexOf("class EspEditor"));
  assert.match(field, /if \(message\) errors\?\.set\(focusKey, \{ row, value: input\.value, message \}\);\n\s+else errors\?\.delete\(focusKey\);/);
  assert.match(field, /"aria-invalid": pending \? "true" : null,/);
  assert.match(field, /"\.value": pending \? pending\.value : value \?\? "",/);
  assert.match(SRC, /this\.optErrors = new Map\(\);/);
});

/* ---- #41 BUG-017: option fields have a visible border ---- */

test("#41 ⋮ option inputs use a 3:1 border colour (secondary text), not the divider", () => {
  const rule = SRC.match(/\.row-opts \.field input\[type="text"\], \.row-opts \.field input:not\(\[type\]\) \{[^}]*\}/)?.[0] ?? "";
  assert.match(rule, /border: 1px solid var\(--secondary-text-color\);/);
  assert.ok(!rule.includes("--divider-color"));
  // HA defaults: #727272 on the light options panel #e5e5e5 and the white field; #9b9b9b on #282828 / #1c1c1c
  for (const [fg, bgs] of [[[114, 114, 114], [[229, 229, 229], [255, 255, 255]]], [[155, 155, 155], [[40, 40, 40], [28, 28, 28]]]])
    for (const bg of bgs) assert.ok(L.contrast(fg, bg) >= 3, `${fg} on ${bg}`);
});

/* ---- #42 BUG-018: the group More button's name starts with its visible label ---- */

test("#42 group More / עוד: accessible name starts with the visible label, long text as tooltip, also after a rename", () => {
  const block = SRC.slice(SRC.indexOf("  groupBlock(node) {"), SRC.indexOf("  iconEditor(node) {"));
  assert.match(block, /class: "opt more",[\s\S]{0,120}"aria-label": `\$\{t\(lang, "optMore"\)\}, \$\{node\.name\}`,\n\s+title: t\(lang, "options", \{ name: node\.name \}\),/);
  const patch = SRC.slice(SRC.indexOf("  patchGroup(id) {"), SRC.indexOf("  patchRow(path) {"));
  assert.match(patch, /const more = label\(`\[data-focus-key="more:\$\{L\.groupKey\(id\)\}"\]`, `\$\{t\(lang, "optMore"\)\}, \$\{node\.name\}`\);\n\s+if \(more\) more\.title = t\(lang, "options", \{ name: node\.name \}\);/);
  assert.ok(!/more:\$\{L\.groupKey\(id\)\}"\]`, t\(lang, "options"/.test(patch));
});

/* ---- #43 BUG-019: error text 4.5:1 on the options panel in dark and light ---- */

test("#43 the error colour mix reaches 4.5:1 on the options panel and the sidebar in both default themes", () => {
  const share = Number(SRC.match(/--esp-error-color: color-mix\(in srgb, var\(--error-color, #db4437\) (\d+)%, var\(--primary-text-color, #212121\)\)/)?.[1]) / 100;
  assert.ok(share > 0 && share < 1);
  const err = [219, 68, 55];
  const themes = [
    { text: [33, 33, 33], bgs: [[229, 229, 229], [255, 255, 255]] }, // light: options panel, sidebar
    { text: [225, 225, 225], bgs: [[40, 40, 40], [28, 28, 28]] }, // dark: options panel (HA secondary-background-color), sidebar
  ];
  for (const { text, bgs } of themes) {
    const color = L.mix(text, err, share).map(Math.round);
    for (const bg of bgs) assert.ok(L.contrast(color, bg) >= 4.5, `${color} on ${bg}: ${L.contrast(color, bg).toFixed(2)}`);
  }
});

/* ---- #48 SEC-003: scheme matched in ASCII only (parity with layout.py) ---- */

test("#48 httpſ:// and HTTPſ:// are refused, ASCII case variants accepted", () => {
  for (const bad of ["http\u017f://example.invalid", "HTTP\u017f://example.invalid", "\u017fttp://x.invalid"]) assert.ok(!L.validUrl(bad), bad);
  for (const ok of ["HTTPS://example.com", "Http://example.com/x", "hTtPs://nas.local:5000"]) assert.ok(L.validUrl(ok), ok);
  assert.match(fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/layout.py", import.meta.url), "utf8"), /URL_EXTERNAL = re\.compile\(r"\[hH\]\[tT\]\[tT\]\[pP\]\[sS\]\?:\/\/[^\n]*"\)\r?\n/);
});
