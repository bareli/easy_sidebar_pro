// Pure layout model for Easy Sidebar Pro. No DOM, no Home Assistant.
//
// Layout (stored):  { version: 1, order: ["path" | "g:<id>"], groups: { id: { name, icon, color, icon_color, start_open, tabbed, panels: [path] } },
//                     grid: [path], settings: { start_collapsed, accordion, toggle_all, hide_count, search, header, divider } }
// Tree (editing):   [ { type: "panel", path } | { type: "group", id, name, icon, color, icon_color, start_open, tabbed, children: [panel nodes] } ]
//                   The bottom grid is a group-like node with `pins: true` (id PINS_ID), always last.
//                   A `tabbed` group is one sidebar row; its panels open as tabs of one page.
// Keys:             "p:<path>" for a panel, "g:<id>" for a group.
// Links (v0.5):     `links: { id: { name, icon, url, new_tab } }`; a link is placed like a panel whose path is
//                   "l:<id>" (in order, a group or the grid), so moving, grouping, pinning and tabs treat it as one.
// Extras (v0.5):    `items: { "<path>" | "l:<id>" | "g:<id>": { badge, show_when, aliases } }` (entity ids, search words).

export const GROUP_PREFIX = "g:";
export const LINK_PREFIX = "l:";
export const MAX_LINKS = 50;
export const MAX_URL = 2000;
export const MAX_ALIASES = 100;
// Same lists as const.py LINK_KEYS / ITEM_KEYS.
export const LINK_KEYS = ["name", "icon", "url", "new_tab"];
export const ITEM_KEYS = ["badge", "show_when", "aliases"];
export const LAYOUT_VERSION = 1;
export const MAX_NAME = 50;
export const MAX_PINNED = 20;
// Not a valid stored group id (those are [a-z0-9]), so it never collides with a real group.
export const PINS_ID = "_pins";
export const PINS_KEY = `g:${PINS_ID}`;
// Same lists as const.py. Named colours are Home Assistant theme variables (`--<name>-color`).
export const NAMED_COLORS = ["primary", "accent", "red", "pink", "purple", "indigo", "blue", "cyan", "teal", "green", "lime", "amber", "orange", "brown", "grey"];
export const HEADER_STYLES = ["plain", "tinted", "line", "pill"];
export const DIVIDER_STYLES = ["line", "none"];
// Keys of a stored group, in the server's output order (const.py GROUP_KEYS).
export const GROUP_KEYS = ["name", "icon", "color", "icon_color", "start_open", "tabbed", "panels"];
export const DEFAULT_SETTINGS = Object.freeze({ start_collapsed: false, accordion: false, toggle_all: false, hide_count: false, search: false, header: "plain", divider: "line" });

export const panelKey = (path) => `p:${path}`;
export const groupKey = (id) => `g:${id}`;
export const keyOf = (node) => (node.type === "group" ? groupKey(node.id) : panelKey(node.path));

export const isPins = (node) => node?.type === "group" && node.id === PINS_ID;
export const pinsNode = (children = []) => ({ type: "group", id: PINS_ID, pins: true, name: "", icon: null, color: null, icon_color: null, start_open: false, tabbed: false, children });
const newGroup = (id, name, children) => ({ type: "group", id, name, icon: null, color: null, icon_color: null, start_open: false, tabbed: false, children });

/**
 * Build the tree from a layout and HA's panel paths (in HA's order). Pinned panels (`grid`) go to
 * the pins node at the end, which exists when something is pinned or `withPins` asks for it (editor).
 */
export function buildTree(layout, paths, withPins = false) {
  // Links exist wherever the layout defines them; one not placed yet goes to the end like a new panel.
  paths = [...paths, ...linkPaths(layout).filter((p) => !paths.includes(p))];
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
      tree.push({ type: "group", id, name: g.name, icon: g.icon ?? null, color: g.color ?? null, icon_color: g.icon_color ?? null, start_open: g.start_open === true, tabbed: g.tabbed === true, children });
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

// Same rule as layout.py PANEL. Any other path is left out of a saved layout (it keeps HA's own
// place) rather than making the server refuse the whole save.
const PANEL_RE = /^[A-Za-z0-9_-]{1,100}$/;
export const validPanel = (path) => typeof path === "string" && PANEL_RE.test(path);

/* ------------------------------------------------------------------ text length */

// Lengths are counted in code points, like Python's len() on the server: an emoji is one character, and a
// cut never falls inside a surrogate pair. A lone surrogate cannot be sent (HA's JSON parser refuses it).
export const cpLength = (text) => [...text].length;
export const cpSlice = (text, max) => (text.length <= max ? text : [...text].slice(0, max).join(""));
export const stripSurrogates = (text) => text.replace(/\p{Cs}/gu, "");

/**
 * A text field limited to `max` code points (what `maxlength` does in UTF-16 units): what was just typed or
 * pasted before the caret is cut to fit, the rest is kept, and the caret stays after the kept text.
 * Returns { value, caret }; unchanged when the value fits.
 */
export function limitText(value, caret, max) {
  if (cpLength(value) <= max) return { value, caret };
  const at = Math.max(0, Math.min(caret ?? value.length, value.length));
  const after = cpSlice(value.slice(at), max);
  const before = cpSlice(value.slice(0, at), Math.max(0, max - cpLength(after)));
  return { value: before + after, caret: before.length };
}

/* ------------------------------------------------------------------ links and extras */

const ID_RE = /^[a-z0-9]{1,16}$/;
export const isLink = (path) => typeof path === "string" && path.startsWith(LINK_PREFIX);
export const linkPath = (id) => `${LINK_PREFIX}${id}`;
export const linkId = (path) => (isLink(path) ? path.slice(LINK_PREFIX.length) : null);
/** "l:<id>" of every link a layout defines. */
export const linkPaths = (layout) => Object.keys(layout?.links ?? {}).filter((id) => ID_RE.test(id)).map(linkPath);

// Same rules as layout.py URL_INTERNAL / URL_EXTERNAL: a page of this Home Assistant or an http(s) address.
const URL_INTERNAL = /^\/(?![/\\])\S*$/;
// The scheme in ASCII only, written out as layout.py does (no case folding of "ſ" or "K").
const URL_EXTERNAL = /^[hH][tT][tT][pP][sS]?:\/\/[^\s/\\?#]+\S*$/;
export function validUrl(value) {
  if (typeof value !== "string" || !value.length || cpLength(value) > MAX_URL || value.includes("\\") || /[\p{C}\p{Z}]/u.test(value)) return false;
  return URL_INTERNAL.test(value) || URL_EXTERNAL.test(value);
}
export const isExternal = (url) => /^https?:\/\//i.test(url ?? "");

// A host name at the start of typed text, with an optional port ("nas.local:5000", "example.com/x").
const HOST_START = /^([a-z0-9-]+(?:\.[a-z0-9-]+)*)(:\d{1,5})?(?=[/?#]|$)/i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
// Home network names: plain http (a NAS or a router on the LAN has no certificate for https).
const LOCAL_SUFFIX = /\.(?:local|lan|home|internal|home\.arpa)$/i;
// "tel:12345" looks like a one-word host with a port; these are schemes, never hosts.
const NOT_HOSTS = new Set(["tel", "sms", "mailto", "fax", "callto", "sip", "sips", "geo", "urn", "news", "javascript", "vbscript", "data", "file", "blob", "about", "ftp", "ws", "wss", "http", "https"]);

/** Whether a host typed without a scheme is on the home network (UX-013): IPv4, localhost, a one-word name, a LAN suffix, or any host with a port. */
export const localHost = (host, port = false) =>
  !!port || IPV4.test(host) || !host.includes(".") || host.toLowerCase() === "localhost" || LOCAL_SUFFIX.test(host);

/**
 * What a user typed as an address, normalised: trimmed; "config/automation" -> "/config/automation";
 * a home network host ("192.168.1.251:5000", "nas.local", "localhost:8123") -> "http://..."; another host name
 * ("example.com") -> "https://..."; a bare word without a dot or a port ("nas") stays a page of this Home Assistant
 * ("/nas"); a full address of this Home Assistant -> its path. Returns null when it is not a usable address.
 */
export function normalizeUrl(value, origin = null) {
  let text = stripSurrogates(String(value ?? "")).trim();
  if (!text) return null;
  if (origin && text.toLowerCase().startsWith(origin.toLowerCase())) text = text.slice(origin.length) || "/";
  const host = text.startsWith("/") ? null : HOST_START.exec(text);
  if (host && !(host[2] && NOT_HOSTS.has(host[1].toLowerCase()))) {
    const [, name, port] = host;
    const isHost = !!port || name.toLowerCase() === "localhost" || IPV4.test(name) || /\.[a-z]{2,}$/i.test(name);
    if (isHost) text = `${localHost(name, port) ? "http" : "https"}://${text}`;
    else text = `/${text}`;
  } else if (!text.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `/${text}`;
  return validUrl(text) ? text : null;
}

/**
 * The link whose page is open: an internal link matches its own path and the pages under it (query and
 * hash ignored); the longest match wins, so "/lovelace/cameras" beats "/lovelace". Returns "l:<id>" or null.
 */
export function linkAt(links, pathname) {
  let best = null;
  let len = -1;
  for (const [id, link] of Object.entries(links ?? {})) {
    const url = link?.url;
    if (typeof url !== "string" || isExternal(url)) continue;
    const base = url.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    const hit = pathname === base || (base !== "/" && pathname.startsWith(`${base}/`));
    if (hit && base.length > len) {
      best = linkPath(id);
      len = base.length;
    }
  }
  return best;
}

const ENTITY_RE = /^[a-z0-9_]{1,64}\.[a-z0-9_]{1,255}$/;
export const validEntity = (value) => typeof value === "string" && ENTITY_RE.test(value);

/** A typed entity id that is well formed but not one of Home Assistant's states (a warning, not an error: UX-010). */
export function unknownEntity(value, states) {
  const id = String(value ?? "").trim().toLowerCase();
  return validEntity(id) && !Object.prototype.hasOwnProperty.call(states ?? {}, id);
}

/** Search words as stored: control characters dropped, spaces collapsed, at most MAX_ALIASES characters (code points). */
export function cleanAliases(value) {
  const text = String(value ?? "")
    .replace(SPACE_CONTROLS, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, (c) => (ALLOWED_FORMAT.has(c) ? c : ""))
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  return cpSlice(text, MAX_ALIASES).trim();
}

/** An entry's extras with defaults, or null when it has none. */
export function cleanItem(item) {
  const out = {
    badge: validEntity(item?.badge) ? item.badge : null,
    show_when: validEntity(item?.show_when) ? item.show_when : null,
    aliases: cleanAliases(item?.aliases),
  };
  return out.badge || out.show_when || out.aliases ? out : null;
}

/** A link as stored, or null when it cannot be saved (no name or no valid address). */
export function cleanLink(link) {
  const name = cleanName(link?.name);
  if (!name || !validUrl(link?.url)) return null;
  return { name, icon: validIcon(link?.icon) ? link.icon : null, url: link.url, new_tab: link?.new_tab === true };
}

// Entity states that count as "nothing to show" for a badge or a show-only-when condition.
const INACTIVE = new Set(["off", "closed", "locked", "unavailable", "unknown", "idle", "standby", "not_home", "disarmed", "docked", "paused", "none", "false", ""]);

/**
 * What a badge entity shows: a positive number -> { count }; another active state -> { dot: true };
 * zero, a negative number, an inactive state (off, closed, unavailable, ...) or no entity -> null.
 */
export function badgeOf(stateObj) {
  if (!stateObj || typeof stateObj.state !== "string") return null;
  const s = stateObj.state.trim();
  const n = s === "" ? NaN : Number(s);
  if (Number.isFinite(n)) return n > 0 ? { count: n } : null;
  return INACTIVE.has(s.toLowerCase()) ? null : { dot: true };
}

export const entityActive = (stateObj) => badgeOf(stateObj) !== null;

/** Badges of a folded group's members combined: their counts summed; a dot when only dots are active. */
export function rollup(badges) {
  let sum = 0;
  let dot = false;
  for (const b of badges) {
    if (b?.count) sum += b.count;
    else if (b?.dot) dot = true;
  }
  return sum > 0 ? { count: sum } : dot ? { dot: true } : null;
}

/** Badge text: whole numbers, at most "99+". */
export const badgeText = (badge) => (badge?.count ? (badge.count > 99 ? "99+" : String(Math.max(1, Math.round(badge.count)))) : "");

/**
 * Panel and link paths a "show only when" condition hides now. `active(entityId)` says whether an
 * entity is on. A hidden group hides every member.
 */
export function hiddenByCondition(layout, active) {
  const out = new Set();
  for (const [key, item] of Object.entries(layout?.items ?? {})) {
    if (!validEntity(item?.show_when) || active(item.show_when)) continue;
    if (key.startsWith(GROUP_PREFIX)) for (const p of layout.groups?.[key.slice(GROUP_PREFIX.length)]?.panels ?? []) out.add(p);
    else out.add(key);
  }
  return out;
}

/**
 * The rules on one entry, for the editor's marker (UX-011): its badge and show-only-when entities, and whether
 * the condition hides the entry right now (`active(entityId)`). null when the entry has neither.
 */
export function ruleOf(item, active) {
  const badge = validEntity(item?.badge) ? item.badge : null;
  const showWhen = validEntity(item?.show_when) ? item.show_when : null;
  if (!badge && !showWhen) return null;
  return { badge, showWhen, hiddenNow: !!showWhen && !active(showWhen) };
}

/** Entity ids a layout's badges and conditions read (the sidebar re-renders when one of them changes). */
export function watchedEntities(layout) {
  const out = new Set();
  for (const item of Object.values(layout?.items ?? {})) for (const k of ["badge", "show_when"]) if (validEntity(item?.[k])) out.add(item[k]);
  return [...out];
}

/** The layout key of an extras entry for a tree key ("p:<path>" -> path, "g:<id>" stays). */
export const itemKey = (key) => (key.startsWith("p:") ? key.slice(2) : key);

export function toLayout(tree, settings, meta = {}) {
  const order = [];
  const groups = {};
  let grid = [];
  const links = {};
  const defined = meta.links ?? {};
  // A link is saved when it is placed and complete; anything else is left out rather than refused.
  const valid = (path) => {
    if (!isLink(path)) return validPanel(path);
    const id = linkId(path);
    if (!ID_RE.test(id) || !defined[id] || links[id]) return false;
    const link = cleanLink(defined[id]);
    if (link) links[id] = link;
    return !!link;
  };
  const paths = (children) => children.map((c) => c.path).filter(valid);
  for (const n of tree) {
    if (isPins(n)) grid = paths(n.children);
    else if (n.type === "group") {
      order.push(groupKey(n.id));
      groups[n.id] = {
        name: n.name,
        icon: n.icon ?? null,
        color: n.color ?? null,
        icon_color: n.icon_color ?? null,
        start_open: n.start_open === true,
        tabbed: n.tabbed === true,
        panels: paths(n.children),
      };
    } else if (valid(n.path)) {
      order.push(n.path);
    }
  }
  // Extras of panels not shown right now (a stopped add-on) are kept, like their places.
  const items = {};
  for (const [key, item] of Object.entries(meta.items ?? {})) {
    const ok = key.startsWith(GROUP_PREFIX) ? !!groups[key.slice(GROUP_PREFIX.length)] : isLink(key) ? !!links[linkId(key)] : validPanel(key);
    const clean = ok ? cleanItem(item) : null;
    if (clean) items[key] = clean;
  }
  return { version: LAYOUT_VERSION, order, groups, grid, settings: cleanSettings(settings), links, items };
}

/** The editor's links and extras from a stored layout: a deep copy (the editor changes them in place). */
export const metaOf = (layout) => JSON.parse(JSON.stringify({ links: layout?.links ?? {}, items: layout?.items ?? {} }));

/** Settings with defaults for anything missing or invalid (the server refuses invalid ones). */
export function cleanSettings(value) {
  const out = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== "object") return out;
  for (const key of ["start_collapsed", "accordion", "toggle_all", "hide_count", "search"]) if (typeof value[key] === "boolean") out[key] = value[key];
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
 * a collapsed group lists no panels and says whether it holds the selected one. A tabbed group is one
 * row (`tabbed: true`, never collapsed) with its visible panels in `paths`.
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
    const tabbed = n.tabbed === true;
    const isCollapsed = !tabbed && folded.has(n.id);
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
      tabbed,
      paths: kids.map((c) => c.path),
    });
    if (!isCollapsed && !tabbed) kids.forEach((c, i) => rows.push({ type: "panel", path: c.path, group: n.id, last: i === kids.length - 1 }));
  }
  return rows;
}

/**
 * The tabbed group whose visible panels include `selected` (the tab strip above the page), or null:
 * { id, name, icon, paths } with `paths` in the group's order.
 */
export function tabsFor(layout, visible, selected) {
  if (!selected) return null;
  for (const r of arrange(layout, visible, [], selected))
    if (r.type === "group" && r.tabbed && r.selected) return { id: r.id, name: r.name, icon: r.icon ?? null, paths: r.paths };
  return null;
}

/** Where a click on a tabbed row goes: the tab last open in this page when still shown, else the first. */
export const tabTarget = (paths, last) => (last && paths.includes(last) ? last : paths[0] ?? null);

/** Text as the search compares it: case and accents (Latin diacritics, Hebrew points) ignored. */
export const searchText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase();

export const MAX_VIEW_RESULTS = 8;
export const MAX_ENTITY_SUGGESTIONS = 8;

/**
 * Home Assistant's entities for the editor's suggestions (UX-012): id and friendly name, each also in the form the
 * search compares (case and accents ignored), sorted by what is shown.
 */
export function entityList(states) {
  return Object.entries(states ?? {})
    .map(([id, s]) => {
      const name = typeof s?.attributes?.friendly_name === "string" ? s.attributes.friendly_name.trim() : "";
      return { id, name, key: searchText(name), idKey: searchText(id) };
    })
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id) || a.id.localeCompare(b.id));
}

/**
 * Suggestions for what was typed: entities whose friendly name (any language) or id contains it; those whose name,
 * a word of the name, the id or the id's object part starts with it come first. At most `max`.
 */
export function matchEntities(list, query, max = MAX_ENTITY_SUGGESTIONS) {
  const q = searchText(query).trim();
  if (!q) return [];
  const first = [];
  const rest = [];
  for (const e of list) {
    if (e.key.startsWith(q) || ` ${e.key}`.includes(` ${q}`) || e.idKey.startsWith(q) || e.idKey.includes(`.${q}`)) first.push(e);
    else if (rest.length < max && (e.key.includes(q) || e.idKey.includes(q))) rest.push(e);
    if (first.length >= max) break;
  }
  return [...first, ...rest].slice(0, max);
}

/**
 * Rows for the sidebar search: entries whose words contain `query`. `titles`: path -> the shown name or a
 * list of words (shown name, HA's own untranslated title, the path); each entry's search words (`items`)
 * count too. A panel shows when it matches; a group shows, unfolded, with its matching panels (all of
 * them when the group itself matches); a tabbed group shows as its one row when it or any of its panels
 * match (`match`: the first matching panel, the tab it opens; null when the group matched). Folding is
 * ignored. `views` ({ path: "dash/view", dash, title }) of shown dashboards follow as `view` rows (at most
 * MAX_VIEW_RESULTS). An empty query gives `arrange`'s rows.
 */
export function searchRows(layout, visible, titles, query, selected, collapsed = [], views = []) {
  const q = searchText(query).trim();
  if (!q) return arrange(layout, visible, collapsed, selected);
  const hit = (text) => searchText(text).includes(q);
  const aliases = (key) => layout?.items?.[key]?.aliases ?? "";
  const words = (path) => [titles.get(path) ?? path, aliases(path)].flat();
  const matches = (path) => words(path).some(hit);
  const shown = new Set(visible);
  const rows = [];
  for (const n of buildTree(layout, visible)) {
    if (n.type === "panel") {
      if (shown.has(n.path) && matches(n.path)) rows.push({ type: "panel", path: n.path, group: null });
      continue;
    }
    if (isPins(n)) continue;
    const kids = n.children.filter((c) => shown.has(c.path)).map((c) => c.path);
    if (!kids.length) continue;
    const tabbed = n.tabbed === true;
    const byName = hit(n.name) || hit(aliases(groupKey(n.id)));
    const matched = byName ? kids : kids.filter(matches);
    if (!matched.length) continue;
    rows.push({
      type: "group",
      id: n.id,
      name: n.name,
      icon: n.icon,
      color: n.color ?? null,
      icon_color: n.icon_color ?? null,
      collapsed: false,
      count: tabbed ? kids.length : matched.length,
      selected: kids.includes(selected),
      tabbed,
      paths: kids,
      match: tabbed && !byName ? matched[0] : null,
    });
    if (!tabbed) matched.forEach((p, i) => rows.push({ type: "panel", path: p, group: n.id, last: i === matched.length - 1 }));
  }
  let n = 0;
  for (const v of views) {
    if (n >= MAX_VIEW_RESULTS) break;
    if (!shown.has(v.dash) || !hit(v.title)) continue;
    rows.push({ type: "view", path: v.path, dash: v.dash, title: v.title, icon: v.icon ?? null });
    n++;
  }
  return rows;
}

/**
 * Views of a dashboard config a search can open: { path: "<dash>/<view path or index>", dash, title, icon }.
 * Dashboards with one view, subviews, untitled views and views hidden from `userId` are left out.
 */
export function dashboardViews(dash, config, userId) {
  const views = Array.isArray(config?.views) ? config.views : [];
  if (views.length < 2) return [];
  const out = [];
  views.forEach((v, i) => {
    if (!v || typeof v.title !== "string" || !v.title.trim() || v.subview === true) return;
    if (v.visible === false || (Array.isArray(v.visible) && !v.visible.some((u) => u?.user === userId))) return;
    const path = typeof v.path === "string" && /^[A-Za-z0-9_-]+$/.test(v.path) ? v.path : String(i);
    out.push({ path: `${dash}/${path}`, dash, title: v.title.trim(), icon: typeof v.icon === "string" ? v.icon : null });
  });
  return out;
}

/** What Enter in the search opens: the first panel shown, or the tab to open for a tabbed group. */
export function firstResult(rows, lastTab = new Map()) {
  for (const r of rows) {
    if (r.type === "panel" || r.type === "view") return r.path;
    if (r.tabbed) return r.match ?? tabTarget(r.paths, lastTab.get(r.id));
  }
  return null;
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
  next.splice(at.index, 1, newGroup(id, name, [at.node, node]));
  return next;
}

export function addGroup(tree, id, name) {
  return [newGroup(id, name, []), ...clone(tree)];
}

/** A new link row at the top of the list. */
export const addLink = (tree, id) => [{ type: "panel", path: linkPath(id) }, ...clone(tree)];

/** Remove a panel or link row from wherever it is. */
export function removeEntry(tree, key) {
  const next = clone(tree);
  return take(next, key) ? next : tree;
}

/**
 * "Move to" for a panel or link: `dest` null = the top level (at its end, above the pinned area), a group
 * id = the end of that group, PINS_ID = the end of the pinned area (refused when full). Groups do not move here.
 */
export function moveTo(tree, key, dest) {
  const at = locate(tree, key);
  if (!at || at.node.type !== "panel" || at.group === dest) return tree;
  if (dest === null) {
    const next = clone(tree);
    take(next, key);
    const pins = next.findIndex(isPins);
    next.splice(pins < 0 ? next.length : pins, 0, at.node);
    return next;
  }
  if (groupIndex(tree, dest) < 0) return tree;
  return move(tree, key, groupKey(dest), "into");
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
// Whitespace controls and line / paragraph separators separate words: they become a space before the other
// control characters are dropped (a pasted tab must not glue two words together).
// The C1 NEL and the x1c-x1f separators are still dropped (BUG-014).
const SPACE_CONTROLS = /[\t\n\v\f\r\u2028\u2029]/g;

/** A clean group name, or "" when nothing visible is left. */
export function cleanName(value) {
  const text = String(value ?? "")
    .replace(SPACE_CONTROLS, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, (c) => (ALLOWED_FORMAT.has(c) ? c : ""))
    .trim();
  const name = cpSlice(text, MAX_NAME).trim();
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
  // Pinned panels follow HA's relative order among themselves and stay pinned wherever HA lists them (UX-008).
  if (Array.isArray(layout.grid)) next.grid = resort(layout.grid, (p) => rank.get(p));
  return JSON.stringify(next) === JSON.stringify(layout) ? null : next;
}

/** Whether the editor holds anything to save: the layout (with settings) or the hidden set differ from when it opened. */
export function editChanged(baseTree, tree, baseHidden, hidden, baseSettings, settings, baseMeta = {}, meta = {}) {
  if (JSON.stringify(toLayout(baseTree, baseSettings, baseMeta)) !== JSON.stringify(toLayout(tree, settings, meta))) return true;
  if (baseHidden.size !== hidden.size) return true;
  for (const p of hidden) if (!baseHidden.has(p)) return true;
  return false;
}

/** What Done would save: "none", "hidden-only" (only the hide/show set differs) or "structure" (order, groups, names, icons, colours, pins, settings). */
export function editKind(baseTree, tree, baseHidden, hidden, baseSettings, settings, baseMeta = {}, meta = {}) {
  if (JSON.stringify(toLayout(baseTree, baseSettings, baseMeta)) !== JSON.stringify(toLayout(tree, settings, meta))) return "structure";
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

/**
 * Folded group ids for a page load with "groups start collapsed" on: every group folds except those
 * marked "starts open"; with `accordion` only the first of them (in sidebar order) among the groups
 * shown right now (a group with a visible panel in `visible`), so the rule "one open" holds.
 */
export function initialCollapsed(layout, visible, accordion = false) {
  const groups = layout?.groups ?? {};
  const shown = new Set(visible ?? []);
  const ids = [];
  for (const entry of Array.isArray(layout?.order) ? layout.order : [])
    if (typeof entry === "string" && entry.startsWith(GROUP_PREFIX) && groups[entry.slice(GROUP_PREFIX.length)]) ids.push(entry.slice(GROUP_PREFIX.length));
  for (const id of Object.keys(groups)) if (!ids.includes(id)) ids.push(id);
  let open = ids.filter((id) => groups[id]?.start_open === true);
  if (accordion) {
    const first = open.find((id) => (groups[id].panels ?? []).some((p) => shown.has(p)));
    open = first ? [first] : [];
  }
  return ids.filter((id) => !open.includes(id));
}

/** Whether any of `ids` is open (then "collapse all" applies; otherwise "expand all"). */
export function anyOpen(collapsed, ids) {
  const set = new Set(collapsed ?? []);
  return ids.some((id) => !set.has(id));
}

/**
 * What the collapse / expand all button does now: "collapse" when any group is open, otherwise "expand",
 * except with "one group open at a time" (accordion), where expanding all would break the rule: null
 * (the button is hidden until a group is opened).
 */
export function allAction(collapsed, ids, accordion = false) {
  if (anyOpen(collapsed, ids)) return "collapse";
  return accordion ? null : "expand";
}

/** Collapse all when any group is open, otherwise expand all (not in accordion mode). Ids not in `ids` keep their state. */
export function toggleAll(collapsed, ids, accordion = false) {
  const set = new Set(collapsed ?? []);
  const action = allAction(collapsed, ids, accordion);
  if (action === "collapse") for (const id of ids) set.add(id);
  else if (action === "expand") for (const id of ids) set.delete(id);
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

/**
 * Background of a "pill" header (#34): the theme's header background, or the sidebar a step toward its
 * text colour (lighter on dark themes, darker on light ones); a group colour tints that by 18%.
 * pal: { bg, text, headerBg } opaque [r, g, b].
 */
export function pillBackground(pal, color = null) {
  const base = pal.headerBg ?? mix(pal.bg, pal.text, 0.1);
  const out = color ? mix(base, over(color, base), 0.18) : base;
  return out.slice(0, 3).map((v) => Math.round(v));
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
/** The server's reason for refusing a layout, one line and bounded (it names the entry that failed). */
export function errorDetail(err) {
  const text = typeof err?.message === "string" ? err.message.replace(/\s+/g, " ").trim() : "";
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

export function saveErrorKind(err) {
  if (typeof err === "number") return "connection";
  if (err?.code === "invalid_format") return "invalid";
  if (typeof err?.code === "number" || err instanceof TypeError) return "connection";
  return "other";
}
