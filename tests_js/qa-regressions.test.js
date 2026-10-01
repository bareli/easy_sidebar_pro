// Failing regression tests for reproduced QA defects (qa-engineer). They pass once the defect is fixed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, cleanName, nativeSidebar, validIcon } from "../custom_components/easy_sidebar_pro/www/layout.js";

test("BUG-014: cleanName removes C1 control characters the server rejects", () => {
  assert.equal(cleanName("סלון\u0085מטבח"), "סלוןמטבח");
  assert.equal(cleanName("a\u0080b\u009fc"), "abc");
});

test("SEC-002: cleanName drops bidi controls and zero-width characters, keeps joiners, needs a visible character", () => {
  assert.equal(cleanName("\u202eevil\u202c"), "evil");
  assert.equal(cleanName("a\u200bb\u2066c\u2069\u200f"), "abc");
  assert.equal(cleanName("\u200b\u200b"), "");
  assert.equal(cleanName("\u00a0\u2003"), "");
  assert.equal(cleanName("\ufeff"), "");
  assert.equal(cleanName("\u0085"), "");
  assert.equal(cleanName("\u05d1\u05d9\u05ea"), "\u05d1\u05d9\u05ea");
  assert.equal(cleanName("Living room"), "Living room");
  assert.equal(cleanName("\u0645\u06cc\u200c\u0631\u0648\u0645"), "\u0645\u06cc\u200c\u0631\u0648\u0645");
  assert.equal(cleanName("\ud83d\udc68\u200d\ud83d\udc69"), "\ud83d\udc68\u200d\ud83d\udc69");
});

test("SEC-001: validIcon is a whole-string match and refuses URI schemes", () => {
  for (const ok of ["mdi:home", "hass:cog", "custom_set:my-icon"]) assert.equal(validIcon(ok), true, ok);
  for (const bad of ["mdi:home\n", "MDI:home", "javascript:alert", "data:x", "https:x", "mailto:x", "mdi:", ":home", "", null, 7])
    assert.equal(validIcon(bad), false, String(bad));
});

test("BUG-013: a save keeps native hidden and order entries of panels HA does not list right now", () => {
  const tree = buildTree({ version: 1, order: ["map", "home"], groups: {} }, ["home", "map"]);
  const current = { panelOrder: ["home", "map", "hassio-stopped"], hiddenPanels: ["map", "hassio-stopped"], other: 1 };
  const out = nativeSidebar(current, tree, new Set(["home", "map"]), new Set(), new Set());
  assert.deepEqual(out, { panelOrder: ["map", "home", "hassio-stopped"], hiddenPanels: ["hassio-stopped"], other: 1 });
  const none = nativeSidebar(null, tree, new Set(["home", "map"]), new Set(["map"]), new Set());
  assert.deepEqual(none, { panelOrder: ["map", "home"], hiddenPanels: ["map"] });
});
