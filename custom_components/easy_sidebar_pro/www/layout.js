// Pure layout model for Easy Sidebar Pro. No DOM, no Home Assistant.
//
// Layout (stored):  { version: 1, order: ["path" | "g:<id>"], groups: { id: { name, icon, panels: [path] } } }
// Tree (editing):   [ { type: "panel", path } | { type: "group", id, name, icon, children: [panel nodes] } ]
// Keys:             "p:<path>" for a panel, "g:<id>" for a group.

export const GROUP_PREFIX = "g:";
export const LAYOUT_VERSION = 1;
export const MAX_NAME = 50;

export const panelKey = (path) => `p:${path}`;
export const groupKey = (id) => `g:${id}`;
export const keyOf = (node) => (node.type === "group" ? groupKey(node.id) : panelKey(node.path));

/** Build the tree from a layout and HA's panel paths (in HA's order). */
export function buildTree(layout, paths) {
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
      if (!g || tree.some((n) => n.type === "group" && n.id === id)) continue;
      const children = [];
      for (const p of g.panels ?? []) if (typeof p === "string" && !placed.has(p)) children.push(panel(p));
      tree.push({ type: "group", id, name: g.name, icon: g.icon ?? null, children });
    } else if (!placed.has(entry)) {
      tree.push(panel(entry));
    }
  }
  for (const p of paths) if (!placed.has(p)) tree.push(panel(p));
  return tree;
}

export function toLayout(tree) {
  const order = [];
  const groups = {};
  for (const n of tree) {
    if (n.type === "group") {
      order.push(groupKey(n.id));
      groups[n.id] = { name: n.name, icon: n.icon ?? null, panels: n.children.map((c) => c.path) };
    } else {
      order.push(n.path);
    }
  }
  return { version: LAYOUT_VERSION, order, groups };
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
    const kids = n.children.filter((c) => shown.has(c.path));
    if (!kids.length) continue;
    const isCollapsed = folded.has(n.id);
    rows.push({
      type: "group",
      id: n.id,
      name: n.name,
      icon: n.icon,
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
  if (key === targetKey) return tree;
  const next = clone(tree);
  const node = locate(next, key)?.node;
  if (!node || !locate(next, targetKey)) return tree;
  if (node.type === "group" && zone === "into") return tree;
  take(next, key);
  let target = locate(next, targetKey);
  if (zone === "into") {
    if (target.node.type !== "group") return tree;
    target.node.children.push(node);
    return next;
  }
  if (node.type === "group" && target.group !== null) {
    target = { group: null, index: groupIndex(next, target.group), node: null };
  }
  put(next, node, target.group, target.index + (zone === "after" ? 1 : 0));
  return next;
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
  next.splice(at.index, 1, { type: "group", id, name, icon: null, children: [at.node, node] });
  return next;
}

export function addGroup(tree, id, name) {
  return [{ type: "group", id, name, icon: null, children: [] }, ...clone(tree)];
}

/** Dissolve a group; its panels take its place. */
export function ungroup(tree, id) {
  const i = groupIndex(tree, id);
  if (i < 0) return tree;
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
    return other ? move(tree, key, other.key, delta > 0 ? "after" : "before") : tree;
  }
  const i = rows.findIndex((r) => r.key === key);
  if (delta > 0) {
    const nxt = rows[i + 1];
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
