// Regression tests for the v0.3.0 QA cycle: BUG-015 (#30), UX-008 (#31), UX-009 (#32), expand all vs accordion.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// Namespace import: on the unfixed code a missing export fails its own test, not the whole file.
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const { adoptOrder, anyOpen, toggleAll } = L;
const allAction = (...a) => L.allAction(...a);

const MODULE = new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url);

test("UX-008 (#31): HA's dialog order applies to pinned panels too; they stay pinned", () => {
  const layout = { version: 1, order: ["g:a", "map", "energy", "logbook"], groups: { a: { name: "A", icon: null, panels: ["home"] } }, grid: ["todo", "calendar", "media-browser"] };
  // HA's dialog moved the pinned Media to the very top.
  const out = adoptOrder(layout, ["media-browser", "home", "map", "energy", "logbook", "todo", "calendar"]);
  assert.deepEqual(out.grid, ["media-browser", "todo", "calendar"]);
  assert.deepEqual(out.order, layout.order);
  // Reordered only among the pins.
  assert.deepEqual(adoptOrder(layout, ["home", "map", "energy", "logbook", "calendar", "todo", "media-browser"]).grid, ["calendar", "todo", "media-browser"]);
  // A pin HA does not list keeps its slot; an unchanged order is a no-op.
  assert.deepEqual(adoptOrder(layout, ["home", "map", "energy", "logbook", "media-browser", "todo"]).grid, ["media-browser", "calendar", "todo"]);
  assert.equal(adoptOrder(layout, ["home", "map", "energy", "logbook", "todo", "calendar", "media-browser"]), null);
  // Layouts without a grid (v0.2) stay without one.
  assert.equal("grid" in adoptOrder({ version: 1, order: ["map", "home"], groups: {} }, ["home", "map"]), false);
});

test("Expand all respects 'one group open at a time': collapse only, hidden when all are folded", () => {
  const ids = ["a", "b", "c"];
  assert.equal(allAction(["a"], ids, true), "collapse");
  assert.equal(allAction(ids, ids, true), null);
  assert.equal(allAction(ids, ids, false), "expand");
  // Accordion: toggling with everything folded opens nothing (never several groups at once).
  assert.deepEqual(toggleAll(["a", "b", "c", "x"], ids, true), ["a", "b", "c", "x"]);
  assert.equal(anyOpen(toggleAll(["a", "b", "c"], ids, true), ids), false);
  assert.deepEqual(toggleAll(["a"], ids, true).sort(), ["a", "b", "c"]);
  // Without accordion nothing changes.
  assert.deepEqual(toggleAll(["a", "b", "c", "x"], ids), ["x"]);
});

test("UX-009 (#32): the sidebar title takes its direction from its own text (cut at its end in RTL)", () => {
  const text = fs.readFileSync(MODULE, "utf8");
  const rule = text.split("\n").find((l) => l.startsWith(".menu .title {"));
  assert.ok(rule, "no .menu .title rule");
  assert.match(rule, /text-overflow: ellipsis/);
  assert.match(rule, /unicode-bidi: plaintext/);
  // ...while staying on the header's side when it fits ("start" would follow the text's direction).
  assert.match(rule, /text-align: left/);
  assert.match(text, /:host\(:dir\(rtl\)\) \.menu \.title \{ text-align: right; \}/);
});

/* ---- BUG-015 (#30): a minimal DOM, enough to load the module and drive the patched ha-sidebar. ---- */

const theme = { dark: true };
const COLORS = {
  light: { "--primary-background-color": "rgb(250, 250, 250)", "--sidebar-background-color": "rgb(255, 255, 255)", "--sidebar-text-color": "rgb(33, 33, 33)" },
  dark: { "--primary-background-color": "rgb(17, 17, 17)", "--sidebar-background-color": "rgb(28, 28, 28)", "--sidebar-text-color": "rgb(225, 225, 225)" },
};
const resolve = (css) => {
  const name = /var\((--[a-z-]+)/.exec(css ?? "")?.[1];
  if (name === "--amber-color") return "rgb(255, 193, 7)";
  return COLORS[theme.dark ? "dark" : "light"][name] ?? "rgb(0, 0, 0)";
};
class FakeStyle {
  constructor() {
    this.props = new Map();
    this.color = "";
    this.cssText = "";
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
    // HA 2026.9: hass changes count only for panels, user data, states...; themes are ignored.
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

test("BUG-015 (#30): a theme change alone re-renders the sidebar and the group colours follow it", async () => {
  await import(MODULE);
  registry.set("ha-sidebar", FakeSidebar);
  sidebarDefined();
  await sidebarReady;
  await new Promise((r) => setTimeout(r, 0));
  const p = FakeSidebar.prototype;
  assert.equal(globalThis.__easySidebarPro?.status, "active");

  const layout = { version: 1, order: ["g:cams", "map"], groups: { cams: { name: "Cameras", icon: null, color: "amber", icon_color: null, panels: ["energy"] } } };
  const connection = {
    subscribeMessage(cb, msg) {
      if (msg.type === "easy_sidebar_pro/subscribe") cb({ layout, collapsed: [], own: true, default: null, is_admin: true });
      return new Promise(() => {});
    },
  };
  const panels = ["map", "energy"].map((url_path) => ({ url_path, title: url_path, icon: "mdi:x" }));
  const sb = new FakeSidebar();
  sb.alwaysExpand = true;
  sb.attachShadow();
  sb.hass = { connection, language: "en", panels: {}, themes: { darkMode: true, theme: "default" } };
  p.connectedCallback.call(sb);
  const render = () => p._renderPanels.call(sb, panels, "map").find((el) => el instanceof FakeEl);
  const dark = render().style.getPropertyValue("--esp-own-color");
  assert.ok(dark, "group colour set");

  // HA applies the light theme variables, then replaces hass.themes (only that changes).
  p.shouldUpdate.call(sb, new Map());
  theme.dark = false;
  const old = sb.hass;
  sb.hass = { ...old, themes: { darkMode: false, theme: "default" } };
  assert.equal(p.shouldUpdate.call(sb, new Map([["hass", old]])), true, "theme change must re-render the sidebar");
  const light = render().style.getPropertyValue("--esp-own-color");
  assert.notEqual(light, dark);
  // Amber on white is adjusted to at least 4.5:1, i.e. darker than the raw colour shown on dark.
  assert.notEqual(light, "rgb(255, 193, 7)");
  // Once re-rendered, unrelated hass updates go back to HA's own rule.
  assert.equal(p.shouldUpdate.call(sb, new Map([["hass", sb.hass]])), false);
  sb.hass = { ...sb.hass };
  assert.equal(p.shouldUpdate.call(sb, new Map([["hass", old]])), false);
});
