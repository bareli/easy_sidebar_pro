// v0.4: tabbed groups. One sidebar row; its panels are tabs above the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");
const PY = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/const.py", import.meta.url), "utf8");

const LAYOUT = {
  version: 1,
  order: ["home", "g:tools", "g:media", "todo"],
  groups: {
    tools: { name: "Tools", icon: "mdi:tools", color: null, icon_color: null, start_open: false, tabbed: true, panels: ["map", "energy", "history"] },
    media: { name: "Media", icon: null, color: null, icon_color: null, start_open: false, tabbed: false, panels: ["media-browser", "calendar"] },
  },
  grid: [],
  settings: {},
};
const VISIBLE = ["home", "map", "energy", "history", "media-browser", "calendar", "todo"];

test("tabbed round-trips through the tree; old layouts, new groups and the pinned node default to false", () => {
  const tree = L.buildTree(LAYOUT, VISIBLE);
  assert.equal(tree.find((n) => n.id === "tools").tabbed, true);
  assert.equal(tree.find((n) => n.id === "media").tabbed, false);
  const out = L.toLayout(tree, {});
  assert.deepEqual(Object.keys(out.groups.tools), L.GROUP_KEYS);
  assert.equal(out.groups.tools.tabbed, true);
  assert.equal(out.groups.media.tabbed, false);
  const old = { ...LAYOUT, groups: { tools: { name: "T", panels: ["map"] }, media: { name: "M", panels: [] } } };
  assert.equal(L.toLayout(L.buildTree(old, VISIBLE)).groups.tools.tabbed, false);
  assert.equal(L.buildTree({ ...LAYOUT, groups: { ...LAYOUT.groups, tools: { ...LAYOUT.groups.tools, tabbed: "yes" } } }, VISIBLE)[1].tabbed, false);
  assert.equal(L.addGroup([], "n", "N")[0].tabbed, false);
  assert.equal(L.merge(L.buildTree(null, VISIBLE), "p:map", "p:home", "n1", "N").find((n) => n.id === "n1").tabbed, false);
  assert.equal(L.pinsNode().tabbed, false);
  assert.equal(L.updateGroup(tree, "media", { tabbed: true }).find((n) => n.id === "media").tabbed, true);
});

test("same group keys on server and client", () => {
  assert.match(PY, /GROUP_KEYS = \("name", "icon", "color", "icon_color", "start_open", "tabbed", "panels"\)/);
  assert.deepEqual(L.GROUP_KEYS, ["name", "icon", "color", "icon_color", "start_open", "tabbed", "panels"]);
});

test("arrange: a tabbed group is one row, never folded, with its visible panels and selection", () => {
  const rows = L.arrange(LAYOUT, VISIBLE, ["tools"], "energy");
  const tools = rows.find((r) => r.id === "tools");
  assert.equal(tools.tabbed, true);
  assert.equal(tools.collapsed, false);
  assert.equal(tools.selected, true);
  assert.deepEqual(tools.paths, ["map", "energy", "history"]);
  assert.ok(!rows.some((r) => r.type === "panel" && r.group === "tools"));
  // Ordinary groups are unchanged.
  assert.deepEqual(rows.filter((r) => r.group === "media").map((r) => r.path), ["media-browser", "calendar"]);
  // Hidden members are not tabs; a tabbed group without a visible member is not shown.
  assert.deepEqual(L.arrange(LAYOUT, VISIBLE.filter((p) => p !== "energy"), [], null).find((r) => r.id === "tools").paths, ["map", "history"]);
  assert.ok(!L.arrange(LAYOUT, ["home", "todo"], [], null).some((r) => r.id === "tools"));
});

test("tabsFor: the strip only for a panel of a tabbed group", () => {
  assert.deepEqual(L.tabsFor(LAYOUT, VISIBLE, "history"), { id: "tools", name: "Tools", icon: "mdi:tools", paths: ["map", "energy", "history"] });
  assert.equal(L.tabsFor(LAYOUT, VISIBLE, "calendar"), null);
  assert.equal(L.tabsFor(LAYOUT, VISIBLE, "home"), null);
  assert.equal(L.tabsFor(LAYOUT, VISIBLE, null), null);
  assert.equal(L.tabsFor(null, VISIBLE, "map"), null);
  // A panel hidden from the sidebar opened by URL gets no strip.
  assert.equal(L.tabsFor(LAYOUT, VISIBLE.filter((p) => p !== "map"), "map"), null);
});

test("tabTarget: last tab of this page when still shown, else the first", () => {
  assert.equal(L.tabTarget(["map", "energy"], "energy"), "energy");
  assert.equal(L.tabTarget(["map", "energy"], "history"), "map");
  assert.equal(L.tabTarget(["map", "energy"], undefined), "map");
  assert.equal(L.tabTarget([], "map"), null);
});

test("folding ignores tabbed groups (accordion, collapse all)", () => {
  assert.match(SRC, /rows\.filter\(\(r\) => r\.type === "group" && !r\.tabbed\)\.map\(\(r\) => \[r\.id, r\.name\]\)/);
  assert.match(SRC, /el\.onToggle = r\.tabbed \? \(\) => this\.openTabs\(r\.id, r\.paths\) : \(\) => this\.toggle\(r\.id\);/);
});

test("sidebar row: a link, current while one of its tabs is open; no count or chevron", () => {
  assert.match(SRC, /this\._row\.setAttribute\("role", tabbed \? "link" : "button"\);/);
  assert.match(SRC, /this\._row\.setAttribute\("aria-current", "page"\)/);
  assert.match(SRC, /:host\(\[tabbed\]\) \.count, :host\(\[tabbed\]\) \.chev \{ display: none; \}/);
});

test("editor: a pressed toggle per group, read from the current tree; he + en", () => {
  assert.match(SRC, /class: "icon-btn tab-btn"/);
  assert.match(SRC, /"aria-pressed": String\(node\.tabbed === true\)/);
  assert.match(SRC, /this\.actions\.setTabbed\(node\.id, this\.group\(node\.id\)\?\.tabbed !== true\)/);
  // The same fix for "starts open": a second click must turn it off again.
  assert.match(SRC, /this\.actions\.setStartOpen\(node\.id, this\.group\(node\.id\)\?\.start_open !== true\)/);
  assert.equal(SRC.match(/^    tabbed: "/gm)?.length, 2);
  assert.match(SRC, /\.group\[data-tabbed\] \.open-btn \{ display: none; \}/);
});

test("tab strip: links (modified clicks stay the browser's), styles on the resolver are undone", () => {
  assert.match(SRC, /customElements\.define\("esp-tabs", EspTabs\)/);
  assert.match(SRC, /href: `\/\$\{tab\.path\}`/);
  assert.match(SRC, /if \(e\.button !== 0 \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey\) return;/);
  assert.match(SRC, /for \(const k of Object\.keys\(RESOLVER_STYLE\)\) this\.tabsRes\.style\.removeProperty\(k\);/);
  for (const key of ["display", "transform", "--ha-sidebar-width", "--ha-top-app-bar-width", "--safe-area-inset-top"])
    assert.ok(SRC.includes(`${key.startsWith("--") ? `"${key}"` : key}: `), key);
  assert.match(SRC, /disconnect\(\) \{\n {4}this\.clearTabs\(\);/);
});

test("the model is loaded with the module's own version (no stale layout.js after an upgrade)", () => {
  assert.match(SRC, /const L = await import\(`\.\/layout\.js\$\{new URL\(import\.meta\.url\)\.search\}`\);/);
  assert.ok(!/import \* as L from "\.\/layout\.js"/.test(SRC));
});
