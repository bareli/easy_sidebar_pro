import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addGroup, arrange, buildTree, cleanName, flatten, locate, merge, move, moveBy, newGroupId, toLayout, ungroup, updateGroup,
} from "../custom_components/easy_sidebar_pro/www/layout.js";

const PATHS = ["lovelace", "map", "calendar", "todo", "media-browser"];
const LAYOUT = {
  version: 1,
  order: ["lovelace", "g:home", "map"],
  groups: { home: { name: "בית", icon: "mdi:home", panels: ["calendar", "todo"] } },
};
const shape = (tree) => tree.map((n) => (n.type === "group" ? `${n.id}[${n.children.map((c) => c.path).join(",")}]` : n.path));

test("buildTree appends panels the layout does not mention, in HA order", () => {
  assert.deepEqual(shape(buildTree(LAYOUT, PATHS)), ["lovelace", "home[calendar,todo]", "map", "media-browser"]);
});

test("buildTree keeps missing panels (add-on switched off) but marks them", () => {
  const tree = buildTree(LAYOUT, ["lovelace", "map", "todo"]);
  assert.equal(locate(tree, "p:calendar").node.missing, true);
  assert.deepEqual(toLayout(tree).groups.home.panels, ["calendar", "todo"]);
});

test("buildTree ignores duplicates and unknown groups", () => {
  const bad = { version: 1, order: ["map", "map", "g:nope", "g:home", "g:home"], groups: { home: { name: "x", panels: ["map", "todo"] } } };
  assert.deepEqual(shape(buildTree(bad, PATHS)), ["map", "home[todo]", "lovelace", "calendar", "media-browser"]);
});

test("no layout keeps HA's order", () => {
  assert.deepEqual(shape(buildTree(null, PATHS)), PATHS);
});

test("toLayout round trip and flatten", () => {
  const tree = buildTree(LAYOUT, PATHS);
  // v0.3 canonical form: colours, start_open, grid and settings always present (defaults for old layouts).
  assert.deepEqual(toLayout(tree), {
    ...LAYOUT,
    order: [...LAYOUT.order, "media-browser"],
    groups: { home: { name: "בית", icon: "mdi:home", color: null, icon_color: null, start_open: false, tabbed: false, panels: ["calendar", "todo"] } },
    grid: [],
    settings: { start_collapsed: false, accordion: false, toggle_all: false, hide_count: false, header: "plain", divider: "line" },
  });
  assert.deepEqual(flatten(tree), ["lovelace", "calendar", "todo", "map", "media-browser"]);
});

test("arrange: collapsed group hides its panels and flags the selected one", () => {
  const rows = arrange(LAYOUT, PATHS, ["home"], "todo");
  assert.deepEqual(rows.map((r) => r.type === "group" ? `G:${r.id}:${r.collapsed}:${r.selected}:${r.count}` : r.path),
    ["lovelace", "G:home:true:true:2", "map", "media-browser"]);
});

test("arrange: open group marks members and the last one", () => {
  const rows = arrange(LAYOUT, PATHS, [], "map");
  const todo = rows.find((r) => r.path === "todo");
  assert.equal(todo.group, "home");
  assert.equal(todo.last, true);
  assert.equal(rows.find((r) => r.type === "group").selected, false);
});

test("arrange: group with no visible panel disappears (hidden panels)", () => {
  const rows = arrange(LAYOUT, ["lovelace", "map"], [], "map");
  assert.deepEqual(rows.map((r) => r.path ?? r.id), ["lovelace", "map"]);
});

test("move panel before / after / into", () => {
  const tree = buildTree(LAYOUT, PATHS);
  assert.deepEqual(shape(move(tree, "p:map", "p:lovelace", "before")), ["map", "lovelace", "home[calendar,todo]", "media-browser"]);
  assert.deepEqual(shape(move(tree, "p:map", "p:calendar", "after")), ["lovelace", "home[calendar,map,todo]", "media-browser"]);
  assert.deepEqual(shape(move(tree, "p:media-browser", "g:home", "into")), ["lovelace", "home[calendar,todo,media-browser]", "map"]);
  assert.deepEqual(shape(move(tree, "p:todo", "p:lovelace", "before")), ["todo", "lovelace", "home[calendar]", "map", "media-browser"]);
});

test("move does not mutate the input", () => {
  const tree = buildTree(LAYOUT, PATHS);
  const before = JSON.stringify(tree);
  move(tree, "p:calendar", "p:map", "after");
  assert.equal(JSON.stringify(tree), before);
});

test("groups never nest", () => {
  const two = merge(buildTree(LAYOUT, PATHS), "p:media-browser", "p:map", "b", "B");
  assert.deepEqual(shape(move(two, "g:b", "p:calendar", "before")), ["lovelace", "b[map,media-browser]", "home[calendar,todo]"]);
  assert.equal(move(two, "g:b", "g:home", "into"), two);
});

test("merge: drop a panel on another creates a group in the target's place", () => {
  const tree = buildTree(LAYOUT, PATHS);
  const out = merge(tree, "p:lovelace", "p:media-browser", "new1", "New group");
  assert.deepEqual(shape(out), ["home[calendar,todo]", "map", "new1[media-browser,lovelace]"]);
  assert.equal(locate(out, "g:new1").node.name, "New group");
});

test("merge on a grouped panel just moves next to it", () => {
  const tree = buildTree(LAYOUT, PATHS);
  assert.deepEqual(shape(merge(tree, "p:map", "p:calendar", "x", "X")), ["lovelace", "home[calendar,map,todo]", "media-browser"]);
});

test("ungroup, addGroup, updateGroup", () => {
  const tree = buildTree(LAYOUT, PATHS);
  assert.deepEqual(shape(ungroup(tree, "home")), ["lovelace", "calendar", "todo", "map", "media-browser"]);
  assert.deepEqual(shape(addGroup(tree, "e", "E")), ["e[]", "lovelace", "home[calendar,todo]", "map", "media-browser"]);
  assert.equal(locate(updateGroup(tree, "home", { name: "Home", icon: "mdi:sofa" }), "g:home").node.icon, "mdi:sofa");
});

test("moveBy walks into and out of groups", () => {
  let tree = buildTree(LAYOUT, PATHS);
  tree = moveBy(tree, "p:lovelace", 1);
  assert.deepEqual(shape(tree), ["home[lovelace,calendar,todo]", "map", "media-browser"]);
  tree = moveBy(tree, "p:lovelace", -1);
  assert.deepEqual(shape(tree), ["lovelace", "home[calendar,todo]", "map", "media-browser"]);
  tree = moveBy(tree, "p:todo", 1);
  assert.deepEqual(shape(tree), ["lovelace", "home[calendar]", "todo", "map", "media-browser"]);
  tree = moveBy(tree, "p:todo", -1);
  assert.deepEqual(shape(tree), ["lovelace", "home[calendar,todo]", "map", "media-browser"]);
  tree = moveBy(tree, "g:home", 1);
  assert.deepEqual(shape(tree), ["lovelace", "map", "home[calendar,todo]", "media-browser"]);
  assert.equal(moveBy(tree, "p:lovelace", -1), tree);
});

test("moveBy enters an empty group", () => {
  let tree = addGroup(buildTree(null, ["a", "b"]), "e", "E");
  tree = moveBy(tree, "p:a", -1);
  assert.deepEqual(shape(tree), ["e[a]", "b"]);
});

test("newGroupId and cleanName", () => {
  const tree = buildTree(LAYOUT, PATHS);
  assert.match(newGroupId(tree), /^[a-z0-9]{1,16}$/);
  assert.equal(cleanName("  a\u0007b  "), "ab");
  assert.equal(cleanName("x".repeat(80)).length, 50);
});
