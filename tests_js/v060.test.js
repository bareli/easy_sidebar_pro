// v0.6 (forum #15): an item's own icon colour.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");

test("cleanItem keeps a valid colour, only when set and not on a group key", () => {
  assert.deepEqual(L.cleanItem({ color: "red" }, "map"), { badge: null, show_when: null, aliases: "", color: "red" });
  assert.deepEqual(L.cleanItem({ color: "#00ff00" }, "l:nas"), { badge: null, show_when: null, aliases: "", color: "#00ff00" });
  assert.equal(L.cleanItem({ color: null }, "map"), null);
  assert.equal(L.cleanItem({ color: "chartreuse" }, "map"), null);
  assert.equal(L.cleanItem({ color: "#ABC" }, "map"), null, "stored colours are normalised #rrggbb");
  assert.equal(L.cleanItem({ color: "red" }, "g:home"), null);
  assert.equal("color" in L.cleanItem({ aliases: "x" }, "map"), false);
});

test("toLayout writes item colours for panels and links, drops them on groups", () => {
  const layout = { version: 1, order: ["g:home", "map", "l:nas"], groups: { home: { name: "Home", panels: ["history"] } }, links: { nas: { name: "NAS", url: "http://nas.local" } } };
  const tree = L.buildTree(layout, ["map", "history", "l:nas"]);
  const meta = L.metaOf(layout);
  meta.items = { map: { color: "teal" }, history: { color: "#112233", badge: "sensor.x" }, "l:nas": { color: "amber" }, "g:home": { color: "red" } };
  const out = L.toLayout(tree, {}, meta);
  assert.equal(out.items.map.color, "teal");
  assert.equal(out.items.history.color, "#112233");
  assert.equal(out.items["l:nas"].color, "amber");
  assert.equal(out.items["g:home"], undefined);
});

test("the editor offers the colour on panel and link rows; the sidebar paints HA's rows and pinned rows", () => {
  assert.match(SRC, /if \(path\)\s+parts\.push\(\s+this\.colorPicker\(\{ id: ikey, field: "item"/);
  assert.match(SRC, /setItemColor: \(ikey, color\) =>/);
  assert.match(SRC, /\.row\[data-item-color\] > \.icon \{ color: var\(--esp-item-color\); \}/);
  assert.match(SRC, /ha-list-item-button:is\(\[data-esp-group\], \[data-esp-color\]\):not\(\.selected\) ha-svg-icon\[slot="start"\]/);
  // own colour wins over the group's icon colour, in the main list and the pinned list
  assert.match(SRC, /this\.tintRow\(item, path, look\?\.member\)/);
  assert.match(SRC, /this\.tintRow\(item, path, null\)/);
  assert.match(SRC, /setVar\(item, "--esp-own-icon-color", tone \?\? member\)/);
});
