// #51 PERF-006: controller cleanup runs although ha-sidebar's lifecycle callbacks cannot be patched.
// A minimal DOM (same approach as v030-forum.test.js) loads the module and drives the patched sidebar
// only through _renderPanels, the way the browser does (connectedCallback / disconnectedCallback never run).
import { test } from "node:test";
import assert from "node:assert/strict";

const MODULE = new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url);

class FakeStyle {
  constructor() {
    this.props = new Map();
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
  remove() {}
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
// window listeners by type, so the test can see what the module adds and removes
const listeners = new Map();
Object.assign(globalThis, {
  window: globalThis,
  addEventListener: (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  },
  removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
  location: { pathname: "/lovelace/0", origin: "http://ha.local" },
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
  getComputedStyle: () => ({ color: "rgb(0, 0, 0)", direction: "ltr" }),
  localStorage: { getItem: () => null },
});
registry.set("ha-list-nav", class {});
registry.set("ha-list-item-button", class {});

const LAYOUT = {
  version: 1,
  order: ["map", "l:a"],
  groups: {},
  links: { a: { name: "Automations", icon: null, url: "/config/automation", new_tab: false } },
};
const panels = ["map", "energy"].map((url_path) => ({ url_path, title: url_path, icon: "mdi:x" }));
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A sidebar with a fake connection; `unsubs` counts the module's own unsubscribe calls. */
function sidebar() {
  const sb = new FakeSidebar();
  sb.alwaysExpand = true;
  sb.attachShadow();
  sb.unsubs = { own: 0, native: 0 };
  const connection = {
    subscribeMessage(cb, msg) {
      if (msg.type === "easy_sidebar_pro/subscribe") {
        cb({ layout: LAYOUT, collapsed: [], own: true, default: null, is_admin: false });
        return Promise.resolve(() => sb.unsubs.own++);
      }
      return Promise.resolve(() => sb.unsubs.native++);
    },
  };
  sb.hass = { connection, language: "en", panels: {}, themes: { darkMode: false, theme: "default" }, states: {} };
  return sb;
}
const count = (type) => listeners.get(type)?.size ?? 0;

test("#51 a detached sidebar's controller is released when a new sidebar appears, and on its next location event", async () => {
  await import(MODULE);
  registry.set("ha-sidebar", FakeSidebar);
  sidebarDefined();
  await sidebarReady;
  await tick();
  const p = FakeSidebar.prototype;
  assert.equal(globalThis.__easySidebarPro?.status, "active");

  // First sidebar: rendered by HA (only _renderPanels runs in the browser).
  const a = sidebar();
  p._renderPanels.call(a, panels, "map");
  await tick();
  assert.equal(count("location-changed"), 1);
  assert.equal(count("popstate"), 1);
  assert.deepEqual(a.unsubs, { own: 0, native: 0 });

  // HA drops it and renders a new one: the old controller lets go of its subscriptions and listeners.
  a.isConnected = false;
  const b = sidebar();
  p._renderPanels.call(b, panels, "map");
  await tick();
  assert.deepEqual(a.unsubs, { own: 1, native: 1 }, "old sidebar's subscriptions closed");
  assert.equal(count("location-changed"), 1, "only the new sidebar's listener is left");
  assert.equal(count("popstate"), 1);
  assert.deepEqual(b.unsubs, { own: 0, native: 0 });

  // A detached sidebar whose replacement has not rendered yet: its own location listener disconnects it.
  b.isConnected = false;
  for (const fn of [...listeners.get("location-changed")]) fn();
  await tick();
  assert.deepEqual(b.unsubs, { own: 1, native: 1 });
  assert.equal(count("location-changed"), 0);
  assert.equal(count("popstate"), 0);

  // Back in the page (re-attached): the next render connects it again.
  b.isConnected = true;
  p._renderPanels.call(b, panels, "map");
  await tick();
  assert.equal(count("location-changed"), 1);
});
