// v0.7 (issue #64): badge colour and extra badges per item.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");

test("cleanItem keeps a badge colour only with a badge entity", () => {
  assert.equal(L.cleanItem({ badge: "sensor.a", badge_color: "red" }, "map").badge_color, "red");
  assert.equal(L.cleanItem({ badge: "sensor.a", badge_color: "g" }, "map").badge_color, undefined);
  assert.equal(L.cleanItem({ badge_color: "red" }, "map"), null);
  assert.equal(L.cleanItem({ badge: "sensor.a", badge_color: "red" }, "g:home").badge_color, "red");
});

test("cleanItem keeps up to three valid extra badges, none on a group", () => {
  const more = [{ entity: "sensor.a", color: "#ffa500" }, { entity: "bad" }, { entity: "sensor.b" }, { entity: "sensor.c", color: "nope" }, { entity: "sensor.d" }];
  assert.deepEqual(L.cleanItem({ more_badges: more }, "map").more_badges, [
    { entity: "sensor.a", color: "#ffa500" },
    { entity: "sensor.b", color: null },
    { entity: "sensor.c", color: null },
  ]);
  assert.equal(L.cleanItem({ more_badges: more }, "g:home"), null);
  assert.equal(L.cleanItem({ more_badges: [{ entity: "" }] }, "map"), null, "a draft without an entity is not saved");
});

test("badgeSpecs lists the own badge first, then the extra ones", () => {
  assert.deepEqual(L.badgeSpecs({ badge: "sensor.a", badge_color: "red", more_badges: [{ entity: "sensor.b", color: "amber" }] }), [
    { entity: "sensor.a", color: "red" },
    { entity: "sensor.b", color: "amber" },
  ]);
  assert.deepEqual(L.badgeSpecs({ more_badges: [{ entity: "sensor.b" }] }), [{ entity: "sensor.b", color: null }]);
  assert.deepEqual(L.badgeSpecs(undefined), []);
});

test("watchedEntities and ruleOf include the extra badges", () => {
  const layout = { items: { map: { badge: "sensor.a", more_badges: [{ entity: "sensor.b" }], show_when: "binary_sensor.c" } } };
  assert.deepEqual(L.watchedEntities(layout).sort(), ["binary_sensor.c", "sensor.a", "sensor.b"]);
  assert.equal(L.ruleOf(layout.items.map, () => true).badge, "sensor.a, sensor.b");
  assert.equal(L.ruleOf({ more_badges: [{ entity: "sensor.b" }] }, () => true).badge, "sensor.b");
});

test("toLayout saves badge colours and extras on panels and links, extras not on groups", () => {
  const layout = { version: 1, order: ["g:home", "map", "l:nas"], groups: { home: { name: "Home", panels: ["history"] } }, links: { nas: { name: "NAS", url: "http://nas.local" } } };
  const tree = L.buildTree(layout, ["map", "history", "l:nas"]);
  const meta = L.metaOf(layout);
  meta.items = {
    map: { badge: "sensor.a", badge_color: "red", more_badges: [{ entity: "sensor.b", color: "orange" }, { entity: "" }] },
    "g:home": { badge: "sensor.g", badge_color: "teal", more_badges: [{ entity: "sensor.h" }] },
  };
  const out = L.toLayout(tree, {}, meta);
  assert.equal(out.items.map.badge_color, "red");
  assert.deepEqual(out.items.map.more_badges, [{ entity: "sensor.b", color: "orange" }]);
  assert.equal(out.items["g:home"].badge_color, "teal");
  assert.equal(out.items["g:home"].more_badges, undefined);
});

test("the sidebar draws every active badge side by side, tinted; the editor edits them", () => {
  assert.match(SRC, /const style = color \? `--esp-badge-color: \$\{L\.colorCss\(color\)\}` : null;/);
  assert.match(SRC, /var\(--esp-badge-color, var\(--accent-color\)\)/);
  assert.match(SRC, /\.badge\.esp-badge\[slot="end"\] ~ \.badge\.esp-badge\[slot="end"\] \{ margin-inline-start: 4px; \}/);
  assert.match(SRC, /setVar\(this\._badge, "--esp-badge-color"/);
  assert.match(SRC, /field: "badge", labelKey: "badgeColor"/);
  for (const a of ["setBadgeColor", "setMoreBadge", "addMoreBadge", "removeMoreBadge"]) assert.ok(SRC.includes(`${a}: (`));
});
