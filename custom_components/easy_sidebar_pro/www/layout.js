// Pure layout model for Easy Sidebar Pro. No DOM, no Home Assistant.
//
// Layout (stored):  { version: 1, order: ["path" | "g:<id>"], groups: { id: { name, icon, color, icon_color, panels: [path] } },
//                     grid: [path], settings: { start_collapsed, accordion, toggle_all, header, divider } }
// Tree (editing):   [ { type: "panel", path } | { type: "group", id, name, icon, color, icon_color, children: [panel nodes] } ]
//                   The bottom grid is a group-like node with `pins: true` (id PINS_ID), always last.
// Keys:             "p:<path>" for a panel, "g:<id>" for a group.

export const GROUP_PREFIX = "g:";
export const LAYOUT_VERSION = 1;
export const MAX_NAME = 50;
export const MAX_PINNED = 20;
// Not a valid stored group id (those are [a-z0-9]), so it never collides with a real group.
export const PINS_ID = "_pins";
export const PINS_KEY = `g:${PINS_ID}`;
// Same lists as const.py. Named colours are Home Assistant theme variables (`--<name>-color`).
export const NAMED_COLORS = ["primary", "accent", "red", "pink", "purple", "indigo", "blue", "cyan", "teal", "green", "lime", "amber", "orange", "brown", "grey"];
export const HEADER_STYLES = ["plain", "tinted", "line"];
export const DIVIDER_STYLES = ["line", "none"];
export const DEFAULT_SETTINGS = Object.freeze({ start_collapsed: false, accordion: false, toggle_all: false, header: "plain", divider: "line" });

export const panelKey = (path) => `p:${path}`;
export const groupKey = (id) => `g:${id}`;
export const keyOf = (node) => (node.type === "group" ? groupKey(node.id) : panelKey(node.path));

export const isPins = (node) => node?.type === "group" && node.id === PINS_ID;
export const pinsNode = (children = []) => ({ type: "group", id: PINS_ID, pins: true, name: "", icon: null, color: null, icon_color: null, children });

/**
 * Build the tree from a layout and HA's panel paths (in HA's order). Pinned panels (`grid`) go to
 * the pins node at the end, which exists when something is pinned or `withPins` asks for it (editor).
 */
export function buildTree(layout, paths, withPins = false) {
  const known = new Set(paths);
  const placed = new Set();
  const tree = [];
  const order = layout?.order ?? [];
  const groups = layout?.groups ?? {};
  const panel = (path) => {
    placed.add(path);
    return known.has(path) ? { type: "panel", path } : { type: "panel", path, missing: true };
  };
  for (const entry of order) {
    if (typeof entry !== "string") continue;
    if (entry.startsWith(GROUP_PREFIX)) {
      const id = entry.slice(GROUP_PREFIX.length);
      const g = groups[id];
      if (!g || id === PINS_ID || tree.some((n) => n.type === "group" && n.id === id)) continue;
      const children = [];
      for (const p of g.panels ?? []) if (typeof p === "string" && !placed.has(p)) children.push(panel(p));
      tree.push({ type: "group", id, name: g.name, icon: g.icon ?? null, color: g.color ?? null, icon_color: g.icon_color ?? null, children });
    } else if (!placed.has(entry)) {
      tree.push(panel(entry));
    }
  }
  const pins = [];
  for (const p of Array.isArray(layout?.grid) ? layout.grid : [])
    if (typeof p === "string" && !placed.has(p) && pins.length < MAX_PINNED) pins.push(panel(p));
  for (const p of paths) if (!placed.has(p)) tree.push(panel(p));
  if (pins.length || withPins) tree.push(pinsNode(pins));
  return tree;
}

export function toLayout(tree, settings) {
  const order = [];
  const groups = {};
  let grid = [];
  for (const n of tree) {
    if (isPins(n)) grid = n.children.map((c) => c.path);
    else if (n.type === "group") {
      order.push(groupKey(n.id));
      groups[n.id] = { name: n.name, icon: n.icon ?? null, color: n.color ?? null, icon_color: n.icon_color ?? null, panels: n.children.map((c) => c.path) };
    } else {
      order.push(n.path);
    }
  }
  return { version: LAYOUT_VERSION, order, groups, grid, settings: cleanSettings(settings) };
}

/** Settings with defaults for anything missing or invalid (the server refuses invalid ones). */
export function cleanSettings(value) {
  const out = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== "object") return out;
  for (const key of ["start_collapsed", "accordion", "toggle_all"]) if (typeof value[key] === "boolean") out[key] = value[key];
  if (HEADER_STYLES.includes(value.header)) out.header = value.header;
  if (DIVIDER_STYLES.includes(value.divider)) out.divider = value.divider;
  return out;
}

/** Visible pinned panels, in the grid's order. */
export function pinned(layout, visible) {
  const shown = new Set(visible);
  return (Array.isArray(layout?.grid) ? layout.grid : []).filter((p) => typeof p === "string" && shown.has(p)).slice(0, MAX_PINNED);
}

/** Flat panel order, for HA's native `sidebar.panelOrder`. */
export function flatten(tree) {
  const out = [];
  for (const n of tree) {
    if (n.type === "group") for (const c of n.children) out.push(c.path);
    else out.push(n.path);
  }
  return out;
}

/**
 * Rows to show in the (non-edit) sidebar.
 * visible: panel paths HA shows, in HA's order. Groups without a visible panel are left out;
 * a collapsed group lists no panels and says whether it holds the selected one.
 */
export function arrange(layout, visible, collapsed, selected) {
  const tree = buildTree(layout, visible);
  const shown = new Set(visible);
  const folded = new Set(collapsed ?? []);
  const rows = [];
  for (const n of tree) {
    if (n.type === "panel") {
      if (shown.has(n.path)) rows.push({ type: "panel", path: n.path, group: null });
      continue;
    }
    if (isPins(n)) continue;
    const kids = n.children.filter((c) => shown.has(c.path));
    if (!kids.length) continue;
    const isCollapsed = folded.has(n.id);
    rows.push({
      type: "group",
      id: n.id,
      name: n.name,
      icon: n.icon,
      color: n.color ?? null,
      icon_color: n.icon_color ?? null,
      collapsed: isCollapsed,
      count: kids.length,
      selected: kids.some((c) => c.path === selected),
    });
    if (!isCollapsed) kids.forEach((c, i) => rows.push({ type: "panel", path: c.path, group: n.id, last: i === kids.length - 1 }));
  }
  return rows;
}

const clone = (tree) => tree.map((n) => (n.type === "group" ? { ...n, children: [...n.children] } : n));

export function locate(tree, key) {
  for (let i = 0; i < tree.length; i++) {
    const n = tree[i];
    if (keyOf(n) === key) return { group: null, index: i, node: n };
    if (n.type === "group") {
      const j = n.children.findIndex((c) => keyOf(c) === key);
      if (j >= 0) return { group: n.id, index: j, node: n.children[j] };
    }
  }
  return null;
}

const groupIndex = (tree, id) => tree.findIndex((n) => n.type === "group" && n.id === id);

function take(tree, key) {
  const at = locate(tree, key);
  if (!at) return null;
  if (at.group === null) tree.splice(at.index, 1);
  else tree[groupIndex(tree, at.group)].children.splice(at.index, 1);
  return at.node;
}

function put(tree, node, group, index) {
  if (group === null) tree.splice(index, 0, node);
  else tree[groupIndex(tree, group)].children.splice(index, 0, node);
}

/**
 * Move `key` relative to `target` ("before" | "after" | "into").
 * "into" a group appends; "into" a panel is not a move (use merge). Groups never nest:
 * a group dropped on a grouped panel lands next to that panel's group.
 */
export function move(tree, key, targetKey, zone) {
  if (key === targetKey || key === PINS_KEY) return tree;
  const next = clone(tree);
  const from = locate(next, key);
  const node = from?.node;
  const to = locate(next, targetKey);
  if (!node || !to) return tree;
  if (node.type === "group" && zone === "into") return tree;
  // A group never enters the pinned area: dropped on it, it lands right above it.
  if (node.type === "group" && (targetKey === PINS_KEY || to.group === PINS_ID)) {
    targetKey = PINS_KEY;
    zone = "before";
  }
  const intoPins = (zone === "into" && targetKey === PINS_KEY) || (zone !== "into" && to.group === PINS_ID);
  if (intoPins && from.group !== PINS_ID && pinsFull(next)) return tree;
  take(next, key);
  let target = locate(next, targetKey);
  if (zone === "into") {
    if (target.node.type !== "group") return tree;
    target.node.children.push(node);
    return pinsLast(next);
  }
  if (node.type === "group" && target.group !== null) {
    target = { group: null, index: groupIndex(next, target.group), node: null };
  }
  put(next, node, target.group, target.index + (zone === "after" ? 1 : 0));
  return pinsLast(next);
}

export const pinsFull = (tree) => (tree.find(isPins)?.children.length ?? 0) >= MAX_PINNED;

/** The pinned area stays the last top-level entry (a drop after its header lands above it). */
function pinsLast(tree) {
  const i = tree.findIndex(isPins);
  if (i < 0 || i === tree.length - 1) return tree;
  const [pins] = tree.splice(i, 1);
  tree.push(pins);
  return tree;
}

/** Drop panel `key` onto panel `targetKey`: a new group holding [target, dropped] where the target was. */
export function merge(tree, key, targetKey, id, name) {
  const next = clone(tree);
  const node = locate(next, key)?.node;
  const target = locate(next, targetKey);
  if (!node || !target || key === targetKey || node.type !== "panel" || target.node.type !== "panel") return tree;
  if (target.group !== null) return move(tree, key, targetKey, "after");
  take(next, key);
  const at = locate(next, targetKey);
  next.splice(at.index, 1, { type: "group", id, name, icon: null, color: null, icon_color: null, children: [at.node, node] });
  return next;
}

export function addGroup(tree, id, name) {
  return [{ type: "group", id, name, icon: null, color: null, icon_color: null, children: [] }, ...clone(tree)];
}

/** Dissolve a group; its panels take its place. */
export function ungroup(tree, id) {
  const i = groupIndex(tree, id);
  if (i < 0 || id === PINS_ID) return tree;
  const next = clone(tree);
  next.splice(i, 1, ...next[i].children);
  return next;
}

export function updateGroup(tree, id, changes) {
  return tree.map((n) => (n.type === "group" && n.id === id ? { ...n, ...changes, children: [...n.children] } : n));
}

/** Keyboard move by one visible row (editor shows every group expanded; missing panels are skipped). */
export function moveBy(tree, key, delta) {
  const at = locate(tree, key);
  if (!at) return tree;
  const rows = [];
  for (const n of tree) {
    if (n.type === "group") {
      rows.push({ key: groupKey(n.id), group: null, isGroup: true });
      for (const c of n.children) if (!c.missing) rows.push({ key: panelKey(c.path), group: n.id });
    } else if (!n.missing) {
      rows.push({ key: panelKey(n.path), group: null });
    }
  }
  if (at.node.type === "group") {
    const tops = rows.filter((r) => r.group === null);
    const i = tops.findIndex((r) => r.key === key);
    const other = tops[i + delta];
    return other && other.key !== PINS_KEY ? move(tree, key, other.key, delta > 0 ? "after" : "before") : tree;
  }
  const i = rows.findIndex((r) => r.key === key);
  if (delta > 0) {
    const nxt = rows[i + 1];
    // The pinned area is the end of the sidebar: nothing below it.
    if (at.group === PINS_ID && (!nxt || nxt.group !== PINS_ID)) return tree;
    if (at.group !== null && (!nxt || nxt.group !== at.group)) return move(tree, key, groupKey(at.group), "after");
    if (!nxt) return tree;
    if (nxt.isGroup) {
      const g = tree[groupIndex(tree, nxt.key.slice(2))];
      const first = g.children.find((c) => !c.missing);
      return first ? move(tree, key, panelKey(first.path), "before") : move(tree, key, nxt.key, "into");
    }
    return move(tree, key, nxt.key, "after");
  }
  const prev = rows[i - 1];
  if (at.group !== null && prev?.isGroup && prev.key === groupKey(at.group)) return move(tree, key, prev.key, "before");
  if (!prev) return tree;
  // A header right above a top-level panel belongs to an empty group: enter it.
  if (prev.isGroup) return move(tree, key, prev.key, "into");
  if (prev.group !== null && prev.group !== at.group) return move(tree, key, prev.key, "after");
  return move(tree, key, prev.key, "before");
}

export function newGroupId(tree) {
  const used = new Set(tree.filter((n) => n.type === "group").map((n) => n.id));
  for (;;) {
    const id = Math.random().toString(36).slice(2, 10);
    if (/^[a-z0-9]{1,16}$/.test(id) && !used.has(id)) return id;
  }
}

// Same rules as layout.py: control (Cc) and format (Cf) characters are not allowed, except the
// joiners real text needs (ZWNJ, ZWJ); a name needs at least one visible character.
const ALLOWED_FORMAT = new Set([String.fromCharCode(0x200c), String.fromCharCode(0x200d)]);

/** A clean group name, or "" when nothing visible is left. */
export function cleanName(value) {
  const name = String(value ?? "")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (ALLOWED_FORMAT.has(c) ? c : ""))
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  return /[^\p{C}\p{Z}]/u.test(name) ? name : "";
}

const ICON_RE = /^[a-z0-9_-]{1,20}:[a-z0-9_-]{1,64}$/;
// Same list as layout.py: icon sets stay open (mdi, hass, custom), URI schemes never are icon sets.
const ICON_BLOCKED_PREFIXES = new Set(["javascript", "data", "vbscript", "http", "https", "file", "blob", "about", "ftp", "ws", "wss", "mailto", "tel"]);

/** `prefix:name` icon, whole-string match (no trailing newline), never a URI scheme. */
export function validIcon(value) {
  return typeof value === "string" && ICON_RE.test(value) && !ICON_BLOCKED_PREFIXES.has(value.slice(0, value.indexOf(":")));
}

/**
 * HA's native `sidebar` user data after an editor save. `known`: panels the editor showed;
 * `invisible`: panels hidden only because HA hides them by default. Entries for panels HA does not
 * list right now (a stopped add-on) are kept: hidden stays hidden, order entries go to the end.
 */
export function nativeSidebar(current, tree, known, hidden, invisible) {
  const panelOrder = flatten(tree).filter((p) => known.has(p) && !(invisible.has(p) && hidden.has(p)));
  const hiddenPanels = [...hidden].filter((p) => known.has(p) && !invisible.has(p));
  const keep = (list, out) => (Array.isArray(list) ? list : []).filter((p) => typeof p === "string" && !known.has(p) && !out.includes(p));
  return {
    ...current,
    panelOrder: [...panelOrder, ...keep(current?.panelOrder, panelOrder)],
    hiddenPanels: [...hiddenPanels, ...keep(current?.hiddenPanels, hiddenPanels)],
  };
}

/**
 * HA's native `panelOrder` changed outside the editor (HA's own Edit sidebar dialog): the layout
 * re-sorted to follow it, groups kept. Top-level entries follow HA's relative order (a group ranks
 * by its first member in HA's order); members inside each group follow it too. Entries HA does not
 * list (a stopped add-on, a group with no listed member) keep their slots. Returns null when the
 * layout already agrees with `order`, so applying our own write back is a no-op.
 */
export function adoptOrder(layout, order) {
  if (!layout || !Array.isArray(order)) return null;
  const rank = new Map();
  order.forEach((p, i) => {
    if (typeof p === "string" && !rank.has(p)) rank.set(p, i);
  });
  const resort = (items, rankOf) => {
    const slots = [];
    const ranked = [];
    items.forEach((item, i) => {
      const r = rankOf(item);
      if (r === undefined) return;
      slots.push(i);
      ranked.push([r, item]);
    });
    ranked.sort((a, b) => a[0] - b[0]);
    const out = [...items];
    slots.forEach((slot, k) => (out[slot] = ranked[k][1]));
    return out;
  };
  const groups = {};
  for (const [id, g] of Object.entries(layout.groups ?? {}))
    groups[id] = { ...g, panels: resort(Array.isArray(g?.panels) ? g.panels : [], (p) => rank.get(p)) };
  const groupRank = (id) => {
    const ranks = (groups[id]?.panels ?? []).map((p) => rank.get(p)).filter((r) => r !== undefined);
    return ranks.length ? Math.min(...ranks) : undefined;
  };
  const order2 = resort(Array.isArray(layout.order) ? layout.order : [], (e) =>
    typeof e !== "string" ? undefined : e.startsWith(GROUP_PREFIX) ? groupRank(e.slice(GROUP_PREFIX.length)) : rank.get(e),
  );
  const next = { ...layout, order: order2, groups };
  return JSON.stringify(next) === JSON.stringify(layout) ? null : next;
}

/** Whether the editor holds anything to save: the layout (with settings) or the hidden set differ from when it opened. */
export function editChanged(baseTree, tree, baseHidden, hidden, baseSettings, settings) {
  if (JSON.stringify(toLayout(baseTree, baseSettings)) !== JSON.stringify(toLayout(tree, settings))) return true;
  if (baseHidden.size !== hidden.size) return true;
  for (const p of hidden) if (!baseHidden.has(p)) return true;
  return false;
}

/** What Done would save: "none", "hidden-only" (only the hide/show set differs) or "structure" (order, groups, names, icons, colours, pins, settings). */
export function editKind(baseTree, tree, baseHidden, hidden, baseSettings, settings) {
  if (JSON.stringify(toLayout(baseTree, baseSettings)) !== JSON.stringify(toLayout(tree, settings))) return "structure";
  return editChanged(baseTree, tree, baseHidden, hidden) ? "hidden-only" : "none";
}

/** HA's `sidebar` user data with only the hidden list replaced (panelOrder and other keys kept). */
export function nativeHidden(current, known, hidden, invisible) {
  const hiddenPanels = [...hidden].filter((p) => known.has(p) && !invisible.has(p));
  const keep = (Array.isArray(current?.hiddenPanels) ? current.hiddenPanels : []).filter(
    (p) => typeof p === "string" && !known.has(p) && !hiddenPanels.includes(p),
  );
  return { ...current, hiddenPanels: [...hiddenPanels, ...keep] };
}

/* ------------------------------------------------------------------ collapse */

/** Collapsed ids after clicking group `id`. Accordion: opening one folds every other group in `ids`. */
export function toggleCollapsed(collapsed, id, accordion, ids) {
  const set = new Set(collapsed ?? []);
  if (!set.has(id)) {
    set.add(id);
    return [...set];
  }
  if (accordion) return [...new Set([...set, ...ids])].filter((g) => g !== id);
  set.delete(id);
  return [...set];
}

/** Whether any of `ids` is open (then "collapse all" applies; otherwise "expand all"). */
export function anyOpen(collapsed, ids) {
  const set = new Set(collapsed ?? []);
  return ids.some((id) => !set.has(id));
}

/** Collapse all when any group is open, otherwise expand all. Ids not in `ids` keep their state. */
export function toggleAll(collapsed, ids) {
  const set = new Set(collapsed ?? []);
  if (anyOpen(collapsed, ids)) for (const id of ids) set.add(id);
  else for (const id of ids) set.delete(id);
  return [...set];
}

/* ------------------------------------------------------------------ colours */

const HEX6 = /^#[0-9a-f]{6}$/;
const HEX_IN = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

/** Same rule as layout.py: null, a named theme colour or `#rrggbb` (lowercase). */
export const validColor = (value) => value === null || NAMED_COLORS.includes(value) || (typeof value === "string" && HEX6.test(value));

/**
 * What a user typed as a colour, normalised: "" -> null, `#ABC` / `abc` -> `#aabbcc`, a named colour
 * stays. Returns undefined when it is not a colour.
 */
export function normalizeColor(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (NAMED_COLORS.includes(text.toLowerCase())) return text.toLowerCase();
  const m = HEX_IN.exec(text);
  if (!m) return undefined;
  const hex = m[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex}`;
}

/** CSS for a stored colour: a theme variable for a named one, the hex value otherwise; null for none. */
export function colorCss(value) {
  if (value === null || !validColor(value)) return null;
  return value.startsWith("#") ? value : `var(--${value}-color)`;
}

/** [r, g, b, a] from a computed `rgb()` / `rgba()` / `color(srgb ...)` string, or null. */
export function parseRgb(text) {
  const s = String(text ?? "").trim();
  const alpha = (v) => (v === undefined ? 1 : v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v));
  let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3], alpha(m[4])];
  m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, alpha(m[4])];
  return null;
}

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio of two opaque colours. */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** `a` mixed toward `b` by `t` (0..1); alpha is dropped. */
export const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);

/** A colour with alpha drawn over an opaque background. */
export const over = (fg, bg) => (fg[3] === undefined || fg[3] >= 1 ? fg.slice(0, 3) : mix(bg, fg, fg[3]));

/**
 * `fg` itself when it reaches `min` contrast on `bg`; otherwise `fg` mixed toward `toward` (the
 * theme's text colour: darker on light themes, lighter on dark ones) just far enough.
 */
export function readable(fg, bg, toward, min) {
  const base = over(fg, bg);
  for (let i = 0; i <= 20; i++) {
    const c = mix(base, toward, i / 20).map((v) => Math.round(v));
    if (contrast(c, bg) >= min) return c;
  }
  return toward.slice(0, 3).map((v) => Math.round(v));
}

export const rgbCss = (c) => `rgb(${c.map((v) => Math.round(v)).join(", ")})`;

/** `base`, or `base 2`, `base 3`... when a group already has that name. */
export function uniqueName(tree, base) {
  const used = new Set(tree.filter((n) => n.type === "group").map((n) => n.name));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
}

// home-assistant-js-websocket rejects with a bare number when the socket fails
// (1 cannot connect, 2 invalid auth, 3 connection lost, 4 host required, ...).
/** Which localized message a failed write shows: "connection", "invalid" (server validation) or "other". */
export function saveErrorKind(err) {
  if (typeof err === "number") return "connection";
  if (err?.code === "invalid_format") return "invalid";
  if (typeof err?.code === "number" || err instanceof TypeError) return "connection";
  return "other";
}
