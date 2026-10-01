// Regression tests for the owner follow-ups on UX-001 (#12) and BUG-008 (#26).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildTree, editKind, move, nativeHidden, updateGroup } from "../custom_components/easy_sidebar_pro/www/layout.js";

const LAYOUT = {
  version: 1,
  order: ["home", "g:a", "map"],
  groups: { a: { name: "בית", icon: "mdi:home", panels: ["energy", "logbook"] } },
};
const paths = ["home", "energy", "logbook", "map"];
const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");

test("#12: editKind separates none, hidden-only and structure", () => {
  const base = buildTree(LAYOUT, paths);
  const hidden = new Set(["map"]);
  assert.equal(editKind(base, buildTree(LAYOUT, paths), hidden, new Set(["map"])), "none");
  assert.equal(editKind(base, base, hidden, new Set()), "hidden-only");
  assert.equal(editKind(base, base, hidden, new Set(["map", "home"])), "hidden-only");
  assert.equal(editKind(base, updateGroup(base, "a", { name: "x" }), hidden, hidden), "structure");
  assert.equal(editKind(base, updateGroup(base, "a", { icon: "mdi:star" }), hidden, hidden), "structure");
  assert.equal(editKind(base, move(base, "p:map", "p:home", "before"), hidden, hidden), "structure");
  // structure wins when both changed
  assert.equal(editKind(base, updateGroup(base, "a", { name: "x" }), hidden, new Set()), "structure");
});

test("#12: nativeHidden replaces only hiddenPanels, keeps panelOrder and other keys", () => {
  const current = { panelOrder: ["map", "home"], hiddenPanels: ["map", "gone"], other: 1 };
  const out = nativeHidden(current, new Set(paths), new Set(["home", "auto"]), new Set(["auto"]));
  assert.deepEqual(out.panelOrder, ["map", "home"]);
  assert.equal(out.other, 1);
  // map is now shown, home hidden; "auto" is hidden only by HA's default, "gone" is unknown to the editor and kept
  assert.deepEqual(out.hiddenPanels, ["home", "gone"]);
});

test("#12: Done on the default writes only the hidden list for a hidden-only change", () => {
  assert.match(SRC, /kind === "hidden-only" && onDefault\) return this\.saveHidden/);
  const body = SRC.slice(SRC.indexOf("async saveHidden"), SRC.indexOf("async save(tree"));
  assert.ok(body.includes("L.nativeHidden") && !body.includes("/save`"));
});

test("#26: both string tables name the group for a grouped panel", () => {
  assert.match(SRC, /inGroup: "in group \{name\}"/);
  assert.match(SRC, /inGroup: "בקבוצה \{name\}"/);
});

test("#26: grouped panels get aria-describedby to a hidden per-group element, removed when ungrouped", () => {
  assert.match(SRC, /setAttribute\("aria-describedby", descId\)/);
  assert.match(SRC, /removeAttribute\("aria-describedby"\)/);
  assert.match(SRC, /esp-gdesc-\$\{this\.descIds\.size \+ 1\}/);
});
