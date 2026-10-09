// v0.5 owner rulings 2026-10-09 (issues #40, #52-#62).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const strings = (lang) => {
  const start = SRC.indexOf(`  ${lang}: {`);
  return SRC.slice(start, SRC.indexOf("\n  },", start));
};
const EN = strings("en");
const HE = strings("he");

/* ---- #40 BUG-016: badge fill dark enough for white text and the dot ---- */

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mixBlack = (c, p) => c.map((v) => Math.round(v * p));

test("#40 our badges (rows and group header) use the accent mixed 60% with black under white text", () => {
  const fill = /background-color: color-mix\(in srgb, var\(--accent-color\) 60%, black\); color: #fff;/;
  const group = SRC.slice(SRC.indexOf("const GROUP_CSS"), SRC.indexOf("class EspGroup"));
  assert.match(group.match(/\n\.badge \{[^}]*\}/)[0], fill);
  const side = SRC.slice(SRC.indexOf("const SIDEBAR_CSS"), SRC.indexOf("let sidebarSheet"));
  assert.match(side, /ha-list-item-button > \.badge\.esp-badge \{[^}]*color-mix\(in srgb, var\(--accent-color\) 60%, black\); color: #fff; \}/);
  // HA's own badges (Settings) are not restyled: only .esp-badge.
  assert.doesNotMatch(side, /(^|\n)\.badge \{/);
});

test("#40 HA's default orange mixed 60% with black: white 4.5:1, dot 3:1 on light and dark sidebars", () => {
  const fill = mixBlack(hex("#ff9800"), 0.6);
  assert.ok(L.contrast([255, 255, 255], fill) >= 4.5);
  assert.ok(L.contrast(fill, [255, 255, 255]) >= 3);
  assert.ok(L.contrast(fill, [250, 250, 250]) >= 3);
  assert.ok(L.contrast(fill, [28, 28, 28]) >= 3);
});

/* ---- #55 UX-013: home network hosts get http://, internet names https:// ---- */

test("#55 local hosts (IPv4, localhost, LAN suffixes, one-word host, any port) get http://", () => {
  for (const [typed, want] of [
    ["192.168.1.251:5000", "http://192.168.1.251:5000"],
    ["192.168.1.251", "http://192.168.1.251"],
    ["10.0.0.1/admin", "http://10.0.0.1/admin"],
    ["localhost", "http://localhost"],
    ["localhost:8123/x", "http://localhost:8123/x"],
    ["nas.local", "http://nas.local"],
    ["router.lan", "http://router.lan"],
    ["printer.home", "http://printer.home"],
    ["box.internal/x", "http://box.internal/x"],
    ["nas.home.arpa", "http://nas.home.arpa"],
    ["nas:5000", "http://nas:5000"],
    ["synology:5001/", "http://synology:5001/"],
    ["example.com:8080", "http://example.com:8080"],
  ])
    assert.equal(L.normalizeUrl(typed), want, typed);
});

test("#55 internet names get https://; a bare word stays a Home Assistant page", () => {
  assert.equal(L.normalizeUrl("example.com"), "https://example.com");
  assert.equal(L.normalizeUrl("www.example.co.il/a?b=1"), "https://www.example.co.il/a?b=1");
  assert.equal(L.normalizeUrl("nas"), "/nas");
  assert.equal(L.normalizeUrl("config/automation"), "/config/automation");
  assert.equal(L.normalizeUrl("lovelace/0"), "/lovelace/0");
  // typed schemes are kept, real non-web schemes refused
  assert.equal(L.normalizeUrl("https://nas.local:5001"), "https://nas.local:5001");
  assert.equal(L.normalizeUrl("http://example.com"), "http://example.com");
  for (const bad of ["tel:12345", "sms:12345", "mailto:a@b.com", "javascript:alert(1)"]) assert.equal(L.normalizeUrl(bad), null, bad);
});

/* ---- #60 UX-018: Hebrew wording ---- */

test("#60 the five Hebrew wording changes, plural imperative instead of 'יש ל'", () => {
  assert.match(HE, /\n {4}badge: "מספר על הפריט \(ישות\)",/);
  assert.match(HE, /\n {4}linkUrlInvalid: "הזינו כתובת של דף ב-Home Assistant \(מתחילה ב-\/\) או כתובת אינטרנט \(http או https\)",/);
  assert.match(HE, /\n {4}undo: "בטל שינוי",/);
  assert.match(HE, /\n {4}optMore: "אפשרויות נוספות",/);
  assert.match(HE, /\n {4}entityInvalid: "הזינו מזהה ישות, /);
  assert.match(HE, /\n {4}iconInvalid: "כתבו בצורה mdi:name",/);
  assert.match(HE, /\n {4}nameRequired: "הזינו שם לקבוצה",/);
  assert.doesNotMatch(HE, /יש ל(הזין|כתוב)|צריך שם|"עוד"|ישות לתג/);
  // Undo is no longer the same word as Cancel.
  assert.notEqual(HE.match(/\n {4}undo: "([^"]*)"/)[1], HE.match(/\n {4}cancel: "([^"]*)"/)[1]);
});

/* ---- #58 UX-016: short Hebrew add buttons, full text as tooltip and accessible name ---- */

test("#58 Hebrew add buttons show 'קבוצה' / 'קישור'; English unchanged", () => {
  assert.match(HE, /\n {4}addGroupShort: "קבוצה",/);
  assert.match(HE, /\n {4}addLinkShort: "קישור",/);
  assert.match(HE, /\n {4}addGroup: "הוספת קבוצה",/);
  assert.match(HE, /\n {4}addLink: "הוספת קישור",/);
  assert.match(EN, /\n {4}addGroupShort: "Add group",/);
  assert.match(EN, /\n {4}addLinkShort: "Add link",/);
  // The accessible name (full text) contains the visible word (WCAG 2.5.3).
  for (const [s, f] of [["קבוצה", "הוספת קבוצה"], ["קישור", "הוספת קישור"]]) assert.ok(f.includes(s));
});

test("#58 the add buttons draw the short label and carry the full one as title and aria-label", () => {
  assert.match(SRC, /addBtn\("add", ICONS\.plus, t\(lang, "addGroupShort"\), t\(lang, "addGroup"\)/);
  assert.match(SRC, /addBtn\("addlink", ICONS\.link, t\(lang, "addLinkShort"\), t\(lang, "addLink"\)/);
  assert.match(SRC, /const long = short === full \? null : full;\n\s+return h\("button", \{ class: "add", type: "button", "data-focus-key": focusKey, "aria-label": long, title: long, onclick: run \}, svg\(icon\), short\);/);
});

/* ---- #57 UX-015: narrow editor, hint behind "?", 44 px row buttons ---- */

const EDITOR_CSS = SRC.slice(SRC.indexOf("const EDITOR_CSS"), SRC.indexOf("function limitInput"));

test("#57 a labelled '?' toggle (aria-expanded, aria-controls) folds the hint on narrow screens, in place", () => {
  assert.match(EN, /\n {4}hintToggle: "[^"]+",/);
  assert.match(HE, /\n {4}hintToggle: "[^"]+",/);
  assert.match(SRC, /class: "icon-btn help",[\s\S]{0,80}"aria-expanded": String\(this\.hasAttribute\("hint-open"\)\),\n\s+"aria-controls": "esp-hint",\n\s+"aria-label": t\(lang, "hintToggle"\),/);
  assert.match(SRC, /this\.toggleAttribute\("hint-open", open\);\n\s+e\.currentTarget\.setAttribute\("aria-expanded", String\(open\)\);/);
  assert.match(SRC, /h\("div", \{ class: "note hint", id: "esp-hint" \}, t\(lang, "hint"\)\)/);
  assert.match(EDITOR_CSS, /:host\(\[narrow\]:not\(\[hint-open\]\)\) \.hint \{ display: none; \}/);
  assert.match(EDITOR_CSS, /@media \(max-width: 600px\) \{[\s\S]*:host\(:not\(\[hint-open\]\)\) \.hint \{ display: none; \}/);
  // The "?" exists only on narrow screens.
  assert.match(EDITOR_CSS, /\n\.help \{ display: none;/);
});

test("#57 handle, eye and ⋮ are 44 px on narrow screens; the controller marks the editor narrow", () => {
  assert.match(EDITOR_CSS, /:host\(\[narrow\]\) \.handle, :host\(\[narrow\]\) \.icon-btn\.eye, :host\(\[narrow\]\) \.icon-btn\.more \{ width: 44px; height: 44px; \}/);
  assert.match(EDITOR_CSS, /@media \(max-width: 600px\) \{[\s\S]*\.handle, \.icon-btn\.eye, \.icon-btn\.more \{ width: 44px; height: 44px; \}/);
  assert.match(SRC, /setFlag\(this\.editor, "narrow", this\.sb\.hasAttribute\("narrow"\)\);\n\s+return \[this\.editor\];/);
});

/* ---- #59 UX-017: link icon chips ---- */

test("#59 link icons: the groups' suggestions plus link-type icons, every one a valid icon", () => {
  const list = SRC.match(/const LINK_ICONS = \[\.\.\.new Set\(\[([^\]]*), \.\.\.SUGGESTED_ICONS\]\)\];/);
  assert.ok(list, "LINK_ICONS built from SUGGESTED_ICONS");
  const extra = [...list[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const icon of ["mdi:router-wireless", "mdi:nas", "mdi:web", "mdi:robot", "mdi:cog", "mdi:link-variant"]) assert.ok(extra.includes(icon), icon);
  for (const icon of extra) assert.ok(L.validIcon(icon), icon);
});

test("#59 a link chip fills the icon field and commits it through the field (no re-render); pressed state patched in place", () => {
  const opts = SRC.slice(SRC.indexOf("  optionsPanel(key) {"), SRC.indexOf("  /** A link's name or icon changed"));
  assert.match(opts, /LINK_ICONS\.map\(\(icon\) =>/);
  assert.match(opts, /"data-link-chip": id,/);
  assert.match(opts, /input\.value = icon;\n\s+input\.dispatchEvent\(new Event\("change"\)\);/);
  assert.doesNotMatch(opts.slice(opts.indexOf("LINK_ICONS.map")), /^\s{0,20}this\.set\(/m);
  assert.match(SRC, /for \(const chip of this\.shadowRoot\.querySelectorAll\(`\[data-link-chip="\$\{CSS\.escape\(id\)\}"\]`\)\)\n\s+chip\.setAttribute\("aria-pressed", String\(chip\.getAttribute\("aria-label"\) === own\)\);/);
});

/* ---- #61 UX-019: rail groups get HA's ha-tooltip ---- */

test("#61 a rail group gets an <ha-tooltip for=row id> sibling with its full name, placement by direction, feature detected", () => {
  const fn = SRC.slice(SRC.indexOf("  groupTip(row, el, iconOnly, rtl) {"), SRC.indexOf("  /** The search box, one element"));
  assert.match(fn, /if \(!iconOnly \|\| !customElements\.get\("ha-tooltip"\)\) return null;/);
  assert.match(fn, /document\.createElement\("ha-tooltip"\)/);
  assert.match(fn, /setAttr\(tip, "for", el\.id\);/);
  assert.match(fn, /setAttr\(tip, "placement", rtl \? "left" : "right"\);/);
  assert.match(fn, /setText\(tip, row\.name\);/);
  assert.match(SRC, /el\.id = `esp-group-\$\{\+\+this\.groupSeq\}`;/);
  assert.match(SRC, /return tip \? \[el, tip\] : el;/);
  // Fallback: the title only when no ha-tooltip is drawn; the accessible name is unchanged.
  assert.match(SRC, /const title = iconOnly && !this\.tipped \? row\.name : "";/);
  assert.match(SRC, /setAttr\(this\._row, "aria-label", `\$\{row\.name\}, \$\{count\}\$\{said\}`\);/);
});

/* ---- #52 UX-010: warn about an entity that does not exist; saving stays allowed ---- */

test("#52 unknownEntity: a well-formed id missing from hass.states", () => {
  const states = { "binary_sensor.door": { state: "on" }, "counter.open_windows": { state: "2" } };
  assert.equal(L.unknownEntity("input_boolean.alrm", states), true);
  assert.equal(L.unknownEntity(" Binary_Sensor.Door ", states), false);
  assert.equal(L.unknownEntity("counter.open_windows", states), false);
  // empty or malformed: no warning (the format error covers it)
  assert.equal(L.unknownEntity("", states), false);
  assert.equal(L.unknownEntity("not an id", states), false);
  assert.equal(L.unknownEntity("toString", {}), false);
  assert.equal(L.unknownEntity("a.constructor", {}), true);
  assert.equal(L.unknownEntity("sensor.x", undefined), true);
});

test("#52 entity fields show a role=status warning (not aria-invalid), described by the input; save not blocked", () => {
  assert.match(EN, /\n {4}entityMissing: "This entity does not exist in Home Assistant\.",/);
  assert.match(HE, /\n {4}entityMissing: "הישות הזו לא קיימת ב-Home Assistant\.",/);
  assert.match(SRC, /const warning = warn \? h\("div", \{ class: "warning", id: warnId, role: "status" \}/);
  assert.match(SRC, /"aria-describedby": \[errId, warnId, helpId\]\.filter\(Boolean\)\.join\(" "\),/);
  assert.match(SRC, /if \(warning\) warning\.textContent = message \? "" : warn\(input\.value\);/);
  assert.match(SRC, /warn: \(v\) => \(L\.unknownEntity\(v, this\.hass\?\.states\) \? t\(lang, "entityMissing"\) : ""\),/);
  // the warning never enters optErrors (which is what blocks Done)
  const fn = SRC.slice(SRC.indexOf("function optField("), SRC.indexOf("class EspEditor"));
  assert.doesNotMatch(fn, /errors\?\.set\([^)]*warn/);
});

/* ---- #53 UX-011: rule marker on editor rows, dimmed while the rule hides the row ---- */

test("#53 ruleOf: badge / show-when entities and whether the condition hides the entry now", () => {
  const on = (e) => e === "input_boolean.alarm";
  assert.equal(L.ruleOf({}, on), null);
  assert.equal(L.ruleOf({ aliases: "x" }, on), null);
  assert.equal(L.ruleOf({ badge: "bad id" }, on), null);
  assert.deepEqual(L.ruleOf({ badge: "counter.open_windows" }, on), { badge: "counter.open_windows", showWhen: null, hiddenNow: false });
  assert.deepEqual(L.ruleOf({ show_when: "input_boolean.alarm" }, on), { badge: null, showWhen: "input_boolean.alarm", hiddenNow: false });
  assert.deepEqual(L.ruleOf({ badge: "counter.c", show_when: "input_boolean.off" }, on), { badge: "counter.c", showWhen: "input_boolean.off", hiddenNow: true });
});

test("#53 the marker and dimming are applied when rows are built and patched in place after a ⋮ field commit", () => {
  assert.match(EN, /\n {4}hiddenNow: "Hidden now: \{entity\} is off",/);
  assert.match(HE, /\n {4}hiddenNow: "מוסתר כעת: \{entity\} כבוי",/);
  assert.match(EN, /\n {4}ruleBadge: "[^"]*\{entity\}[^"]*",/);
  assert.match(HE, /\n {4}ruleShowWhen: "[^"]*\{entity\}[^"]*",/);
  const fn = SRC.slice(SRC.indexOf("  applyRule(row, ikey) {"), SRC.indexOf("  /** The row of a layout key"));
  assert.match(fn, /row\.classList\.toggle\("rule-off", !!rule\?\.hiddenNow\);/);
  assert.match(fn, /setAttr\(row, "title", text \|\| null\);/);
  assert.match(fn, /setAttr\(handle, "aria-description", text \|\| null\);/);
  assert.match(fn, /h\("span", \{ class: "rule", role: "img" \}, svg\(ICONS\.rule\)\)/);
  assert.match(SRC, /this\.applyRule\(row, L\.itemKey\(key\)\);\n\s+return this\.optionsOpen === key/);
  assert.match(SRC, /this\.applyRule\(head, key\);/);
  // setItem patches the row in place (no editor re-render that drops focus).
  const setItem = SRC.slice(SRC.indexOf("      setItem: (ikey, field, value) => {"), SRC.indexOf("      rename: (id, input) => {"));
  assert.match(setItem, /e\.patchRule\(ikey\);/);
  assert.doesNotMatch(setItem, /e\.set\(|\.render\(\)/);
});

/* ---- #62 UX-020: the hint says where the search box is ---- */

test("#62 the editor hint ends with where to turn on the search box", () => {
  assert.match(EN, /\n {4}hint: "[^"]*The search box is under Display options\.",/);
  assert.match(HE, /\n {4}hint: "[^"]*תיבת חיפוש נמצאת באפשרויות תצוגה\.",/);
  // Search stays off by default.
  assert.equal(L.DEFAULT_SETTINGS.search, false);
});

test("#60 the English address error names http or https", () => {
  assert.match(EN, /\n {4}linkUrlInvalid: "Enter a Home Assistant page \(starting with \/\) or a web address \(http or https\)",/);
});
