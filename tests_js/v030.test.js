// v0.3.0: pinned grid (#29), collapse settings (#28), group colours and contrast (#27).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MAX_PINNED, PINS_ID, PINS_KEY, anyOpen, arrange, buildTree, cleanSettings, colorCss, contrast, editKind, flatten, merge, move,
  moveBy, normalizeColor, parseRgb, pinned, pinsFull, readable, toLayout, toggleAll, toggleCollapsed, ungroup, updateGroup, validColor,
} from "../custom_components/easy_sidebar_pro/www/layout.js";

const PATHS = ["home", "map", "energy", "todo", "calendar", "logbook"];
const LAYOUT = {
  version: 1,
  order: ["home", "g:a", "map"],
  groups: { a: { name: "בית", icon: "mdi:home", color: "red", icon_color: "#00ff00", panels: ["todo", "calendar"] } },
  grid: ["energy"],
  settings: { accordion: true },
};
const shape = (tree) => tree.map((n) => (n.type === "group" ? `${n.id}[${n.children.map((c) => c.path).join(",")}]` : n.path));

test("#29 buildTree puts pinned panels in the pins node, always last; editor asks for it even when empty", () => {
  assert.deepEqual(shape(buildTree(LAYOUT, PATHS)), ["home", "a[todo,calendar]", "map", "logbook", `${PINS_ID}[energy]`]);
  assert.deepEqual(shape(buildTree({ ...LAYOUT, grid: [] }, PATHS)), ["home", "a[todo,calendar]", "map", "energy", "logbook"]);
  assert.deepEqual(shape(buildTree({ ...LAYOUT, grid: [] }, PATHS, true)).at(-1), `${PINS_ID}[]`);
  // a pinned panel listed elsewhere too stays where it was listed first (server forbids it anyway)
  assert.deepEqual(shape(buildTree({ ...LAYOUT, grid: ["map", "energy"] }, PATHS)).at(-1), `${PINS_ID}[energy]`);
});

test("#29 toLayout writes grid and settings; colours round-trip", () => {
  const out = toLayout(buildTree(LAYOUT, PATHS), LAYOUT.settings);
  assert.deepEqual(out.grid, ["energy"]);
  assert.deepEqual(out.order, ["home", "g:a", "map", "logbook"]);
  assert.equal(out.groups[PINS_ID], undefined);
  assert.deepEqual(out.groups.a, { name: "בית", icon: "mdi:home", color: "red", icon_color: "#00ff00", start_open: false, tabbed: false, panels: ["todo", "calendar"] });
  assert.deepEqual(out.settings, { start_collapsed: false, accordion: true, toggle_all: false, hide_count: false, search: false, header: "plain", divider: "line" });
  assert.deepEqual(flatten(buildTree(LAYOUT, PATHS)).at(-1), "energy");
});

test("#29 arrange leaves pinned panels out of the list; pinned() lists the visible ones in grid order", () => {
  const rows = arrange(LAYOUT, PATHS, [], "todo");
  assert.ok(!rows.some((r) => r.path === "energy"));
  assert.ok(!rows.some((r) => r.id === PINS_ID));
  assert.equal(rows.find((r) => r.type === "group").color, "red");
  assert.deepEqual(pinned({ grid: ["todo", "gone", "energy"] }, PATHS), ["todo", "energy"]);
  assert.deepEqual(pinned(null, PATHS), []);
});

test("#29 move into and out of the pinned area; a group lands above it", () => {
  const tree = buildTree(LAYOUT, PATHS, true);
  assert.deepEqual(shape(move(tree, "p:map", PINS_KEY, "into")).at(-1), `${PINS_ID}[energy,map]`);
  assert.deepEqual(shape(move(tree, "p:map", "p:energy", "before")).at(-1), `${PINS_ID}[map,energy]`);
  const out = move(tree, "p:energy", "p:home", "before");
  assert.deepEqual(shape(out), ["energy", "home", "a[todo,calendar]", "map", "logbook", `${PINS_ID}[]`]);
  // a group dropped on the pinned area (or after its header) stays out of it, right above it
  assert.deepEqual(shape(move(tree, "g:a", "p:energy", "after")), ["home", "map", "logbook", "a[todo,calendar]", `${PINS_ID}[energy]`]);
  assert.deepEqual(shape(move(tree, "g:a", PINS_KEY, "after")), ["home", "map", "logbook", "a[todo,calendar]", `${PINS_ID}[energy]`]);
  // a panel dropped "after" the pins header lands above the pinned area: it stays last
  assert.deepEqual(shape(move(tree, "p:home", PINS_KEY, "after")).at(-1), `${PINS_ID}[energy]`);
  // the pins node itself never moves, never ungroups
  assert.equal(move(tree, PINS_KEY, "p:home", "before"), tree);
  assert.equal(ungroup(tree, PINS_ID), tree);
  // dropping onto a pinned panel's middle means "after" (no group inside the pinned area)
  assert.deepEqual(shape(merge(tree, "p:map", "p:energy", "zz", "x")).at(-1), `${PINS_ID}[energy,map]`);
});

test("#29 the pinned area holds at most MAX_PINNED; reordering inside a full area still works", () => {
  const many = Array.from({ length: MAX_PINNED }, (_, i) => `p${i}`);
  const tree = buildTree({ version: 1, order: ["map"], groups: {}, grid: many }, ["map", ...many]);
  assert.equal(pinsFull(tree), true);
  assert.equal(move(tree, "p:map", PINS_KEY, "into"), tree);
  assert.equal(move(tree, "p:map", "p:p3", "after"), tree);
  assert.deepEqual(shape(move(tree, "p:p0", "p:p5", "after")).at(-1).startsWith(`${PINS_ID}[p1,p2,p3,p4,p5,p0`), true);
  assert.equal(buildTree({ grid: [...many, "extra"] }, []).at(-1).children.length, MAX_PINNED);
});

test("#29 keyboard: Alt+Down from the last row enters the pinned area; the area is the end", () => {
  const tree = buildTree(LAYOUT, PATHS, true);
  const into = moveBy(tree, "p:logbook", 1);
  assert.deepEqual(shape(into).at(-1), `${PINS_ID}[logbook,energy]`);
  const down = moveBy(into, "p:logbook", 1);
  assert.deepEqual(shape(down).at(-1), `${PINS_ID}[energy,logbook]`);
  assert.equal(moveBy(down, "p:logbook", 1), down);
  const up = moveBy(into, "p:logbook", -1);
  assert.deepEqual(shape(up), shape(tree).slice(0, -2).concat(["logbook", `${PINS_ID}[energy]`]));
  // a group never moves below the pinned area
  const g = buildTree({ ...LAYOUT, order: ["home", "map", "g:a"] }, PATHS, true);
  const last = moveBy(g, "g:a", 1);
  assert.deepEqual(shape(last).slice(-2), ["a[todo,calendar]", `${PINS_ID}[energy]`]);
  assert.equal(moveBy(last, "g:a", 1), last);
});

test("#28 accordion: opening a group folds the others; folding needs no accordion", () => {
  const ids = ["a", "b", "c"];
  assert.deepEqual(toggleCollapsed([], "a", true, ids), ["a"]);
  assert.deepEqual(toggleCollapsed(["a", "b", "c"], "b", true, ids).sort(), ["a", "c"]);
  assert.deepEqual(toggleCollapsed(["b"], "b", true, ids).sort(), ["a", "c"]);
  assert.deepEqual(toggleCollapsed(["a", "b"], "b", false, ids), ["a"]);
  // groups not shown right now keep their state
  assert.deepEqual(toggleCollapsed(["x", "b"], "b", true, ids).sort(), ["a", "c", "x"]);
});

test("#28 collapse all / expand all", () => {
  const ids = ["a", "b"];
  assert.equal(anyOpen(["a"], ids), true);
  assert.equal(anyOpen(["a", "b"], ids), false);
  assert.deepEqual(toggleAll(["a"], ids).sort(), ["a", "b"]);
  assert.deepEqual(toggleAll(["a", "b", "x"], ids), ["x"]);
  assert.deepEqual(toggleAll(null, ids).sort(), ["a", "b"]);
});

test("#28 settings: defaults for missing or invalid values; a settings change is a structure change", () => {
  assert.deepEqual(cleanSettings(null), { start_collapsed: false, accordion: false, toggle_all: false, hide_count: false, search: false, header: "plain", divider: "line" });
  assert.deepEqual(cleanSettings({ accordion: 1, header: "bold", divider: "none", toggle_all: true }).divider, "none");
  assert.equal(cleanSettings({ accordion: 1 }).accordion, false);
  const base = buildTree(LAYOUT, PATHS, true);
  const hidden = new Set();
  assert.equal(editKind(base, base, hidden, hidden, { accordion: true }, { accordion: true }), "none");
  assert.equal(editKind(base, base, hidden, hidden, { accordion: true }, { accordion: false }), "structure");
  assert.equal(editKind(base, updateGroup(base, "a", { color: "blue" }), hidden, hidden), "structure");
  assert.equal(editKind(base, move(base, "p:map", PINS_KEY, "into"), hidden, hidden), "structure");
});

test("#27 colour validation matches the server", () => {
  for (const ok of [null, "red", "primary", "grey", "#000000", "#a1b2c3"]) assert.equal(validColor(ok), true, String(ok));
  for (const bad of ["", "Red", "#ABCDEF", "#abc", "abcdef", "#abc\n", "var(--x)", "red;", "url(x)", "transparent", 1, undefined])
    assert.equal(validColor(bad), false, String(bad));
  assert.equal(normalizeColor(" #ABC "), "#aabbcc");
  assert.equal(normalizeColor("A1B2C3"), "#a1b2c3");
  assert.equal(normalizeColor("RED"), "red");
  assert.equal(normalizeColor(""), null);
  for (const bad of ["#12", "rgb(1,2,3)", "red;x", "#ggg"]) assert.equal(normalizeColor(bad), undefined, bad);
  assert.equal(colorCss("teal"), "var(--teal-color)");
  assert.equal(colorCss("#123456"), "#123456");
  assert.equal(colorCss("x;y"), null);
  assert.equal(colorCss(null), null);
});

test("#27 contrast: colours are moved toward the text colour just far enough", () => {
  assert.equal(Math.round(contrast([0, 0, 0], [255, 255, 255])), 21);
  const white = [255, 255, 255];
  const dark = [33, 33, 33];
  const yellow = [255, 235, 59];
  const onLight = readable(yellow, white, dark, 4.5);
  assert.ok(contrast(onLight, white) >= 4.5);
  assert.notDeepEqual(onLight, yellow);
  // already readable: unchanged
  assert.deepEqual(readable([183, 28, 28], white, dark, 4.5), [183, 28, 28]);
  // dark theme: a dark blue moves toward the light text colour
  const bg = [28, 28, 28];
  const light = [225, 225, 225];
  const onDark = readable([13, 71, 161], bg, light, 3);
  assert.ok(contrast(onDark, bg) >= 3 && onDark[0] > 13);
  // translucent colours are composited first
  assert.ok(contrast(readable([255, 0, 0, 0.1], white, dark, 4.5), white) >= 4.5);
});

test("#27 parseRgb reads computed colours", () => {
  assert.deepEqual(parseRgb("rgb(1, 2, 3)"), [1, 2, 3, 1]);
  assert.deepEqual(parseRgb("rgba(1, 2, 3, 0.5)"), [1, 2, 3, 0.5]);
  assert.deepEqual(parseRgb("rgb(1 2 3 / 50%)"), [1, 2, 3, 0.5]);
  assert.deepEqual(parseRgb("color(srgb 1 0 0.5)").map(Math.round), [255, 0, 128, 1]);
  assert.equal(parseRgb("red"), null);
});

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");

test("#29 grid rendering is feature-detected and uses HA's own rows", () => {
  assert.match(SRC, /gridSupported = typeof origFixed === "function"/);
  assert.match(SRC, /sb\._renderPanel\.call\(self, panel/);
  // the pinned rows are named for screen readers and keyboard users get grid arrows
  assert.match(SRC, /pinnedDesc: "Pinned"/);
  assert.match(SRC, /pinnedDesc: "מוצמד"/);
  assert.match(SRC, /addEventListener\("keydown", \(e\) => this\.pinKeys\(nav, e\), true\)/);
});

test("#27 per-group colours are applied through custom properties, never through markup", () => {
  assert.match(SRC, /setVar\(this, "--esp-own-color", look\?\.text\)/);
  assert.doesNotMatch(SRC, /insertAdjacentHTML|outerHTML|innerHTML/);
});
