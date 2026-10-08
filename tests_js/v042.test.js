// v0.4.2 (#39): a refused save says why; panel paths the server refuses never block a save.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");
const PY = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/layout.py", import.meta.url), "utf8");

test("validPanel matches layout.py PANEL", () => {
  assert.match(PY, /PANEL = re\.compile\(r"\[A-Za-z0-9_-\]\{1,100\}"\)/);
  for (const p of ["lovelace", "map", "a0d7b954_vscode", "dashboard-x", "x".repeat(100)]) assert.equal(L.validPanel(p), true, p);
  for (const p of ["my.panel", "a/b", "with space", "", "x".repeat(101), "ok\n", null, 3]) assert.equal(L.validPanel(p), false, String(p));
});

test("toLayout leaves out panel paths the server refuses, at top level, in groups and pinned", () => {
  const layout = { version: 1, order: ["home", "g:a", "odd.one"], groups: { a: { name: "A", panels: ["map", "x.y"] } }, grid: ["energy", "pin.bad"], settings: {} };
  const out = L.toLayout(L.buildTree(layout, ["home", "map", "x.y", "odd.one", "energy", "pin.bad"]), {});
  assert.deepEqual(out.order, ["home", "g:a"]);
  assert.deepEqual(out.groups.a.panels, ["map"]);
  assert.deepEqual(out.grid, ["energy"]);
  // Left out of the layout, the panel still shows (ungrouped, in HA's order) and stays in HA's native order.
  assert.ok(L.buildTree(out, ["home", "map", "x.y"]).some((n) => n.path === "x.y"));
  assert.ok(L.flatten(L.buildTree(layout, ["x.y"])).includes("x.y"));
});

test("errorDetail: the server's reason, one line, bounded; nothing when there is none", () => {
  assert.equal(L.errorDetail({ code: "invalid_format", message: "order[3]: invalid panel 'a.b'" }), "order[3]: invalid panel 'a.b'");
  assert.equal(L.errorDetail({ message: "a\n  b" }), "a b");
  assert.equal(L.errorDetail({ message: "x".repeat(500) }).length, 200);
  assert.equal(L.errorDetail(3), "");
  assert.equal(L.errorDetail({}), "");
});

test("editor: refused save says Home Assistant refused it, with a details line in both languages", () => {
  for (const s of ['saveFailedInvalid: "Could not save: Home Assistant refused the layout."', 'errorDetails: "Details: {detail}"', 'errorDetails: "פרטים: {detail}"'])
    assert.ok(SRC.includes(s), s);
  assert.doesNotMatch(SRC, /group name, icon or colour is not valid/);
  assert.doesNotMatch(SRC, /failText\(/);
  assert.match(SRC, /errorDetail: kind === "invalid" \? L\.errorDetail\(err\) : ""/);
  assert.match(SRC, /this\.error && this\.errorDetail \? h\("div", \{ class: "error detail", dir: "ltr" \}/);
});
