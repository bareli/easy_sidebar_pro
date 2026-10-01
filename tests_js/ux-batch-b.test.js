// Regression tests for the owner-ruled UX fixes (UX-001, UX-002, UX-005, UX-006, UX-007).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  adoptOrder, buildTree, editChanged, flatten, nativeSidebar, saveErrorKind, toLayout, uniqueName, updateGroup,
} from "../custom_components/easy_sidebar_pro/www/layout.js";

const LAYOUT = {
  version: 1,
  order: ["home", "g:a", "map", "g:b"],
  groups: {
    a: { name: "בית", icon: "mdi:home", panels: ["energy", "logbook", "history"] },
    b: { name: "Cams", icon: null, panels: ["cam1", "cam2"] },
  },
};

test("UX-002: adoptOrder re-sorts top-level entries and group members by HA's order, groups kept", () => {
  // HA's dialog moved map to the top and history before energy.
  const out = adoptOrder(LAYOUT, ["map", "home", "history", "energy", "logbook", "cam1", "cam2"]);
  assert.deepEqual(out.order, ["map", "home", "g:a", "g:b"]);
  assert.deepEqual(out.groups.a.panels, ["history", "energy", "logbook"]);
  assert.deepEqual(out.groups.b, LAYOUT.groups.b);
  assert.equal(out.groups.a.name, "בית");
});

test("UX-002: a group ranks by its first member in HA's order", () => {
  const out = adoptOrder(LAYOUT, ["cam2", "home", "energy", "logbook", "history", "map", "cam1"]);
  assert.deepEqual(out.order, ["g:b", "home", "g:a", "map"]);
  assert.deepEqual(out.groups.b.panels, ["cam2", "cam1"]);
});

test("UX-002: entries HA does not list keep their slots", () => {
  const out = adoptOrder(LAYOUT, ["map", "logbook", "energy", "home"]);
  assert.deepEqual(out.order, ["map", "g:a", "home", "g:b"]);
  assert.deepEqual(out.groups.a.panels, ["logbook", "energy", "history"]);
});

test("UX-002: our own write (flattened layout) adopts to no change, so a save never loops", () => {
  const paths = ["home", "energy", "logbook", "history", "map", "cam1", "cam2", "todo"];
  const tree = buildTree(LAYOUT, paths);
  const native = nativeSidebar({ panelOrder: ["stopped-addon"] }, tree, new Set(paths), new Set(["map"]), new Set());
  assert.equal(adoptOrder(toLayout(tree), native.panelOrder), null);
  assert.equal(adoptOrder(LAYOUT, flatten(buildTree(LAYOUT, []))), null);
  assert.equal(adoptOrder(null, ["home"]), null);
  assert.equal(adoptOrder(LAYOUT, null), null);
});

test("UX-002: adopting the same order twice gives the same layout (two browsers agree)", () => {
  const order = ["map", "home", "history", "energy", "logbook", "cam1", "cam2"];
  const once = adoptOrder(LAYOUT, order);
  assert.deepEqual(adoptOrder(structuredClone(LAYOUT), order), once);
  assert.equal(adoptOrder(once, order), null);
});

test("UX-001: editChanged is false for an untouched editor, true for a layout or hidden change", () => {
  const paths = ["home", "energy", "logbook", "history", "map", "cam1", "cam2"];
  const base = buildTree(LAYOUT, paths);
  const hidden = new Set(["map"]);
  assert.equal(editChanged(base, buildTree(LAYOUT, paths), hidden, new Set(["map"])), false);
  assert.equal(editChanged(base, updateGroup(base, "a", { name: "x" }), hidden, hidden), true);
  assert.equal(editChanged(base, base, hidden, new Set()), true);
  assert.equal(editChanged(base, base, hidden, new Set(["home"])), true);
});

test("UX-006 item 9: a new group's default name is numbered when taken", () => {
  const tree = [{ type: "group", id: "a", name: "קבוצה חדשה", icon: null, children: [] }, { type: "panel", path: "map" }];
  assert.equal(uniqueName([], "קבוצה חדשה"), "קבוצה חדשה");
  assert.equal(uniqueName(tree, "קבוצה חדשה"), "קבוצה חדשה 2");
  tree.push({ type: "group", id: "b", name: "קבוצה חדשה 2", icon: null, children: [] });
  assert.equal(uniqueName(tree, "קבוצה חדשה"), "קבוצה חדשה 3");
});

test("UX-007: save errors map to a localized kind, never the raw code", () => {
  assert.equal(saveErrorKind(3), "connection");
  assert.equal(saveErrorKind(1), "connection");
  assert.equal(saveErrorKind({ code: "invalid_format", message: "groups['x']: name contains control characters" }), "invalid");
  assert.equal(saveErrorKind({ code: "unknown_error", message: "x" }), "other");
});

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");
const table = (lang) => {
  const start = SRC.indexOf(`  ${lang}: {`);
  return SRC.slice(start, SRC.indexOf("\n  },", start));
};

test("UX-005: Hebrew names the sidebar 'סרגל הצד', never 'תפריט'", () => {
  const he = table("he");
  assert.match(he, /edit: "עריכת סרגל הצד"/);
  assert.match(he, /editing: "עריכת סרגל הצד"/);
  assert.doesNotMatch(he, /תפריט/);
});

test("UX-006 item 5 / UX-007: no '1 items', no 'ו' glued to a name, no raw error in save messages", () => {
  for (const lang of ["en", "he"]) {
    const tb = table(lang);
    assert.match(tb, /items1: /);
    assert.doesNotMatch(tb, /\{error\}/);
  }
  assert.doesNotMatch(table("he"), /ו\{b\}/);
});
