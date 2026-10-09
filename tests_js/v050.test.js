import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");
const PY = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/const.py", import.meta.url), "utf8");

const PATHS = ["lovelace", "map", "history", "energy"];
const LAYOUT = {
  version: 1,
  order: ["lovelace", "l:auto", "g:home", "map"],
  groups: { home: { name: "Home", icon: null, panels: ["history", "l:site"] } },
  links: {
    auto: { name: "Automations", icon: "mdi:robot", url: "/config/automation", new_tab: false },
    site: { name: "Site", icon: null, url: "https://example.com", new_tab: false },
  },
  items: { map: { badge: null, show_when: "input_boolean.alarm", aliases: "" }, history: { badge: "counter.c", show_when: null, aliases: "logs graphs" } },
};
const shape = (tree) => tree.map((n) => (n.type === "group" ? `${n.id}[${n.children.map((c) => c.path).join(",")}]` : n.path));

/* ---- links ---- */

test("links are rows like panels: placed in order, in groups, and unplaced ones go to the end", () => {
  assert.deepEqual(shape(L.buildTree(LAYOUT, PATHS)), ["lovelace", "l:auto", "home[history,l:site]", "map", "energy"]);
  const unplaced = { ...LAYOUT, links: { ...LAYOUT.links, new1: { name: "N", icon: null, url: "/x", new_tab: false } } };
  assert.equal(shape(L.buildTree(unplaced, PATHS)).at(-1), "l:new1");
});

test("toLayout keeps complete placed links, drops incomplete ones and their extras", () => {
  const tree = L.buildTree(LAYOUT, PATHS);
  const meta = L.metaOf(LAYOUT);
  meta.links.auto.url = "";
  meta.items["l:auto"] = { badge: "sensor.x", show_when: null, aliases: "" };
  const out = L.toLayout(tree, null, meta);
  assert.deepEqual(Object.keys(out.links), ["site"]);
  assert.ok(!out.order.includes("l:auto"));
  assert.equal(out.items["l:auto"], undefined);
  assert.deepEqual(out.items.history, { badge: "counter.c", show_when: null, aliases: "logs graphs" });
});

test("metaOf is a deep copy (editing never changes the stored layout)", () => {
  const meta = L.metaOf(LAYOUT);
  meta.links.auto.name = "changed";
  assert.equal(LAYOUT.links.auto.name, "Automations");
});

test("addresses: same rules as layout.py, and what a user types is normalised", () => {
  for (const ok of ["/config/automation", "/lovelace/0?edit=1", "https://example.com", "http://192.168.1.251:5000/x", "/"]) assert.ok(L.validUrl(ok), ok);
  for (const bad of ["", "//evil.com", "/\\evil", "javascript:alert(1)", "data:text/html,x", "https://", "/a b", "ftp://x", "x".repeat(2001), "/a​b"]) assert.ok(!L.validUrl(bad), bad);
  assert.equal(L.normalizeUrl("config/automation"), "/config/automation");
  assert.equal(L.normalizeUrl("  www.example.com "), "https://www.example.com");
  assert.equal(L.normalizeUrl("192.168.1.251:5000"), "http://192.168.1.251:5000");
  assert.equal(L.normalizeUrl("http://ha.local:8123/map", "http://ha.local:8123"), "/map");
  assert.equal(L.normalizeUrl("javascript:alert(1)"), null);
  assert.equal(L.normalizeUrl(""), null);
});

test("the open page selects the internal link with the longest match", () => {
  const links = { a: { url: "/lovelace" }, b: { url: "/lovelace/cameras" }, c: { url: "https://x.com" }, d: { url: "/config/automation?x=1" } };
  assert.equal(L.linkAt(links, "/lovelace/cameras"), "l:b");
  assert.equal(L.linkAt(links, "/lovelace/0"), "l:a");
  assert.equal(L.linkAt(links, "/lovelacex"), null);
  assert.equal(L.linkAt(links, "/config/automation/edit/1"), "l:d");
  assert.equal(L.linkAt({}, "/x"), null);
});

/* ---- move to, add / remove ---- */

test("moveTo: into a group (end), to the top level (above the pins), into the pins; groups do not move", () => {
  const tree = L.buildTree(LAYOUT, PATHS, true);
  assert.deepEqual(shape(L.moveTo(tree, "p:map", "home")), ["lovelace", "l:auto", "home[history,l:site,map]", "energy", "_pins[]"]);
  assert.deepEqual(shape(L.moveTo(tree, "p:history", null)), ["lovelace", "l:auto", "home[l:site]", "map", "energy", "history", "_pins[]"]);
  assert.deepEqual(shape(L.moveTo(tree, "p:l:auto", L.PINS_ID)), ["lovelace", "home[history,l:site]", "map", "energy", "_pins[l:auto]"]);
  assert.equal(L.moveTo(tree, "g:home", null), tree);
  assert.equal(L.moveTo(tree, "p:map", "nope"), tree);
});

test("addLink puts the new row on top; removeEntry takes a row out of a group", () => {
  const tree = L.buildTree(LAYOUT, PATHS);
  assert.equal(shape(L.addLink(tree, "zz"))[0], "l:zz");
  assert.deepEqual(shape(L.removeEntry(tree, "p:l:site")), ["lovelace", "l:auto", "home[history]", "map", "energy"]);
});

/* ---- badges and conditions ---- */

test("badgeOf: numbers count, active states are a dot, inactive ones nothing", () => {
  assert.deepEqual(L.badgeOf({ state: "3" }), { count: 3 });
  assert.equal(L.badgeOf({ state: "0" }), null);
  assert.equal(L.badgeOf({ state: "-2" }), null);
  assert.deepEqual(L.badgeOf({ state: "on" }), { dot: true });
  assert.deepEqual(L.badgeOf({ state: "open" }), { dot: true });
  for (const s of ["off", "closed", "unavailable", "unknown", "OFF", "", "not_home"]) assert.equal(L.badgeOf({ state: s }), null, s);
  assert.equal(L.badgeOf(undefined), null);
  assert.equal(L.badgeText({ count: 150 }), "99+");
  assert.equal(L.badgeText({ count: 0.4 }), "1");
  assert.equal(L.badgeText({ dot: true }), "");
});

test("rollup adds counts; dots only when nothing counts", () => {
  assert.deepEqual(L.rollup([{ count: 2 }, null, { count: 1 }, { dot: true }]), { count: 3 });
  assert.deepEqual(L.rollup([null, { dot: true }]), { dot: true });
  assert.equal(L.rollup([null, undefined]), null);
});

test("hiddenByCondition hides panels, links and whole groups while their entity is off", () => {
  const layout = { ...LAYOUT, items: { ...LAYOUT.items, "g:home": { badge: null, show_when: "binary_sensor.g", aliases: "" } } };
  const off = L.hiddenByCondition(layout, () => false);
  assert.deepEqual([...off].sort(), ["history", "l:site", "map"]);
  assert.equal(L.hiddenByCondition(layout, () => true).size, 0);
  assert.deepEqual(L.watchedEntities(layout).sort(), ["binary_sensor.g", "counter.c", "input_boolean.alarm"]);
});

test("cleanItem / cleanAliases / validEntity match the server rules", () => {
  assert.equal(L.cleanItem({ badge: null, show_when: null, aliases: "  " }), null);
  assert.equal(L.cleanItem({ badge: "Sensor.X" }), null);
  assert.equal(L.cleanAliases(" a \n  b\u0007 "), "a b");
  assert.equal(L.cleanAliases("x".repeat(150)).length, L.MAX_ALIASES);
  assert.ok(L.validEntity("binary_sensor.front_door"));
  for (const bad of ["Sensor.x", "sensor", "sensor.", ".x", "sensor.x y", "a.b.c"]) assert.ok(!L.validEntity(bad), bad);
});

/* ---- search ---- */

test("search finds HA's untranslated title, the path and the search words", () => {
  const words = new Map([["history", ["היסטוריה", "history", "history"]], ["map", ["מפה", "map", "map"]], ["energy", ["אנרגיה", "energy", "energy"]], ["lovelace", ["סקירה", "", "lovelace"]]]);
  const visible = [...PATHS, "l:auto", "l:site"];
  const found = (q) => L.searchRows(LAYOUT, visible, words, q, null).map((r) => (r.type === "group" ? `g:${r.id}` : r.path));
  assert.deepEqual(found("his"), ["g:home", "history"]);
  assert.deepEqual(found("graphs"), ["g:home", "history"]);
  assert.deepEqual(found("מפה"), ["map"]);
});

test("search lists dashboard views after the entries, at most 8, only of shown dashboards", () => {
  const views = [
    { path: "lovelace/front", dash: "lovelace", title: "Front yard" },
    { path: "hidden/x", dash: "hidden", title: "Yard hidden" },
    ...Array.from({ length: 10 }, (_, i) => ({ path: `lovelace/${i}`, dash: "lovelace", title: `Yard ${i}` })),
  ];
  const rows = L.searchRows(LAYOUT, PATHS, new Map(), "yard", null, [], views);
  assert.equal(rows.length, L.MAX_VIEW_RESULTS);
  assert.ok(rows.every((r) => r.type === "view" && r.dash === "lovelace"));
  assert.equal(L.firstResult(rows), "lovelace/front");
});

test("dashboardViews: titled, top-level views of dashboards with several views, visible to the user", () => {
  const config = {
    views: [
      { title: "Home" },
      { title: "Cams", path: "cams" },
      { title: "Sub", path: "sub", subview: true },
      { title: "Admins", path: "adm", visible: [{ user: "u1" }] },
      { path: "untitled" },
      { title: "Bad path", path: "a/b" },
    ],
  };
  assert.deepEqual(
    L.dashboardViews("dash", config, "u2").map((v) => v.path),
    ["dash/0", "dash/cams", "dash/5"],
  );
  assert.deepEqual(L.dashboardViews("dash", config, "u1").map((v) => v.path), ["dash/0", "dash/cams", "dash/adm", "dash/5"]);
  assert.deepEqual(L.dashboardViews("dash", { views: [{ title: "Only" }] }, "u1"), []);
  assert.deepEqual(L.dashboardViews("dash", { strategy: {} }, "u1"), []);
});

/* ---- parity with the server and the frontend wiring ---- */

test("key lists and limits match const.py", () => {
  assert.match(PY, /LINK_KEYS = \("name", "icon", "url", "new_tab"\)/);
  assert.match(PY, /ITEM_KEYS = \("badge", "show_when", "aliases"\)/);
  assert.deepEqual(L.LINK_KEYS, ["name", "icon", "url", "new_tab"]);
  assert.deepEqual(L.ITEM_KEYS, ["badge", "show_when", "aliases"]);
  assert.match(PY, new RegExp(`MAX_LINKS = ${L.MAX_LINKS}\\b`));
  assert.match(PY, new RegExp(`MAX_URL = ${L.MAX_URL}\\b`));
  assert.match(PY, new RegExp(`MAX_ALIASES = ${L.MAX_ALIASES}\\b`));
});

test("frontend: link rows are HA's rows pointed at the address; badges re-render on state changes; phone bar", () => {
  assert.match(SRC, /const LINK_ROW = "esp-link-";/);
  assert.match(SRC, /if \(item\.href !== link\.url\) item\.href = link\.url;/);
  assert.match(SRC, /const newTab = L\.isExternal\(link\.url\) \|\| link\.new_tab === true;/);
  assert.match(SRC, /if \(c\?\.statesChanged\(\)\) return true;/);
  assert.match(SRC, /const bottom = this\.sb\.hasAttribute\("narrow"\);/);
  assert.match(SRC, /:host\(\[bottom\]\) \{ top: auto; bottom: 0; z-index: 4;/);
  // h() flattens nested child lists (option fields return several elements).
  assert.match(SRC, /for \(const c of children\.flat\(Infinity\)\)/);
});
