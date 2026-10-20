// v0.8: action rows, hold / double tap, state rules, panel labels, export / import.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");
const PY = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/const.py", import.meta.url), "utf8");

const layout = {
  version: 1,
  order: ["g:home", "map", "l:nas", "a:lamp"],
  groups: { home: { name: "Home", panels: ["history"] } },
  links: { nas: { name: "NAS", url: "http://nas.local" } },
  actions: { lamp: { name: "Lamp", icon: "mdi:lamp", tap: { type: "toggle", entity: "light.lamp" } } },
};

test("cleanAction keeps what belongs to the type and refuses the rest", () => {
  assert.deepEqual(L.cleanAction({ type: "toggle", entity: "light.a", service: "x.y" }), { type: "toggle", entity: "light.a" });
  assert.equal(L.cleanAction({ type: "toggle" }), null);
  assert.deepEqual(L.cleanAction({ type: "more-info", entity: "sensor.x" }), { type: "more-info", entity: "sensor.x" });
  assert.deepEqual(L.cleanAction({ type: "call-service", service: "scene.turn_on", entity: "scene.a", data: { a: 1 } }), {
    type: "call-service",
    service: "scene.turn_on",
    entity: "scene.a",
    data: { a: 1 },
  });
  assert.deepEqual(L.cleanAction({ type: "call-service", service: "a.b", data: {} }), { type: "call-service", service: "a.b" });
  assert.equal(L.cleanAction({ type: "call-service", service: "nodot" }), null);
  assert.equal(L.cleanAction({ type: "call-service", service: "a.b", data: [1] }), null);
  assert.equal(L.cleanAction({ type: "call-service", service: "a.b", data: { k: "x".repeat(1001) } }), null);
  assert.deepEqual(L.cleanAction({ type: "navigate", path: "/config" }), { type: "navigate", path: "/config" });
  assert.equal(L.cleanAction({ type: "navigate", path: "https://x.y" }), null);
  assert.equal(L.cleanAction({ type: "navigate", path: "//evil.com" }), null);
  assert.equal(L.cleanAction({ type: "none" }), null);
  assert.equal(L.cleanAction(null), null);
});

test("a tap cannot navigate", () => {
  assert.equal(L.cleanAction({ type: "navigate", path: "/config" }, true), null);
  assert.deepEqual(L.cleanAction({ type: "toggle", entity: "light.a" }, true), { type: "toggle", entity: "light.a" });
});

test("cleanActionRow needs a name and a usable tap", () => {
  assert.deepEqual(L.cleanActionRow(layout.actions.lamp), layout.actions.lamp);
  assert.equal(L.cleanActionRow({ name: "", tap: { type: "toggle", entity: "light.a" } }), null);
  assert.equal(L.cleanActionRow({ name: "Lamp", tap: { type: "toggle" } }), null);
  assert.equal(L.cleanActionRow({ name: "Lamp", icon: "javascript:x", tap: { type: "toggle", entity: "light.a" } }).icon, null);
});

test("cleanItem keeps gestures, state rules and a label on rows; none on groups; no label on links and actions", () => {
  const item = {
    hold: { type: "navigate", path: "/config" },
    double_tap: { type: "toggle", entity: "light.a" },
    state_rules: [{ entity: "binary_sensor.d", when: "active", icon: "mdi:door-open", color: "red" }],
    label: " Karta ",
  };
  const out = L.cleanItem(item, "map");
  assert.deepEqual(out.hold, item.hold);
  assert.deepEqual(out.double_tap, item.double_tap);
  assert.equal(out.state_rules.length, 1);
  assert.equal(out.label, "Karta");
  assert.equal(L.cleanItem(item, "g:home"), null);
  assert.equal(L.cleanItem(item, "l:nas").label, undefined);
  assert.equal(L.cleanItem(item, "a:lamp").label, undefined);
  assert.equal(L.cleanItem({ label: "   " }, "map"), null);
});

test("cleanStateRules keeps three valid rules; a rule needs an icon or a colour", () => {
  const rules = [
    { entity: "a.b", when: "active", icon: "mdi:x" },
    { entity: "a.c", when: "sometimes", color: "red" },
    { entity: "a.d", when: "inactive" },
    { entity: "a.e", when: "inactive", color: "#ABC" },
    { entity: "a.f", when: "active", color: "teal" },
    { entity: "a.g", when: "active", color: "teal" },
    { entity: "a.h", when: "active", color: "teal" },
  ];
  assert.deepEqual(L.cleanStateRules(rules).map((r) => r.entity), ["a.b", "a.f", "a.g"], "#ABC is not a stored colour; the rest is capped at three");
});

test("ruleLook: the first matching rule wins", () => {
  const item = {
    state_rules: [
      { entity: "binary_sensor.d", when: "active", icon: "mdi:door-open", color: "red" },
      { entity: "binary_sensor.d", when: "inactive", color: "green" },
    ],
  };
  assert.deepEqual(L.ruleLook(item, () => true), { icon: "mdi:door-open", color: "red" });
  assert.deepEqual(L.ruleLook(item, () => false), { icon: null, color: "green" });
  assert.equal(L.ruleLook({}, () => true), null);
});

test("watchedEntities includes the state rules' entities", () => {
  const items = { map: { state_rules: [{ entity: "binary_sensor.d", when: "active", color: "red" }] } };
  assert.deepEqual(L.watchedEntities({ items }), ["binary_sensor.d"]);
});

test("action rows are placed like links: buildTree, toLayout and metaOf", () => {
  const tree = L.buildTree(layout, ["map", "history"]);
  assert.ok(L.flatten(tree).includes("a:lamp"));
  const meta = L.metaOf(layout);
  assert.deepEqual(meta.actions, layout.actions);
  const out = L.toLayout(tree, {}, meta);
  assert.deepEqual(out.actions, layout.actions);
  assert.ok(out.order.includes("a:lamp"));
  // an unfinished action row is left out, and a layout without any has no `actions` key (v0.7 layouts save unchanged)
  meta.actions.lamp.tap = { type: "toggle" };
  const without = L.toLayout(tree, {}, meta);
  assert.equal("actions" in without, false);
  assert.equal(without.order.includes("a:lamp"), false);
});

test("an action row cannot go into a tabbed group, and a save moves one out", () => {
  const tree = L.buildTree({ ...layout, groups: { home: { name: "Home", tabbed: true, panels: ["history"] } } }, ["map", "history"]);
  assert.equal(L.move(tree, "p:a:lamp", "g:home", "into"), tree);
  assert.equal(L.move(tree, "p:a:lamp", "p:history", "after"), tree);
  assert.equal(L.moveTo(tree, "p:a:lamp", "home"), tree);
  const open = L.buildTree(layout, ["map", "history"]);
  const moved = L.move(open, "p:a:lamp", "g:home", "into");
  assert.notEqual(moved, open);
  // forced into a tabbed group anyway, toLayout puts it after the group
  const forced = L.updateGroup(moved, "home", { tabbed: true });
  const out = L.toLayout(forced, {}, L.metaOf(layout));
  assert.deepEqual(out.groups.home.panels, ["history"]);
  assert.ok(out.order.includes("a:lamp"));
  assert.equal(L.tabbedHasActions(forced, "home"), true);
});

test("the stored layout round-trips through the model", () => {
  const tree = L.buildTree(layout, ["map", "history"]);
  const items = { map: { label: "Karta", hold: { type: "toggle", entity: "light.a" } }, "a:lamp": { double_tap: { type: "more-info", entity: "light.lamp" } } };
  const meta = { ...L.metaOf(layout), items };
  const out = L.toLayout(tree, {}, meta);
  assert.equal(out.items.map.label, "Karta");
  assert.equal(out.items["a:lamp"].double_tap.type, "more-info");
});

test("checkImport accepts layouts of this version only", () => {
  assert.equal(L.checkImport(layout), null);
  assert.equal(L.checkImport({ version: 2, order: [] }), "version");
  assert.equal(L.checkImport({ version: "1", order: [] }), "invalid");
  assert.equal(L.checkImport([]), "invalid");
  assert.equal(L.checkImport(null), "invalid");
  assert.equal(L.checkImport({ version: 1 }), "invalid");
  assert.equal(L.checkImport({ version: 1, order: [], groups: [] }), "invalid");
  assert.equal(L.checkImport({ version: 1, order: [], items: "x" }), "invalid");
  assert.equal(L.MAX_IMPORT_BYTES, 256 * 1024);
});

test("key lists and limits match const.py", () => {
  assert.match(PY, /ACTION_PREFIX = "a:"/);
  assert.match(PY, new RegExp(`MAX_ACTIONS = ${L.MAX_ACTIONS}\\b`));
  assert.match(PY, new RegExp(`MAX_ACTION_DATA = ${L.MAX_ACTION_DATA}\\b`));
  assert.match(PY, new RegExp(`MAX_STATE_RULES = ${L.MAX_STATE_RULES}\\b`));
  const tuple = (name) => PY.match(new RegExp(`${name} = \\(([^)]*)\\)`))[1].split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean);
  assert.deepEqual(tuple("ACTION_KEYS"), L.ACTION_KEYS);
  assert.deepEqual(tuple("ACTION_TYPES"), L.ACTION_TYPES);
  assert.deepEqual(tuple("TAP_TYPES"), L.TAP_TYPES);
  assert.deepEqual(tuple("STATE_RULE_KEYS"), L.STATE_RULE_KEYS);
  assert.deepEqual(tuple("STATE_RULE_WHEN"), L.STATE_RULE_WHEN);
  assert.deepEqual(tuple("ITEM_KEYS"), L.ITEM_KEYS);
});

test("the sidebar wires actions, gestures, state rules and labels", () => {
  assert.match(SRC, /const ACTION_ROW = "esp-action-";/);
  assert.match(SRC, /\.\.\.L\.actionPaths\(layout\)\]\.filter/);
  assert.match(SRC, /this\.decorate\(layout, visible, states\);/);
  assert.match(SRC, /root\.addEventListener\("contextmenu"/);
  assert.match(SRC, /e\.key === "Enter" && e\.shiftKey/);
  assert.match(SRC, /e\.key === "Enter" && e\.altKey/);
  assert.match(SRC, /"hass-more-info"/);
  assert.match(SRC, /callService\("homeassistant", "toggle"/);
  assert.match(SRC, /setAttr\(item, "aria-description", this\.gestureHint\(path\)\)/);
  // a state rule's colour wins over the row's own; its icon is laid over the panel
  assert.match(SRC, /this\.looks\.get\(p\)\?\.color \?\? items\[p\]\?\.color/);
  assert.match(SRC, /panel && icon \? \{ \.\.\.panel, icon \} : panel/);
  assert.match(SRC, /if \(label\) panel = \{ \.\.\.panel, title: label \}/);
  // search finds a label and the original name
  assert.match(SRC, /layout\?\.items\?\.\[p\.url_path\]\?\.label \?\? "", panelTitle/);
});

test("the editor offers actions, gestures, rules, labels, export and import", () => {
  for (const a of ["addAction", "setActionRow", "removeAction", "setActionType", "setActionField", "setLabel", "addRule", "removeRule", "setRule"])
    assert.ok(SRC.includes(`${a}: (`), a);
  assert.match(SRC, /addBtn\("addaction"/);
  assert.match(SRC, /this\.actionEditor\(key, ikey, "hold"/);
  assert.match(SRC, /this\.actionEditor\(key, ikey, "double_tap"/);
  assert.match(SRC, /this\.actionEditor\(key, path, "tap"/);
  assert.match(SRC, /exportLayout\(\) \{/);
  assert.match(SRC, /importLayout\(\) \{/);
  assert.match(SRC, /L\.checkImport\(data\)/);
  assert.doesNotMatch(SRC, /innerHTML/);
});

test("every new string exists in English and Hebrew", () => {
  const strings = (lang) => {
    const start = SRC.indexOf(`  ${lang}: {`);
    return SRC.slice(start, SRC.indexOf("\n  },", start));
  };
  const en = strings("en");
  const he = strings("he");
  for (const key of [
    "addAction", "newAction", "tapLabel", "holdLabel", "doubleLabel", "actToggle", "actService", "actDataInvalid", "gesturesHelp", "ruleHeading", "ruleAdd",
    "labelField", "incomplete", "holdDesc", "doubleDesc", "exportLayout", "importLayout", "importDone", "importInvalid", "importVersion", "importTooBig", "actionFailed",
  ]) {
    assert.ok(en.includes(`    ${key}: "`), `en ${key}`);
    assert.ok(he.includes(`    ${key}: "`), `he ${key}`);
  }
});
