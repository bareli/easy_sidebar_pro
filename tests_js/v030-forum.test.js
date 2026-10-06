// v0.3.0 forum requests: per-group "starts open" (#33) and the "pill" header style (#34).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const MODULE = new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url);
const PATHS = ["home", "map", "energy", "todo", "calendar", "logbook", "history"];
// The forum layout: a main group that starts open, two that start closed, one open at a time.
const FORUM = {
  version: 1,
  order: ["home", "g:main", "g:media", "g:system"],
  groups: {
    main: { name: "Main", icon: "mdi:home", color: null, icon_color: null, start_open: true, panels: ["map", "energy"] },
    media: { name: "Media", icon: null, color: "blue", icon_color: null, start_open: false, panels: ["todo"] },
    system: { name: "System", icon: null, color: null, icon_color: null, start_open: true, panels: ["calendar"] },
  },
  grid: ["logbook", "history"],
  settings: { start_collapsed: true, accordion: true, toggle_all: false, hide_count: false, search: false, header: "pill", divider: "line" },
};

test("#33 start_open round-trips through the tree; new groups and old layouts default to false", () => {
  const tree = L.buildTree(FORUM, PATHS);
  assert.equal(tree.find((n) => n.id === "main").start_open, true);
  assert.equal(tree.find((n) => n.id === "media").start_open, false);
  const out = L.toLayout(tree, FORUM.settings);
  assert.deepEqual(Object.keys(out.groups.main), L.GROUP_KEYS);
  assert.equal(out.groups.main.start_open, true);
  assert.equal(out.groups.media.start_open, false);
  // v0.1 / v0.2 layout without the key, or a non-boolean value: false
  const old = { version: 1, order: ["g:a"], groups: { a: { name: "A", icon: null, panels: ["map"] } } };
  assert.equal(L.toLayout(L.buildTree(old, PATHS)).groups.a.start_open, false);
  assert.equal(L.buildTree({ ...old, groups: { a: { ...old.groups.a, start_open: "yes" } } }, PATHS)[0].start_open, false);
  assert.equal(L.merge(L.buildTree(null, PATHS), "p:map", "p:home", "n1", "N").find((n) => n.id === "n1").start_open, false);
  assert.equal(L.addGroup([], "n2", "N")[0].start_open, false);
  assert.equal(L.pinsNode().start_open, false);
  // editing it is a structure change (saved), and HA's order adoption keeps it
  const on = L.updateGroup(tree, "media", { start_open: true });
  assert.equal(L.editKind(tree, on, new Set(), new Set(), FORUM.settings, FORUM.settings), "structure");
  assert.equal(L.adoptOrder(FORUM, ["calendar", "todo", "map", "energy", "home"]).groups.main.start_open, true);
});

test("#33 page load with 'start collapsed': starts-open groups unfold; accordion opens only the first shown one", () => {
  // without accordion: every starts-open group
  assert.deepEqual(L.initialCollapsed({ ...FORUM }, PATHS, false), ["media"]);
  // accordion: the first in sidebar order
  assert.deepEqual(L.initialCollapsed(FORUM, PATHS, true).sort(), ["media", "system"]);
  // order decides, not the object's key order
  const swapped = { ...FORUM, order: ["home", "g:system", "g:media", "g:main"] };
  assert.deepEqual(L.initialCollapsed(swapped, PATHS, true).sort(), ["main", "media"]);
  // a starts-open group with nothing visible is skipped: the next one opens
  assert.deepEqual(L.initialCollapsed(FORUM, ["home", "todo", "calendar"], true).sort(), ["main", "media"]);
  // none marked: all folded (v0.3 behaviour before #33)
  const none = { ...FORUM, groups: Object.fromEntries(Object.entries(FORUM.groups).map(([k, g]) => [k, { ...g, start_open: false }])) };
  assert.deepEqual(L.initialCollapsed(none, PATHS, true).sort(), ["main", "media", "system"]);
  assert.deepEqual(L.initialCollapsed(null, PATHS, true), []);
  // the result arranges as expected
  const rows = L.arrange(FORUM, PATHS, L.initialCollapsed(FORUM, PATHS, true), "home");
  assert.deepEqual(
    rows.filter((r) => r.type === "group").map((r) => `${r.id}:${r.collapsed}`),
    ["main:false", "media:true", "system:true"],
  );
});

test("#34 pill is a header style on both sides; settings keep it", () => {
  assert.ok(L.HEADER_STYLES.includes("pill"));
  assert.equal(L.cleanSettings({ header: "pill" }).header, "pill");
  assert.equal(L.cleanSettings({ header: "Pill" }).header, "plain");
  const py = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/const.py", import.meta.url), "utf8");
  assert.match(py, /HEADER_STYLES = \("plain", "tinted", "line", "pill"\)/);
  assert.match(py, /GROUP_KEYS = \("name", "icon", "color", "icon_color", "start_open", "tabbed", "panels"\)/);
});

test("#34 pill background: lighter on dark themes, darker on light ones, group colour tinted; text stays readable", () => {
  const dark = { bg: [28, 28, 28], text: [225, 225, 225], headerBg: null };
  const light = { bg: [255, 255, 255], text: [33, 33, 33], headerBg: null };
  const d = L.pillBackground(dark);
  const l = L.pillBackground(light);
  assert.ok(L.luminance(d) > L.luminance(dark.bg), "lighter on dark");
  assert.ok(L.luminance(l) < L.luminance(light.bg), "darker on light");
  // a theme's header background wins over the neutral step
  assert.deepEqual(L.pillBackground({ ...dark, headerBg: [10, 20, 30] }), [10, 20, 30]);
  // a group colour tints it, still a step lighter than the dark sidebar
  const blue = L.pillBackground(dark, [33, 150, 243, 1]);
  assert.ok(blue[2] > blue[0]);
  assert.ok(L.luminance(blue) > L.luminance(dark.bg));
  // the secondary text (count) and the theme's own text keep 4.5:1 on it after the usual adjustment
  for (const [pal, sub] of [[dark, [158, 158, 158]], [light, [114, 114, 114]]]) {
    const bg = L.pillBackground(pal);
    assert.ok(L.contrast(L.readable(sub, bg, pal.text, 4.5), bg) >= 4.5);
    assert.ok(L.contrast(pal.text, bg) >= 4.5);
  }
});

test("#33 editor: a 'starts open' toggle on the group row, shown only while groups start collapsed; he + en", () => {
  const text = fs.readFileSync(MODULE, "utf8");
  assert.match(text, /class: "icon-btn open-btn"/);
  assert.match(text, /"aria-pressed": String\(node\.start_open === true\)/);
  assert.match(text, /:host\(:not\(\[start-collapsed\]\)\) \.open-btn \{ display: none; \}/);
  for (const key of ["startOpen", "header_pill"]) assert.equal(text.match(new RegExp(`^    ${key}: "`, "gm"))?.length, 2, key);
  assert.match(text, /:host\(\[header="pill"\]\) \.row \{ border-radius: var\(--esp-group-header-radius, 20px\);/);
});

/* ---- Controller: a minimal DOM, enough to load the module and drive the patched ha-sidebar. ---- */

const VARS = {
  "--primary-background-color": "rgb(17, 17, 17)",
  "--sidebar-background-color": "rgb(28, 28, 28)",
  "--sidebar-text-color": "rgb(225, 225, 225)",
  "--secondary-text-color": "rgb(158, 158, 158)",
  "--sidebar-icon-color": "rgb(158, 158, 158)",
  "--primary-color": "rgb(3, 169, 244)",
  "--blue-color": "rgb(33, 150, 243)",
};
// Resolves `var(--a, var(--b, fallback))` like the browser: the first defined variable, else the fallback.
const resolve = (css) => {
  const s = String(css ?? "");
  for (const m of s.matchAll(/var\((--[a-z-]+)/g)) if (VARS[m[1]]) return VARS[m[1]];
  if (/transparent\)*$/.test(s)) return "rgba(0, 0, 0, 0)";
  const hex = /#([0-9a-f]{6})/i.exec(s)?.[1];
  if (hex) return `rgb(${[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
  const rgb = /rgb\([^)]*\)/.exec(s);
  return rgb ? rgb[0] : "rgb(0, 0, 0)";
};
class FakeStyle {
  constructor() {
    this.props = new Map();
    this.color = "";
  }
  getPropertyValue(n) {
    return this.props.get(n) ?? "";
  }
  setProperty(n, v) {
    this.props.set(n, v);
  }
  removeProperty(n) {
    this.props.delete(n);
  }
}
class FakeEl {
  constructor() {
    this.style = new FakeStyle();
    this.attrs = new Map();
    this.children = [];
    this.isConnected = true;
  }
  setAttribute(n, v) {
    this.attrs.set(n, String(v));
  }
  getAttribute(n) {
    return this.attrs.get(n) ?? null;
  }
  hasAttribute(n) {
    return this.attrs.has(n);
  }
  removeAttribute(n) {
    this.attrs.delete(n);
  }
  toggleAttribute(n, force) {
    const on = force ?? !this.attrs.has(n);
    if (on) this.attrs.set(n, "");
    else this.attrs.delete(n);
    return on;
  }
  append(...c) {
    this.children.push(...c);
  }
  addEventListener() {}
  dispatchEvent() {}
  attachShadow() {
    this.shadowRoot = new FakeEl();
    return this.shadowRoot;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  closest() {
    return null;
  }
}
const registry = new Map();
let sidebarDefined;
const sidebarReady = new Promise((r) => (sidebarDefined = r));
class FakeSidebar extends FakeEl {
  _renderPanels() {
    return [];
  }
  _renderPanel(panel) {
    return { panel: panel.url_path };
  }
  shouldUpdate() {
    return false;
  }
  requestUpdate() {}
}
Object.assign(globalThis, {
  window: globalThis,
  HTMLElement: FakeEl,
  CSSStyleSheet: class {
    replaceSync() {}
  },
  customElements: {
    get: (n) => registry.get(n),
    define: (n, c) => registry.set(n, c),
    whenDefined: (n) => (n === "ha-sidebar" ? sidebarReady : Promise.resolve()),
  },
  document: {
    documentElement: { dir: "ltr" },
    querySelector: () => null,
    createElement: (tag) => (registry.has(tag) ? new (registry.get(tag))() : new FakeEl()),
    createElementNS: () => new FakeEl(),
  },
  getComputedStyle: (el) => ({ color: resolve(el.style.color), direction: "ltr" }),
  localStorage: { getItem: () => null },
});
registry.set("ha-list-nav", class {});
registry.set("ha-list-item-button", class {});

const rgbOf = (css) => L.parseRgb(css).slice(0, 3);

test("#33 + #34 forum layout in the sidebar: main open, others folded; pill colours contrast-safe", async () => {
  await import(MODULE);
  registry.set("ha-sidebar", FakeSidebar);
  sidebarDefined();
  await sidebarReady;
  await new Promise((r) => setTimeout(r, 0));
  const p = FakeSidebar.prototype;
  assert.equal(globalThis.__easySidebarPro?.status, "active");

  let push;
  const connection = {
    subscribeMessage(cb, msg) {
      if (msg.type === "easy_sidebar_pro/subscribe") {
        push = cb;
        // stored fold memory says main is folded: with "start collapsed" the page load ignores it
        cb({ layout: FORUM, collapsed: ["main"], own: true, default: null, is_admin: true });
      }
      return new Promise(() => {});
    },
  };
  const panels = PATHS.map((url_path) => ({ url_path, title: url_path, icon: "mdi:x" }));
  const sb = new FakeSidebar();
  sb.alwaysExpand = true;
  sb.attachShadow();
  sb.hass = { connection, language: "en", panels: {}, themes: { darkMode: true, theme: "default" } };
  p.connectedCallback.call(sb);
  const render = () => p._renderPanels.call(sb, panels, "home");
  const groups = () => render().filter((el) => el instanceof FakeEl);
  let out = render();
  // main (first starts-open) open; system (also starts open) folded by the accordion; media folded
  assert.deepEqual(groups().map((g) => g.hasAttribute("collapsed")), [false, true, true]);
  // (pinned panels stay in the list here: the fake sidebar has no fixed-panel renderer)
  assert.deepEqual(out.filter((r) => r.panel && !FORUM.grid.includes(r.panel)).map((r) => r.panel), ["home", "map", "energy"]);

  // pill: header attribute, own background lighter than the dark sidebar, readable text / count / icon
  const [main, media] = groups();
  assert.equal(main.getAttribute("header"), "pill");
  const bg = rgbOf(main.style.getPropertyValue("--esp-own-bg"));
  assert.ok(L.luminance(bg) > L.luminance([28, 28, 28]));
  assert.ok(L.contrast(rgbOf(main.style.getPropertyValue("--esp-own-color")), bg) >= 4.5);
  assert.ok(L.contrast(rgbOf(main.style.getPropertyValue("--esp-own-sub")), bg) >= 4.5);
  assert.ok(L.contrast(rgbOf(main.style.getPropertyValue("--esp-own-sel")), bg) >= 4.5);
  assert.ok(L.contrast(rgbOf(main.style.getPropertyValue("--esp-own-icon-color")), bg) >= 3);
  // a coloured group's pill is tinted with its colour and its name stays readable on it
  const mbg = rgbOf(media.style.getPropertyValue("--esp-own-bg"));
  assert.ok(mbg[2] > mbg[0]);
  assert.ok(L.contrast(rgbOf(media.style.getPropertyValue("--esp-own-color")), mbg) >= 4.5);

  // later layout pushes (another device saves) do not re-apply the page-load rule
  main.onToggle();
  assert.deepEqual(groups().map((g) => g.hasAttribute("collapsed")), [true, true, true]);
  push({ layout: { ...FORUM }, collapsed: [], own: true, default: null, is_admin: true });
  assert.deepEqual(groups().map((g) => g.hasAttribute("collapsed")), [true, true, true]);

  // without "start collapsed" the stored fold memory applies (starts-open has no effect)
  push({ layout: { ...FORUM, settings: { ...FORUM.settings, start_collapsed: false } }, collapsed: ["main"], own: true, default: null, is_admin: true });
  assert.deepEqual(groups().map((g) => g.hasAttribute("collapsed")), [true, false, false]);

  // plain headers keep v0.3 behaviour: no own background or pill colours
  push({ layout: { ...FORUM, settings: { ...FORUM.settings, start_collapsed: false, header: "plain" } }, collapsed: [], own: true, default: null, is_admin: true });
  const plain = groups()[0];
  assert.equal(plain.getAttribute("header"), "plain");
  assert.equal(plain.style.getPropertyValue("--esp-own-bg"), "");
  assert.equal(plain.style.getPropertyValue("--esp-own-sub"), "");
});
