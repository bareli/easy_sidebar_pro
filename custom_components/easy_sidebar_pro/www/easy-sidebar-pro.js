// Easy Sidebar Pro: collapsible groups in the Home Assistant sidebar, edited in place.
// Patches ha-sidebar's own render methods so groups are part of HA's render cycle (no flicker).
import * as L from "./layout.js";

const DOMAIN = "easy_sidebar_pro";
const ctrls = new WeakMap();
// Whether HA's sidebar has the fixed-panel renderer the bottom grid draws into (feature detection).
let gridSupported = false;

const ICONS = {
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  chevron: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  drag: "M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z",
  eye: "M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z",
  eyeOff: "M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z",
  ungroup: "M20,6H12L10,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8A2,2 0 0,0 20,6M20,18H4V8H20V18M14.59,10L12,12.59L9.41,10L8,11.41L10.59,14L8,16.59L9.41,18L12,15.41L14.59,18L16,16.59L13.41,14L16,11.41L14.59,10Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  pin: "M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z",
  collapseAll: "M16.59,5.41L15.17,4L12,7.17L8.83,4L7.41,5.41L12,10M7.41,18.59L8.83,20L12,16.83L15.17,20L16.58,18.59L12,14L7.41,18.59Z",
  expandAll: "M12,18.17L8.83,15L7.42,16.41L12,21L16.59,16.41L15.17,15M12,5.83L15.17,9L16.58,7.59L12,3L7.41,7.59L8.83,9L12,5.83Z",
  folderOpen: "M6.1,10L4,18V8H21A2,2 0 0,0 19,6H12L10,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H19C19.9,20 20.7,19.4 20.9,18.5L23.2,10H6.1M19,18H6L7.6,12H20.6L19,18Z",
};

const PANEL_ICONS = {
  calendar: "mdi:calendar",
  energy: "mdi:lightning-bolt",
  history: "mdi:chart-box",
  logbook: "mdi:format-list-bulleted-type",
  map: "mdi:tooltip-account",
  "media-browser": "mdi:play-box-multiple",
  todo: "mdi:clipboard-list",
};
const FIXED_PANELS = ["profile", "config", "notfound"];
const DEFAULT_ICON = "mdi:folder-outline";
const HOLD_MS = 1500;
const GHOST_INSET = 24;
const GHOST_GAP = 28;
const ADOPT_SPREAD_MS = 1000;
const SUGGESTED_ICONS = [
  "mdi:home", "mdi:sofa", "mdi:bed", "mdi:silverware-fork-knife", "mdi:lightbulb-group", "mdi:thermometer",
  "mdi:shield-home", "mdi:camera", "mdi:chart-line", "mdi:calendar-month", "mdi:tools", "mdi:cog",
  "mdi:star", "mdi:account-group", "mdi:car", "mdi:flower", "mdi:television", "mdi:teddy-bear", "mdi:lightbulb-on", "mdi:water",
];
const LIST_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Enter", " "]);

const STRINGS = {
  en: {
    edit: "Edit sidebar",
    editing: "Editing the sidebar",
    done: "Done",
    cancel: "Cancel",
    addGroup: "Add group",
    newGroup: "New group",
    groupName: "Group name",
    inGroup: "in group {name}",
    groupIcon: "Icon and colour of {name}",
    iconHelp: "Icon, for example mdi:home",
    iconInvalid: "Use the form mdi:name",
    color: "Colour",
    iconColor: "Icon colour",
    noColor: "No colour",
    customColor: "Custom colour, for example #4caf50",
    pickColor: "Choose a colour",
    colorInvalid: "Use the form #rrggbb",
    c_primary: "Theme colour",
    c_accent: "Accent colour",
    c_red: "Red",
    c_pink: "Pink",
    c_purple: "Purple",
    c_indigo: "Indigo",
    c_blue: "Blue",
    c_cyan: "Cyan",
    c_teal: "Teal",
    c_green: "Green",
    c_lime: "Lime",
    c_amber: "Amber",
    c_orange: "Orange",
    c_brown: "Brown",
    c_grey: "Grey",
    display: "Display",
    startCollapsed: "Groups start collapsed",
    startCollapsedHelp: "On every page load, except groups whose open folder button is on (with one group open at a time: the first of them). Folding is then not remembered.",
    startOpen: "{name} opens on page load",
    accordion: "One group open at a time",
    toggleAllOption: "Collapse / expand all button next to the title",
    headerStyle: "Group headers",
    header_plain: "Plain",
    header_tinted: "Tinted background",
    header_line: "Line above",
    header_pill: "Rounded with background",
    dividerStyle: "Line beside grouped items",
    divider_line: "Show",
    divider_none: "Hide",
    collapseAll: "Collapse all groups",
    expandAll: "Expand all groups",
    pinned: "Pinned at the bottom",
    pinnedHelp: "Shown as icons above Settings. Drag items here.",
    pinnedCount: "{n} of {max}",
    pinnedFull: "The pinned area is full ({max} items).",
    pinnedDesc: "Pinned",
    movedPinned: "{name}: pinned, position {pos}",
    ungroup: "Ungroup {name}",
    hide: "Hide {name}",
    show: "Show {name}",
    alwaysShown: "{name} (default) is always shown",
    drag: "Move {name}. Drag, or Alt + arrow keys.",
    items: "{n} items",
    items1: "1 item",
    empty: "Drop items here",
    mergeLabel: "New group with {name}",
    reset: "Reset to the default layout",
    resetAsk: "Delete your layout and go back to the default layout?",
    resetOk: "Delete my layout",
    resetDone: "You are back on the default layout.",
    resetPlain: "Remove groups and custom order",
    resetPlainAsk: "Remove all your groups and go back to Home Assistant's own order? Hidden panels stay hidden.",
    resetPlainOk: "Remove",
    forkedByHa: "Your new order is saved as your own layout. It no longer follows the default layout.",
    undo: "Undo",
    forEveryone: "For everyone",
    setDefault: "Set as default for everyone",
    setDefaultAsk: "This replaces the sidebar of every user who has not customised their own.",
    setDefaultOk: "Set for everyone",
    setDefaultDone: "The default layout is set for everyone.",
    clearDefault: "Remove the default layout",
    clearDefaultAsk: "Users who have not customised their sidebar go back to Home Assistant's order.",
    clearDefaultOk: "Remove",
    clearDefaultDone: "The default layout was removed.",
    onDefault: "You are using the default layout.",
    forkNote: "Saving makes this layout yours: it will no longer follow the default layout. You can go back to it later. Press Done again to save.",
    saveFailed: "Could not save. Try again.",
    saveFailedConnection: "Could not save. Check the connection and try again.",
    saveFailedInvalid: "Could not save: a group name, icon or colour is not valid.",
    movedTop: "{name}: position {pos}",
    movedGroup: "{name}: in {group}, position {pos}",
    grouped: "Group created with {a} and {b}",
    nameRequired: "Enter a group name",
    hint: "Drag a row onto another row to make a group.",
  },
  he: {
    edit: "עריכת סרגל הצד",
    editing: "עריכת סרגל הצד",
    done: "סיום",
    cancel: "ביטול",
    addGroup: "הוספת קבוצה",
    newGroup: "קבוצה חדשה",
    groupName: "שם הקבוצה",
    inGroup: "בקבוצה {name}",
    groupIcon: "הסמל והצבע של {name}",
    iconHelp: "סמל, למשל mdi:home",
    iconInvalid: "יש לכתוב בצורה mdi:name",
    color: "צבע",
    iconColor: "צבע הסמל",
    noColor: "ללא צבע",
    customColor: "צבע מותאם, למשל #4caf50",
    pickColor: "בחירת צבע",
    colorInvalid: "יש לכתוב בצורה #rrggbb",
    c_primary: "צבע ערכת הנושא",
    c_accent: "צבע הדגשה",
    c_red: "אדום",
    c_pink: "ורוד",
    c_purple: "סגול",
    c_indigo: "אינדיגו",
    c_blue: "כחול",
    c_cyan: "תכלת",
    c_teal: "טורקיז",
    c_green: "ירוק",
    c_lime: "ירוק ליים",
    c_amber: "ענבר",
    c_orange: "כתום",
    c_brown: "חום",
    c_grey: "אפור",
    display: "תצוגה",
    startCollapsed: "הקבוצות מתחילות מקופלות",
    startCollapsedHelp: "בכל טעינה של הדף, חוץ מקבוצות שכפתור התיקייה הפתוחה שלהן מופעל (כשרק קבוצה אחת פתוחה: הראשונה מהן). קיפול של קבוצה לא נשמר.",
    startOpen: "{name} נפתחת בטעינת הדף",
    accordion: "קבוצה אחת פתוחה בכל פעם",
    toggleAllOption: "כפתור קיפול ופתיחה של הכול ליד הכותרת",
    headerStyle: "כותרות הקבוצות",
    header_plain: "רגילות",
    header_tinted: "רקע צבעוני",
    header_line: "קו מעל",
    header_pill: "מעוגלות עם רקע",
    dividerStyle: "קו לצד הפריטים שבקבוצה",
    divider_line: "להציג",
    divider_none: "להסתיר",
    collapseAll: "קיפול כל הקבוצות",
    expandAll: "פתיחת כל הקבוצות",
    pinned: "מוצמדים למטה",
    pinnedHelp: "מוצגים כסמלים מעל ההגדרות. גררו לכאן פריטים.",
    pinnedCount: "{n} מתוך {max}",
    pinnedFull: "האזור המוצמד מלא ({max} פריטים).",
    pinnedDesc: "מוצמד",
    movedPinned: "{name}: מוצמד, מקום {pos}",
    ungroup: "פירוק הקבוצה {name}",
    hide: "הסתרת {name}",
    show: "הצגת {name}",
    alwaysShown: "{name} (ברירת מחדל) מוצג תמיד",
    drag: "הזזת {name}. גררו, או Alt + חצים.",
    items: "{n} פריטים",
    items1: "פריט אחד",
    empty: "גררו לכאן פריטים",
    mergeLabel: "קבוצה חדשה עם {name}",
    reset: "חזרה לפריסת ברירת המחדל",
    resetAsk: "למחוק את הפריסה שלכם ולחזור לפריסת ברירת המחדל?",
    resetOk: "מחיקת הפריסה שלי",
    resetDone: "חזרתם לפריסת ברירת המחדל.",
    resetPlain: "הסרת הקבוצות והסדר המותאם",
    resetPlainAsk: "להסיר את כל הקבוצות ולחזור לסדר של Home Assistant? פריטים מוסתרים יישארו מוסתרים.",
    resetPlainOk: "הסרה",
    forkedByHa: "הסדר החדש נשמר כפריסה שלכם. היא כבר לא עוקבת אחרי פריסת ברירת המחדל.",
    undo: "ביטול",
    forEveryone: "לכל המשתמשים",
    setDefault: "קביעה כברירת מחדל לכולם",
    setDefaultAsk: "הפעולה תחליף את סרגל הצד של כל משתמש שלא שינה את שלו.",
    setDefaultOk: "קביעה לכולם",
    setDefaultDone: "פריסת ברירת המחדל נקבעה לכולם.",
    clearDefault: "ביטול פריסת ברירת המחדל",
    clearDefaultAsk: "משתמשים שלא שינו את סרגל הצד שלהם יחזרו לסדר של Home Assistant.",
    clearDefaultOk: "הסרה",
    clearDefaultDone: "פריסת ברירת המחדל הוסרה.",
    onDefault: "זו פריסת ברירת המחדל.",
    forkNote: "שמירה תהפוך את הפריסה לשלכם, והיא לא תעקוב יותר אחרי פריסת ברירת המחדל. אפשר לחזור אליה בהמשך. לחצו שוב על סיום כדי לשמור.",
    saveFailed: "לא ניתן לשמור. נסו שוב.",
    saveFailedConnection: "לא ניתן לשמור. בדקו את החיבור ונסו שוב.",
    saveFailedInvalid: "לא ניתן לשמור: שם, סמל או צבע של קבוצה אינם תקינים.",
    movedTop: "{name}: מקום {pos}",
    movedGroup: "{name}: בקבוצה {group}, מקום {pos}",
    grouped: "נוצרה קבוצה עם {a} ועם {b}",
    nameRequired: "צריך שם לקבוצה",
    hint: "גררו שורה אל שורה אחרת כדי ליצור קבוצה.",
  },
};

function t(lang, key, vars = {}) {
  const table = STRINGS[lang] ?? STRINGS.en;
  return (table[key] ?? STRINGS.en[key]).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const langOf = (hass) => ((hass?.language ?? "en").toLowerCase().startsWith("he") ? "he" : "en");

/** Tiny DOM builder: elements and text nodes only, never HTML strings. */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith(".")) el[k.slice(1)] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

function svg(path, cls = "") {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  if (cls) s.setAttribute("class", cls);
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", path);
  s.append(p);
  return s;
}

function iconEl(icon, path = null) {
  if (path) return h("ha-svg-icon", { class: "icon", ".path": path });
  if (!icon) return h("span", { class: "icon" });
  return h("ha-icon", { class: "icon", ".icon": icon });
}

function defaultPanelPath(hass) {
  let legacy = null;
  try {
    const v = window.localStorage.getItem("defaultPanel");
    legacy = v ? JSON.parse(v) : null;
  } catch (_err) {
    legacy = null;
  }
  const p = hass.userData?.default_panel || hass.systemData?.default_panel || legacy || "home";
  return p === "lovelace" && !hass.panels?.lovelace?.config ? "home" : p;
}

/** Set or remove an inline custom property, writing only on change (each write costs a style pass). */
function setVar(el, name, value) {
  const want = value ?? "";
  if (el.style.getPropertyValue(name) === want) return;
  if (want) el.style.setProperty(name, want);
  else el.style.removeProperty(name);
}

const panelTitle = (hass, panel) => hass.localize?.(`panel.${panel.title}`) || panel.title || panel.url_path;

/* ------------------------------------------------------------------ group header */

// Theme hooks (documented in the README): --esp-group-header-text-color, --esp-group-header-icon-color,
// --esp-group-header-background, --esp-group-header-radius, --esp-group-divider-color, --esp-group-divider-width.
// A group's own colours (--esp-own-*) are set inline, already adjusted for contrast, and win over them.
const GROUP_CSS = `
:host { display: block; outline: none; margin-block-end: 4px; }
.row {
  display: flex; align-items: center; gap: 12px; box-sizing: border-box;
  min-height: 40px; padding-block: 4px; padding-inline: 12px 8px; margin-inline: 4px;
  border-radius: var(--esp-group-header-radius, var(--ha-border-radius-md, 8px)); cursor: pointer;
  color: var(--esp-own-color, var(--esp-group-header-text-color, var(--sidebar-text-color, var(--primary-text-color))));
  font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500);
}
:host([header="tinted"]) .row { background-color: var(--esp-own-bg, var(--esp-group-header-background, rgba(var(--rgb-primary-text-color, 0,0,0), 0.05))); }
:host([header="line"]) { border-top: 1px solid var(--esp-own-line, var(--esp-group-divider-color, var(--divider-color))); padding-top: 4px; margin-inline: 8px; }
:host([header="line"]) .row { margin-inline: -4px; }
:host([header="line"]:first-child) { border-top-color: transparent; }
/* Pill: fully rounded, a background a step lighter (dark themes) or darker (light themes) than the
   sidebar; the frontend sets --esp-own-bg and contrast-adjusted text, count and chevron colours for it. */
:host([header="pill"]) .row { border-radius: var(--esp-group-header-radius, 20px);
  background-color: var(--esp-own-bg, var(--esp-group-header-background, rgba(var(--rgb-primary-text-color, 0,0,0), 0.08))); }
:host([header="pill"]) .count, :host([header="pill"]) .chev { color: var(--esp-own-sub, var(--secondary-text-color)); }
.row:hover { background-image: linear-gradient(var(--sidebar-hover-background-color, rgba(var(--rgb-primary-text-color, 0,0,0), 0.06)), var(--sidebar-hover-background-color, rgba(var(--rgb-primary-text-color, 0,0,0), 0.06))); }
.row:focus { outline: none; }
.row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
.icon { --mdc-icon-size: 24px; color: var(--esp-own-icon-color, var(--esp-group-header-icon-color, var(--sidebar-icon-color, var(--secondary-text-color)))); flex: none; width: 24px; height: 24px; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); font-weight: normal; font-variant-numeric: tabular-nums; }
.chev { width: 20px; height: 20px; flex: none; fill: currentColor; color: var(--secondary-text-color); transition: transform 0.15s; }
:host([collapsed]) .chev { transform: rotate(-90deg); }
:host([collapsed][rtl]) .chev { transform: rotate(90deg); }
:host([selected]) .row { color: var(--esp-own-sel, var(--sidebar-selected-text-color, var(--primary-color))); }
:host([selected]) .icon { color: var(--esp-own-sel-icon, var(--sidebar-selected-icon-color, var(--primary-color))); }
:host([icon-only]) .name, :host([icon-only]) .count, :host([icon-only]) .chev { display: none; }
:host([icon-only]) .row { padding-inline: 12px; justify-content: flex-start; }
:host([icon-only][collapsed]) .row { border-inline-start: 3px solid var(--divider-color); padding-inline-start: 9px; }
:host([icon-only][collapsed][header="pill"]) .row { border-inline-start: 0; padding-inline-start: 12px; }
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
`;

class EspGroup extends HTMLElement {
  constructor() {
    super();
    this.interactive = true;
    this.disabled = false;
    // The host is the list item HA's roving tabindex moves between (like HA's own rows); focus is
    // delegated to the inner button, which carries the role, the name and the expanded state.
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    const style = h("style");
    style.textContent = GROUP_CSS;
    this._icon = iconEl(DEFAULT_ICON);
    this._name = h("span", { class: "name" });
    this._count = h("span", { class: "count" });
    this._row = h("div", { class: "row", part: "row", role: "button", tabindex: "-1" }, this._icon, this._name, this._count, svg(ICONS.chevron, "chev"));
    root.append(style, this._row);
    this.addEventListener("click", () => this.onToggle?.());
  }

  connectedCallback() {
    this.setAttribute("role", "listitem");
    this.setAttribute("ha-list-item", "");
    this._list = this.closest("ha-list-nav");
    this._list?.dispatchEvent(new CustomEvent("ha-list-item-register", { detail: { item: this } }));
  }

  disconnectedCallback() {
    this._list?.dispatchEvent(new CustomEvent("ha-list-item-unregister", { detail: { item: this } }));
    this._list = null;
  }

  activate() {
    this.onToggle?.();
  }

  /** look: { text, icon, bg, line, sub, sel, selIcon } CSS colours (null = theme default) and header (L.HEADER_STYLES). */
  update(row, lang, iconOnly, rtl, look = null, header = "plain") {
    setVar(this, "--esp-own-color", look?.text);
    setVar(this, "--esp-own-icon-color", look?.icon);
    setVar(this, "--esp-own-bg", look?.bg);
    setVar(this, "--esp-own-line", look?.line);
    setVar(this, "--esp-own-sub", look?.sub);
    setVar(this, "--esp-own-sel", look?.sel);
    setVar(this, "--esp-own-sel-icon", look?.selIcon);
    if (this.getAttribute("header") !== header) this.setAttribute("header", header);
    this._icon.icon = row.icon || DEFAULT_ICON;
    this._name.textContent = row.name;
    const count = row.count === 1 ? t(lang, "items1") : t(lang, "items", { n: row.count });
    this._count.textContent = row.collapsed ? String(row.count) : "";
    this.toggleAttribute("collapsed", row.collapsed);
    this.toggleAttribute("selected", row.collapsed && row.selected);
    this.toggleAttribute("icon-only", iconOnly);
    this.toggleAttribute("rtl", rtl);
    this._row.setAttribute("aria-expanded", String(!row.collapsed));
    this._row.setAttribute("aria-label", `${row.name}, ${count}`);
    this.title = iconOnly ? row.name : "";
  }
}

/* ------------------------------------------------------------------ editor */

// Contrast (WCAG AA 4.5:1) with the user's theme hue: action text is the theme colour mixed toward
// the text colour (darker on light themes, lighter on dark ones); the filled button is the theme
// colour mixed with black under white text. The plain declarations are the fallback without color-mix.
const EDITOR_CSS = `
:host { display: block; color: var(--sidebar-text-color, var(--primary-text-color)); font-size: var(--ha-font-size-m, 14px);
  user-select: text; -webkit-user-select: text;
  --esp-action-color: var(--primary-color);
  --esp-action-color: color-mix(in srgb, var(--primary-color) 60%, var(--primary-text-color, #212121));
  --esp-fill-color: var(--primary-color);
  --esp-fill-color: color-mix(in srgb, var(--primary-color) 65%, black);
  --esp-error-color: var(--error-color, #db4437);
  --esp-error-color: color-mix(in srgb, var(--error-color, #db4437) 75%, var(--primary-text-color, #212121)); }
.handle, .row .title, .bar-title, .note { user-select: none; -webkit-user-select: none; }
.bar { position: sticky; top: 0; z-index: 2; background: var(--sidebar-background-color, var(--card-background-color));
  display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--divider-color); }
.bar-title { font-weight: var(--ha-font-weight-medium, 500); }
.bar-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.note { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); line-height: 1.4; }
.error { color: var(--esp-error-color); font-size: var(--ha-font-size-s, 12px); }
.field-error { padding: 0 12px 6px; }
.field-error:empty { padding: 0; }
button { font: inherit; color: inherit; }
.btn { border: 1px solid var(--divider-color); background: none; border-radius: 18px; min-height: 36px; padding: 0 14px; cursor: pointer; }
.btn.primary { background: var(--esp-fill-color); border-color: var(--esp-fill-color); color: #fff; }
.btn:focus-visible, .icon-btn:focus-visible, .handle:focus-visible, input:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
.list { padding: 0 0 6px; }
.add { display: flex; align-items: center; gap: 8px; margin: 8px 8px 6px; padding: 0 8px; min-height: 40px; width: calc(100% - 16px);
  border: 1px dashed var(--divider-color); border-radius: 8px; background: none; cursor: pointer; color: var(--esp-action-color); }
.add svg { width: 20px; height: 20px; fill: currentColor; }
.group { margin: 4px 6px; border-radius: 10px; border: 1px solid var(--divider-color); }
.row { display: flex; align-items: center; gap: 6px; min-height: 40px; padding-inline: 2px 4px; box-sizing: border-box; border-radius: 8px; position: relative; }
.group > .row.head { background: var(--secondary-background-color, rgba(0,0,0,0.04)); border-radius: 9px 9px 0 0; }
.top > .row { margin: 0 6px; }
.children { padding-block: 2px; min-height: 8px; }
.children > .row { padding-inline-start: 14px; }
.empty { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); padding: 8px 16px; }
.handle { flex: none; width: 32px; height: 36px; display: grid; place-items: center; border: none; background: none; cursor: grab;
  touch-action: none; color: var(--secondary-text-color); border-radius: 6px; }
.handle svg { width: 20px; height: 20px; fill: currentColor; }
.icon { --mdc-icon-size: 22px; width: 22px; height: 22px; flex: none; color: var(--sidebar-icon-color, var(--secondary-text-color)); }
.title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
:host([rtl]) .title { text-align: right; }
.merge-label { display: none; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--ha-font-weight-medium, 500);
  color: var(--esp-action-color); }
.row.merge .title, .row.merge .eye { display: none; }
.row.merge .merge-label { display: block; }
.row.hidden .title { color: var(--secondary-text-color); }
.row.hidden .icon { opacity: 0.45; }
.icon-btn { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border: none; background: none; border-radius: 50%; cursor: pointer; color: var(--secondary-text-color); }
.icon-btn svg { width: 20px; height: 20px; fill: currentColor; }
.icon-btn[disabled], .icon-btn[aria-disabled="true"] { opacity: 0.3; cursor: default; }
.icon-btn:not([disabled]):not([aria-disabled="true"]):hover { background: rgba(127,127,127,0.15); }
.name-input { flex: 1; min-width: 0; font: inherit; font-weight: var(--ha-font-weight-medium, 500); color: inherit; background: transparent;
  border: 1px solid transparent; border-bottom-color: var(--secondary-text-color); border-radius: 6px 6px 0 0; padding: 6px; }
.name-input:hover { border-color: var(--divider-color); border-bottom-color: var(--primary-text-color); }
.name-input[aria-invalid="true"] { border-color: var(--esp-error-color); }
.icon-edit { display: flex; flex-direction: column; gap: 6px; padding: 6px 10px 10px; border-bottom: 1px solid var(--divider-color); }
.icon-line { display: flex; gap: 8px; align-items: center; }
.chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 2px; }
.chip[aria-pressed="true"] { background: rgba(var(--rgb-primary-color, 3,169,244), 0.18); color: var(--primary-color); }
.icon-edit input[aria-invalid="true"] { border-color: var(--esp-error-color); }
.icon-edit input { flex: 1; min-width: 0; font: inherit; color: inherit; background: transparent; border: 1px solid var(--divider-color); border-radius: 6px; padding: 6px; }
.dragging { opacity: 0.35; }
.drop-before::before, .drop-after::after { content: ""; position: absolute; inset-inline: 4px; height: 3px; border-radius: 2px; background: var(--primary-color); }
.drop-before::before { top: -2px; }
.drop-after::after { bottom: -2px; }
.drop-into { outline: 2px solid var(--primary-color); outline-offset: -2px; background: rgba(var(--rgb-primary-color, 3,169,244), 0.12); }
.ghost { position: fixed; box-sizing: border-box; z-index: 1000; pointer-events: none; opacity: 0.92; background: var(--card-background-color, #fff);
  box-shadow: 0 6px 18px rgba(0,0,0,0.25); border-radius: 8px; }
.footer { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px 16px; border-top: 1px solid var(--divider-color); margin-top: 6px; }
.link { border: none; background: none; text-align: start; padding: 8px 0; color: var(--esp-action-color); cursor: pointer; min-height: 36px; }
.notice { font-size: var(--ha-font-size-s, 12px); line-height: 1.4; padding: 6px 8px; border-inline-start: 3px solid var(--esp-action-color);
  background: var(--secondary-background-color, rgba(127,127,127,0.08)); border-radius: 4px; }
.footer-section { display: flex; flex-direction: column; gap: 4px; }
.footer-section + .footer-section { border-top: 1px solid var(--divider-color); margin-top: 6px; padding-top: 8px; }
.footer-heading { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); font-weight: var(--ha-font-weight-medium, 500); }
.confirm { display: flex; flex-direction: column; gap: 8px; padding: 8px; border: 1px solid var(--divider-color); border-radius: 8px; line-height: 1.4; }
.btn.danger { background: var(--esp-error-color); border-color: var(--esp-error-color); color: #fff; }
.group[data-color] { border-inline-start: 4px solid var(--esp-own-line); }
.group > .row.head .icon { color: var(--esp-own-icon-color, var(--sidebar-icon-color, var(--secondary-text-color))); }
.sub { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); font-weight: var(--ha-font-weight-medium, 500); margin-top: 4px; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(32px, 1fr)); gap: 2px; }
.swatch { width: 32px; height: 32px; display: grid; place-items: center; border: none; background: none; border-radius: 50%; cursor: pointer; padding: 0; }
.swatch span { width: 22px; height: 22px; border-radius: 50%; box-sizing: border-box; background: var(--sw); border: 1px solid rgba(127,127,127,0.5); }
.swatch.none span { background: linear-gradient(135deg, transparent 45%, var(--secondary-text-color) 45% 55%, transparent 55%); }
.swatch[aria-pressed="true"] span { outline: 2px solid var(--primary-text-color); outline-offset: 2px; }
.swatch:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 0; }
.color-line { display: flex; gap: 8px; align-items: center; }
.color-line input[type="color"] { flex: none; width: 36px; height: 32px; padding: 0 2px; border: 1px solid var(--divider-color); border-radius: 6px; background: none; cursor: pointer; }
.color-line input[type="text"] { flex: 1; min-width: 0; font: inherit; color: inherit; background: transparent; border: 1px solid var(--divider-color); border-radius: 6px; padding: 6px; }
.color-line input[aria-invalid="true"] { border-color: var(--esp-error-color); }
.open-btn[aria-pressed="true"] { background: rgba(var(--rgb-primary-color, 3,169,244), 0.18); color: var(--esp-action-color); }
:host(:not([start-collapsed])) .open-btn { display: none; }
.pins { border-style: dashed; }
.pins > .row.head { cursor: default; }
.pins .head-space { flex: none; width: 32px; }
.pins .head-icon { width: 22px; height: 22px; flex: none; fill: currentColor; color: var(--sidebar-icon-color, var(--secondary-text-color)); }
.pins .count { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); padding-inline-end: 8px; font-variant-numeric: tabular-nums; }
.pins .note { padding: 4px 12px 0; }
.settings { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 4px; border-top: 1px solid var(--divider-color); margin-top: 6px; }
.check { display: flex; align-items: center; gap: 10px; min-height: 36px; cursor: pointer; line-height: 1.3; }
.check input { flex: none; width: 18px; height: 18px; margin: 0; accent-color: var(--esp-fill-color); cursor: pointer; }
.check + .note { margin: -6px 0 2px; padding-inline-start: 28px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field select { font: inherit; color: var(--primary-text-color); background: var(--card-background-color, transparent); border: 1px solid var(--divider-color);
  border-radius: 6px; min-height: 36px; padding: 0 6px; }
.check input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

class EspEditor extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = h("style");
    style.textContent = EDITOR_CSS;
    this._content = h("div");
    this._live = h("div", { class: "sr live", "aria-live": "polite" });
    root.append(style, this._content, this._live);
    this._drag = null;
    this._onMove = (e) => this._dragMove(e);
    this._onUp = (e) => this._dragEnd(e, false);
    this._onKey = (e) => {
      if (e.key === "Escape" && this._drag) this._dragEnd(e, true);
    };
    // HA's list handles arrows / Enter / Space for its own rows; keep our keys to ourselves.
    this.addEventListener("keydown", (e) => {
      if (LIST_KEYS.has(e.key)) e.stopPropagation();
    });
  }

  connectedCallback() {
    // The editor replaces the rows inside HA's panel list (role=list), which may own only list items.
    this.setAttribute("role", "listitem");
  }

  /**
   * opts: { tree, settings, hiddenSet:Set, info:Map(path→{title,icon,iconPath}), lockedVisible:Set, lang, isAdmin, own,
   * hasDefault, sameAsDefault, look:(color, iconColor)→{line, icon}, actions }
   */
  open(opts) {
    Object.assign(this, opts);
    this.error = "";
    // One inline confirmation at a time ("reset" | "setdef" | "cleardef"), a result message, and the
    // one-time note shown before a user on the default saves a change.
    this.confirming = null;
    this.status = "";
    this.notice = "";
    this.forkNoted = false;
    this.focusKey = null;
    this.iconEditing = null;
    // Group id -> what the user left in a name field that is not a valid name (shown with its error).
    this.nameErrors = new Map();
    this.render();
    requestAnimationFrame(() => this.shadowRoot.querySelector(".bar .btn")?.focus());
  }

  set(changes, focusKey) {
    Object.assign(this, changes);
    if (focusKey !== undefined) this.focusKey = focusKey;
    this.render();
  }

  announce(text) {
    this._live.textContent = "";
    setTimeout(() => (this._live.textContent = text), 50);
  }

  name(key) {
    const at = L.locate(this.tree, key);
    if (!at) return "";
    if (L.isPins(at.node)) return t(this.lang, "pinned");
    return at.node.type === "group" ? at.node.name : this.info.get(at.node.path)?.title ?? at.node.path;
  }

  _q(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  /**
   * A group's name or icon changed: update its controls in place. No re-render, so focus stays put
   * and a click that blurred the name field still lands on its button.
   */
  patchGroup(id) {
    const node = this.tree.find((n) => n.type === "group" && n.id === id);
    if (!node) return;
    const lang = this.lang;
    const label = (sel, text, title = false) => {
      const el = this._q(sel);
      if (!el) return null;
      el.setAttribute("aria-label", text);
      if (title) el.title = text;
      return el;
    };
    label(`[data-focus-key="handle:${L.groupKey(id)}"]`, t(lang, "drag", { name: node.name }), true);
    const iconBtn = label(`[data-focus-key="icon:${id}"]`, t(lang, "groupIcon", { name: node.name }));
    const headIcon = iconBtn?.querySelector(".icon");
    if (headIcon) headIcon.icon = node.icon || DEFAULT_ICON;
    label(`[data-focus-key="ungroup:${id}"]`, t(lang, "ungroup", { name: node.name }), true);
    label(`[data-focus-key="open:${id}"]`, t(lang, "startOpen", { name: node.name }), true)?.setAttribute("aria-pressed", String(node.start_open === true));
    label(`[data-children="${id}"]`, node.name);
    const pending = this.nameErrors.get(id);
    const input = this._q(`[data-focus-key="name:${id}"]`);
    if (input) {
      if (pending === undefined) {
        input.removeAttribute("aria-invalid");
        if (input.value !== node.name) input.value = node.name;
      } else input.setAttribute("aria-invalid", "true");
    }
    const nameError = this._q(`#name-err-${id}`);
    if (nameError) nameError.textContent = pending === undefined ? "" : t(lang, "nameRequired");
    const preview = this._q(`[data-preview="${id}"]`);
    if (preview) preview.icon = node.icon || DEFAULT_ICON;
    const picker = this._q(`[data-focus-key="picker:${id}"]`);
    if (picker) {
      picker.removeAttribute("aria-invalid");
      if (picker.value.trim() !== (node.icon || "")) picker.value = node.icon || "";
      const iconError = this._q(`#icon-err-${id}`);
      if (iconError) iconError.textContent = "";
    }
    for (const chip of this.shadowRoot.querySelectorAll(`[data-focus-key^="chip:${id}:"]`))
      chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-label") === node.icon));
  }

  /** A panel's hidden state changed: update its row in place. */
  patchRow(path) {
    const row = this._q(`.row[data-key="${CSS.escape(L.panelKey(path))}"]`);
    const eye = row?.querySelector(".eye");
    if (!eye || this.lockedVisible.has(path)) return;
    const hidden = this.hiddenSet.has(path);
    const text = t(this.lang, hidden ? "show" : "hide", { name: this.info.get(path)?.title ?? path });
    row.classList.toggle("hidden", hidden);
    eye.setAttribute("aria-pressed", String(hidden));
    eye.setAttribute("aria-label", text);
    eye.title = text;
    eye.replaceChildren(svg(hidden ? ICONS.eyeOff : ICONS.eye));
  }

  /** A name field holds an invalid name: focus it and say so. Returns whether one did. */
  focusInvalidName() {
    const id = this.nameErrors.keys().next().value;
    if (id === undefined) return false;
    const input = this._q(`[data-focus-key="name:${id}"]`);
    input?.focus();
    const nameError = this._q(`#name-err-${id}`);
    if (nameError) {
      nameError.textContent = "";
      setTimeout(() => (nameError.textContent = t(this.lang, "nameRequired")), 50);
    }
    return true;
  }

  render() {
    const lang = this.lang;
    const root = this.shadowRoot;
    // Titles take their own direction (dir=auto, so a long English title shows its start) but keep
    // the page's alignment. HA sets the page direction on <html dir>.
    this.toggleAttribute("rtl", (document.documentElement.dir || getComputedStyle(document.documentElement).direction) === "rtl");
    this.toggleAttribute("start-collapsed", !!this.settings?.start_collapsed);
    const active = root.activeElement;
    const focusKey = this.focusKey ?? active?.dataset?.focusKey ?? null;
    for (const id of [...this.nameErrors.keys()]) if (!this.tree.some((n) => n.type === "group" && n.id === id)) this.nameErrors.delete(id);

    const bar = h(
      "div",
      { class: "bar" },
      h("div", { class: "bar-title", id: "esp-title" }, t(lang, "editing")),
      h(
        "div",
        { class: "bar-buttons" },
        h("button", { class: "btn primary", type: "button", "data-focus-key": "done", onclick: () => this.actions.done() }, t(lang, "done")),
        h("button", { class: "btn", type: "button", "data-focus-key": "cancel", onclick: () => this.actions.cancel() }, t(lang, "cancel")),
      ),
      !this.own && this.hasDefault ? h("div", { class: "note" }, t(lang, "onDefault")) : null,
      h("div", { class: "note" }, t(lang, "hint")),
      this.notice ? h("div", { class: "notice", role: "alert" }, this.notice) : null,
      this.status ? h("div", { class: "notice", role: "status" }, this.status) : null,
      this.error ? h("div", { class: "error", role: "alert" }, this.error) : null,
    );

    const add = h(
      "button",
      { class: "add", type: "button", "data-focus-key": "add", onclick: () => this.actions.addGroup() },
      svg(ICONS.plus),
      t(lang, "addGroup"),
    );
    const list = h("div", { class: "list", role: "list", "aria-labelledby": "esp-title" });
    for (const node of this.tree) {
      if (L.isPins(node)) list.append(this.pinsBlock(node));
      else if (node.type === "group") list.append(this.groupBlock(node));
      else if (!node.missing) list.append(h("div", { class: "top", role: "listitem" }, this.panelRow(node, null)));
    }
    const settings = this.settingsBlock();

    // Footer actions commit at once and Cancel cannot undo them: each asks first, inline.
    const action = (kind, label, ask, ok, run, danger) => {
      if (this.confirming !== kind)
        return h("button", { class: "link", type: "button", "data-focus-key": kind, onclick: () => this.set({ confirming: kind, status: "" }, `no:${kind}`) }, label);
      return h(
        "div",
        { class: "confirm", role: "group", "aria-labelledby": `ask-${kind}` },
        h("div", { id: `ask-${kind}` }, ask),
        h(
          "div",
          { class: "bar-buttons" },
          h("button", { class: `btn ${danger ? "danger" : "primary"}`, type: "button", "data-focus-key": `ok:${kind}`, onclick: run }, ok),
          h("button", { class: "btn", type: "button", "data-focus-key": `no:${kind}`, onclick: () => this.set({ confirming: null }, kind) }, t(lang, "cancel")),
        ),
      );
    };
    const footer = h("div", { class: "footer" });
    if (this.own && this.hasDefault && !this.sameAsDefault)
      footer.append(
        h("div", { class: "footer-section" }, action("reset", t(lang, "reset"), t(lang, "resetAsk"), t(lang, "resetOk"), () => this.actions.reset(), true)),
      );
    // Without a default there is nothing to reset to but Home Assistant's own sidebar.
    if (this.own && !this.hasDefault)
      footer.append(
        h(
          "div",
          { class: "footer-section" },
          action("plain", t(lang, "resetPlain"), t(lang, "resetPlainAsk"), t(lang, "resetPlainOk"), () => this.actions.resetPlain(), true),
        ),
      );
    if (this.isAdmin)
      footer.append(
        h(
          "div",
          { class: "footer-section", role: "group", "aria-labelledby": "esp-everyone" },
          h("div", { class: "footer-heading", id: "esp-everyone" }, t(lang, "forEveryone")),
          action("setdef", t(lang, "setDefault"), t(lang, "setDefaultAsk"), t(lang, "setDefaultOk"), () => this.actions.setDefault()),
          this.hasDefault
            ? action("cleardef", t(lang, "clearDefault"), t(lang, "clearDefaultAsk"), t(lang, "clearDefaultOk"), () => this.actions.clearDefault(), true)
            : null,
        ),
      );

    this._content.replaceChildren(bar, add, list, settings, footer.childElementCount ? footer : "");

    if (focusKey) {
      const el = root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
      if (el) el.focus();
      this.focusKey = null;
    }
  }

  groupBlock(node) {
    const lang = this.lang;
    const key = L.groupKey(node.id);
    const pending = this.nameErrors.get(node.id);
    // Enter commits in place and keeps focus here; blur commits through `change`. Neither re-renders.
    const input = h("input", {
      class: "name-input",
      type: "text",
      maxlength: String(L.MAX_NAME),
      "aria-label": t(lang, "groupName"),
      "aria-describedby": `name-err-${node.id}`,
      "aria-invalid": pending === undefined ? null : "true",
      "data-focus-key": `name:${node.id}`,
      ".value": pending ?? node.name,
      onchange: (e) => this.actions.rename(node.id, e.target),
      onkeydown: (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        this.actions.rename(node.id, e.target);
      },
    });
    const head = h(
      "div",
      { class: "row head", "data-key": key },
      this.handle(key, node.name),
      h(
        "button",
        {
          class: "icon-btn",
          type: "button",
          "aria-label": t(lang, "groupIcon", { name: node.name }),
          "aria-expanded": String(this.iconEditing === node.id),
          "data-focus-key": `icon:${node.id}`,
          onclick: () => this.set({ iconEditing: this.iconEditing === node.id ? null : node.id }, `icon:${node.id}`),
        },
        iconEl(node.icon || DEFAULT_ICON),
      ),
      input,
      // "Starts open" matters only while groups start collapsed: shown with that setting (host attribute).
      h(
        "button",
        {
          class: "icon-btn open-btn",
          type: "button",
          "aria-pressed": String(node.start_open === true),
          "aria-label": t(lang, "startOpen", { name: node.name }),
          title: t(lang, "startOpen", { name: node.name }),
          "data-focus-key": `open:${node.id}`,
          onclick: () => this.actions.setStartOpen(node.id, node.start_open !== true),
        },
        svg(ICONS.folderOpen),
      ),
      h(
        "button",
        {
          class: "icon-btn",
          type: "button",
          "aria-label": t(lang, "ungroup", { name: node.name }),
          title: t(lang, "ungroup", { name: node.name }),
          "data-focus-key": `ungroup:${node.id}`,
          onclick: () => this.actions.ungroup(node.id),
        },
        svg(ICONS.ungroup),
      ),
    );
    const nameError = h(
      "div",
      { class: "error field-error", id: `name-err-${node.id}`, role: "alert" },
      pending === undefined ? null : t(lang, "nameRequired"),
    );
    const block = h("div", { class: "group", role: "listitem", "data-block": key }, head, nameError);
    this.paintGroup(block, node);
    if (this.iconEditing === node.id) block.append(this.iconEditor(node));
    const kids = h("div", { class: "children", role: "list", "aria-label": node.name, "data-children": node.id });
    const shown = node.children.filter((c) => !c.missing);
    for (const c of shown) kids.append(h("div", { role: "listitem" }, this.panelRow(c, node.id)));
    if (!shown.length) kids.append(h("div", { class: "empty", role: "listitem", "data-empty": node.id }, t(lang, "empty")));
    block.append(kids);
    return block;
  }

  iconEditor(node) {
    const lang = this.lang;
    const preview = iconEl(node.icon || DEFAULT_ICON);
    preview.setAttribute("data-preview", node.id);
    const error = h("div", { class: "error", id: `icon-err-${node.id}`, role: "alert" });
    const apply = (value) => {
      const icon = value.trim() || null;
      if (icon !== null && !L.validIcon(icon)) {
        input.setAttribute("aria-invalid", "true");
        error.textContent = t(lang, "iconInvalid");
        return;
      }
      this.actions.setIcon(node.id, icon);
    };
    const input = h("input", {
      type: "text",
      dir: "ltr",
      spellcheck: "false",
      autocomplete: "off",
      ".value": node.icon || "",
      placeholder: "mdi:home",
      "aria-label": t(lang, "iconHelp"),
      "aria-describedby": `icon-err-${node.id}`,
      "data-focus-key": `picker:${node.id}`,
      oninput: (e) => {
        e.target.removeAttribute("aria-invalid");
        error.textContent = "";
        if (L.validIcon(e.target.value.trim())) preview.icon = e.target.value.trim();
      },
      onchange: (e) => apply(e.target.value),
      onkeydown: (e) => {
        if (e.key === "Enter") apply(e.target.value);
      },
    });
    const chips = h(
      "div",
      { class: "chips" },
      SUGGESTED_ICONS.map((icon) =>
        h(
          "button",
          {
            class: "icon-btn chip",
            type: "button",
            "aria-label": icon,
            title: icon,
            "aria-pressed": String(node.icon === icon),
            "data-focus-key": `chip:${node.id}:${icon}`,
            onclick: () => this.actions.setIcon(node.id, icon),
          },
          iconEl(icon),
        ),
      ),
    );
    return h(
      "div",
      { class: "icon-edit" },
      h("div", { class: "icon-line" }, preview, input),
      error,
      chips,
      this.colorPicker(node, "color", "color"),
      this.colorPicker(node, "icon_color", "iconColor"),
    );
  }

  /** The group block shows its colour as a bar at the inline start; the head icon takes the icon colour. */
  paintGroup(block, node) {
    const look = this.look?.(node.color, node.icon_color) ?? null;
    block.toggleAttribute("data-color", !!look?.line);
    setVar(block, "--esp-own-line", look?.line);
    setVar(block, "--esp-own-icon-color", look?.icon);
  }

  /** Swatches (none + theme colours), a native colour input and a `#rrggbb` field for one colour of a group. */
  colorPicker(node, field, labelKey) {
    const lang = this.lang;
    const id = node.id;
    const labelId = `${field}-label-${id}`;
    const errId = `${field}-err-${id}`;
    const value = node[field] ?? null;
    const swatch = (color) =>
      h(
        "button",
        {
          class: `swatch${color === null ? " none" : ""}`,
          type: "button",
          "aria-label": color === null ? t(lang, "noColor") : t(lang, `c_${color}`),
          title: color === null ? t(lang, "noColor") : t(lang, `c_${color}`),
          "aria-pressed": String(value === color),
          "data-swatch": `${field}:${id}`,
          "data-color": color ?? "",
          "data-focus-key": `sw:${field}:${id}:${color ?? "none"}`,
          onclick: () => this.actions.setColor(id, field, color),
        },
        h("span", { style: color === null ? null : `--sw: ${L.colorCss(color)}` }),
      );
    const error = h("div", { class: "error", id: errId, role: "alert" });
    const native = h("input", {
      type: "color",
      "aria-label": `${t(lang, "pickColor")}: ${t(lang, labelKey)}`,
      "data-native": `${field}:${id}`,
      ".value": (value?.startsWith("#") ? value : this.hexOf?.(value)) ?? "#000000",
      oninput: (e) => this.actions.setColor(id, field, L.normalizeColor(e.target.value) ?? null),
    });
    const apply = (input) => {
      const color = L.normalizeColor(input.value);
      if (color === undefined) {
        input.setAttribute("aria-invalid", "true");
        error.textContent = t(lang, "colorInvalid");
        return;
      }
      this.actions.setColor(id, field, color);
    };
    const text = h("input", {
      type: "text",
      dir: "ltr",
      spellcheck: "false",
      autocomplete: "off",
      maxlength: "16",
      placeholder: "#4caf50",
      "aria-label": `${t(lang, labelKey)}: ${t(lang, "customColor")}`,
      "aria-describedby": errId,
      "data-hex": `${field}:${id}`,
      "data-focus-key": `hex:${field}:${id}`,
      ".value": value ?? "",
      oninput: (e) => {
        e.target.removeAttribute("aria-invalid");
        error.textContent = "";
      },
      onchange: (e) => apply(e.target),
      onkeydown: (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        apply(e.target);
      },
    });
    return h(
      "div",
      { class: "color-section", role: "group", "aria-labelledby": labelId },
      h("div", { class: "sub", id: labelId }, t(lang, labelKey)),
      h("div", { class: "swatches" }, swatch(null), L.NAMED_COLORS.map(swatch)),
      h("div", { class: "color-line" }, native, text),
      error,
    );
  }

  /** A group's colours changed: update its swatches, fields and preview in place (focus stays put). */
  patchColors(id) {
    const node = this.tree.find((n) => n.type === "group" && n.id === id);
    if (!node) return;
    const block = this._q(`[data-block="${CSS.escape(L.groupKey(id))}"]`);
    if (block) this.paintGroup(block, node);
    for (const field of ["color", "icon_color"]) {
      const value = node[field] ?? null;
      for (const sw of this.shadowRoot.querySelectorAll(`[data-swatch="${field}:${id}"]`))
        sw.setAttribute("aria-pressed", String((sw.dataset.color || null) === value));
      const text = this._q(`[data-hex="${field}:${id}"]`);
      if (text) {
        text.removeAttribute("aria-invalid");
        if (text.value.trim() !== (value ?? "")) text.value = value ?? "";
        const error = this._q(`#${field}-err-${id}`);
        if (error) error.textContent = "";
      }
      const native = this._q(`[data-native="${field}:${id}"]`);
      const hex = value?.startsWith("#") ? value : this.hexOf?.(value);
      if (native && hex && native.value !== hex) native.value = hex;
    }
  }

  /** The pinned area: a drop zone like a group, without handle, name or ungroup. Always last. */
  pinsBlock(node) {
    const lang = this.lang;
    const key = L.PINS_KEY;
    const shown = node.children.filter((c) => !c.missing);
    const full = L.pinsFull(this.tree);
    const head = h(
      "div",
      { class: "row head", "data-key": key },
      h("span", { class: "head-space" }),
      svg(ICONS.pin, "head-icon"),
      h("span", { class: "title", id: "esp-pins-title" }, t(lang, "pinned")),
      h("span", { class: "count" }, t(lang, "pinnedCount", { n: node.children.length, max: L.MAX_PINNED })),
    );
    const note = h("div", { class: "note" }, full ? t(lang, "pinnedFull", { max: L.MAX_PINNED }) : t(lang, "pinnedHelp"));
    const kids = h("div", { class: "children", role: "list", "aria-labelledby": "esp-pins-title", "data-children": L.PINS_ID });
    for (const c of shown) kids.append(h("div", { role: "listitem" }, this.panelRow(c, L.PINS_ID)));
    if (!shown.length) kids.append(h("div", { class: "empty", role: "listitem", "data-empty": L.PINS_ID }, t(lang, "empty")));
    return h("div", { class: "group pins", role: "listitem", "data-block": key }, head, note, kids);
  }

  /** Display and collapse settings. Native controls keep their own state: a change re-renders nothing. */
  settingsBlock() {
    const lang = this.lang;
    const s = this.settings ?? L.DEFAULT_SETTINGS;
    const check = (key, label, help = null) => [
      h(
        "label",
        { class: "check" },
        h("input", {
          type: "checkbox",
          "data-focus-key": `set:${key}`,
          ".checked": !!s[key],
          onchange: (e) => this.actions.setting(key, e.target.checked),
        }),
        h("span", {}, t(lang, label)),
      ),
      help ? h("div", { class: "note" }, t(lang, help)) : null,
    ];
    const select = (key, label, options) =>
      h(
        "label",
        { class: "field" },
        h("span", {}, t(lang, label)),
        h(
          "select",
          { "data-focus-key": `set:${key}`, onchange: (e) => this.actions.setting(key, e.target.value) },
          options.map((o) => h("option", { value: o, ".selected": s[key] === o }, t(lang, `${key}_${o}`))),
        ),
      );
    return h(
      "div",
      { class: "settings", role: "group", "aria-labelledby": "esp-display" },
      h("div", { class: "footer-heading", id: "esp-display" }, t(lang, "display")),
      check("start_collapsed", "startCollapsed", "startCollapsedHelp"),
      check("accordion", "accordion"),
      check("toggle_all", "toggleAllOption"),
      select("header", "headerStyle", L.HEADER_STYLES),
      select("divider", "dividerStyle", L.DIVIDER_STYLES),
    );
  }

  panelRow(node, groupId) {
    const lang = this.lang;
    const key = L.panelKey(node.path);
    const info = this.info.get(node.path) ?? { title: node.path, icon: null };
    const hidden = this.hiddenSet.has(node.path);
    const locked = this.lockedVisible.has(node.path);
    // The default dashboard cannot be hidden (HA rule): the eye stays focusable and says why.
    const eyeLabel = locked ? t(lang, "alwaysShown", { name: info.title }) : t(lang, hidden ? "show" : "hide", { name: info.title });
    return h(
      "div",
      { class: `row${hidden ? " hidden" : ""}`, "data-key": key, "data-group": groupId ?? "" },
      this.handle(key, info.title),
      iconEl(info.icon, info.iconPath),
      h("span", { class: "title", dir: "auto" }, info.title),
      h("span", { class: "merge-label", "aria-hidden": "true" }),
      h(
        "button",
        {
          class: "icon-btn eye",
          type: "button",
          "aria-pressed": locked ? null : String(hidden),
          "aria-label": eyeLabel,
          title: eyeLabel,
          "aria-disabled": locked ? "true" : null,
          "data-focus-key": `eye:${node.path}`,
          onclick: () => {
            if (!locked) this.actions.toggleHidden(node.path);
          },
        },
        svg(hidden ? ICONS.eyeOff : ICONS.eye),
      ),
    );
  }

  handle(key, label) {
    return h(
      "button",
      {
        class: "handle",
        type: "button",
        "aria-label": t(this.lang, "drag", { name: label }),
        title: t(this.lang, "drag", { name: label }),
        "data-focus-key": `handle:${key}`,
        onpointerdown: (e) => this._dragStart(e, key),
        onkeydown: (e) => {
          if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
          e.preventDefault();
          e.stopPropagation();
          this.actions.moveBy(key, e.key === "ArrowUp" ? -1 : 1);
        },
      },
      svg(ICONS.drag),
    );
  }

  /* ---------------- drag and drop (pointer events: mouse, touch, pen) */

  _dragStart(e, key) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const row = e.currentTarget.closest(".row");
    const block = key.startsWith("g:") ? row.closest(".group") : row;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    this._drag = { key, startX: e.clientX, startY: e.clientY, block, ghost: null, target: null, started: false, pointerId: e.pointerId };
    window.addEventListener("pointermove", this._onMove);
    window.addEventListener("pointerup", this._onUp);
    window.addEventListener("pointercancel", this._onUp);
    window.addEventListener("keydown", this._onKey, true);
  }

  _dragMove(e) {
    const d = this._drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      d.started = true;
      // The ghost sits beside the pointer, not under it: the row being dropped onto stays visible.
      // It is indented toward the inline end and never wider than the row, so it stays in the sidebar.
      const rect = d.block.getBoundingClientRect();
      const inset = Math.min(GHOST_INSET, rect.width / 4);
      const rtl = getComputedStyle(this).direction === "rtl";
      d.ghost = d.block.cloneNode(true);
      d.ghost.classList.add("ghost");
      d.ghost.style.width = `${rect.width - inset}px`;
      d.ghost.style.left = `${rtl ? rect.left : rect.left + inset}px`;
      this.shadowRoot.append(d.ghost);
      d.ghostHeight = d.ghost.getBoundingClientRect().height;
      d.block.classList.add("dragging");
      d.scroller = this._scroller();
      this._autoScroll();
    }
    d.lastY = e.clientY;
    d.lastX = e.clientX;
    const below = e.clientY + GHOST_GAP;
    d.ghost.style.top = `${below + d.ghostHeight > window.innerHeight ? e.clientY - GHOST_GAP - d.ghostHeight : below}px`;
    this._updateTarget(e.clientX, e.clientY);
  }

  _updateTarget(x, y) {
    const d = this._drag;
    this._clearMarks();
    // What is marked is what a release does: every path that marks nothing leaves no target.
    d.target = null;
    const box = this.getBoundingClientRect();
    if (x < box.left || x > box.right) return;
    const hit = this.shadowRoot.elementFromPoint(x, y);
    const dragGroup = d.key.startsWith("g:");
    // The pinned area takes panels only (up to its limit); a group dropped on it lands right above it.
    const pinsBlock = this._q(`[data-block="${CSS.escape(L.PINS_KEY)}"]`);
    if (dragGroup && pinsBlock && (pinsBlock.contains(hit) && !hit.closest(".row[data-key]"))) {
      pinsBlock.classList.add("drop-before");
      d.target = { key: L.PINS_KEY, zone: "before" };
      return;
    }
    const empty = hit?.closest?.("[data-empty]");
    if (empty) {
      // An empty group's "Drop items here": a panel goes into it; a group lands before or after it.
      const block = empty.closest(".group");
      if (!block || d.block.contains(empty)) return;
      const targetKey = L.groupKey(empty.dataset.empty);
      if (dragGroup) {
        const r = block.getBoundingClientRect();
        const zone = y < r.top + r.height / 2 ? "before" : "after";
        block.classList.add(zone === "before" ? "drop-before" : "drop-after");
        d.target = { key: targetKey, zone };
      } else {
        empty.classList.add("drop-into");
        d.target = { key: targetKey, zone: "into" };
      }
      return;
    }
    let row = hit?.closest?.(".row[data-key]");
    if (!row) {
      const rows = [...this.shadowRoot.querySelectorAll(".row[data-key]")].filter((r) => !d.block.contains(r));
      if (!rows.length) return;
      const first = rows[0].getBoundingClientRect();
      const last = rows[rows.length - 1].getBoundingClientRect();
      if (y < first.top) row = rows[0];
      else if (y > last.bottom) row = rows[rows.length - 1];
      else return;
    }
    if (d.block.contains(row)) return;
    const targetKey = row.dataset.key;
    const r = row.getBoundingClientRect();
    const rel = (y - r.top) / r.height;
    if (pinsBlock?.contains(row)) {
      if (dragGroup) {
        pinsBlock.classList.add("drop-before");
        d.target = { key: L.PINS_KEY, zone: "before" };
        return;
      }
      const fromPins = L.locate(this.tree, d.key)?.group === L.PINS_ID;
      if (L.pinsFull(this.tree) && !fromPins && !(targetKey === L.PINS_KEY && rel < 0.3)) return;
    }
    const targetGroup = targetKey.startsWith("g:");
    const inGroup = !!row.dataset.group;
    let zone;
    if (dragGroup) zone = rel < 0.5 ? "before" : "after";
    else if (targetGroup) zone = rel < 0.3 ? "before" : "into";
    else if (rel < 0.3) zone = "before";
    else if (rel > 0.7) zone = "after";
    else zone = inGroup ? "after" : "merge";
    let mark = row;
    if (dragGroup && (inGroup || targetGroup)) mark = row.closest(".group") ?? row;
    mark.classList.add(zone === "before" ? "drop-before" : zone === "after" ? "drop-after" : "drop-into");
    if (zone === "merge") {
      // Say what a release here does, on the target row itself.
      const label = row.querySelector(".merge-label");
      if (label) {
        label.replaceChildren(t(this.lang, "mergeLabel", { name: "" }), h("bdi", {}, this.name(targetKey)));
        row.classList.add("merge");
      }
    }
    d.target = { key: targetKey, zone };
  }

  _clearMarks() {
    for (const el of this.shadowRoot.querySelectorAll(".drop-before, .drop-after, .drop-into, .merge"))
      el.classList.remove("drop-before", "drop-after", "drop-into", "merge");
  }

  _scroller() {
    const nav = this.closest("ha-list-nav");
    const candidates = [nav?.shadowRoot?.querySelector(".base"), nav, this.parentElement].filter(Boolean);
    return candidates.find((el) => el.scrollHeight > el.clientHeight + 2) ?? null;
  }

  _autoScroll() {
    const d = this._drag;
    if (!d?.started) return;
    if (d.scroller && d.lastY !== undefined) {
      const r = d.scroller.getBoundingClientRect();
      const edge = 48;
      let dy = 0;
      if (d.lastY < r.top + edge) dy = -Math.ceil((r.top + edge - d.lastY) / 4);
      else if (d.lastY > r.bottom - edge) dy = Math.ceil((d.lastY - (r.bottom - edge)) / 4);
      if (dy) {
        d.scroller.scrollTop += dy;
        this._updateTarget(d.lastX, d.lastY);
      }
    }
    d.raf = requestAnimationFrame(() => this._autoScroll());
  }

  _dragEnd(e, cancelled) {
    const d = this._drag;
    if (!d) return;
    this._drag = null;
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onUp);
    window.removeEventListener("keydown", this._onKey, true);
    cancelAnimationFrame(d.raf);
    d.ghost?.remove();
    d.block.classList.remove("dragging");
    this._clearMarks();
    if (cancelled) e.preventDefault?.();
    if (cancelled || !d.started || !d.target || e.type === "pointercancel") return;
    this.actions.drop(d.key, d.target.key, d.target.zone);
  }
}

customElements.get("esp-group") || customElements.define("esp-group", EspGroup);
customElements.get("esp-editor") || customElements.define("esp-editor", EspEditor);

/* ------------------------------------------------------------------ controller (one per ha-sidebar) */

const SIDEBAR_CSS = `
.esp-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.esp-probe { position: absolute; width: 0; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
:host([expanded]) ha-list-item-button[data-esp-group] { margin-inline-start: 18px; width: calc(var(--ha-sidebar-expanded-item-width, 248px) - 14px); }
:host([narrow][expanded]) ha-list-item-button[data-esp-group] { width: calc(226px - var(--safe-area-inset-left, 0px)); }
:host([expanded]) ha-list-item-button[data-esp-group]::after { content: ""; position: absolute; inset-block: 0 -4px; inset-inline-start: -8px;
  width: var(--esp-group-divider-width, 2px); background: var(--esp-own-line, var(--esp-group-divider-color, var(--divider-color))); pointer-events: none; }
:host([expanded]) ha-list-item-button[data-esp-last]::after { inset-block-end: 6px; border-end-end-radius: 1px; border-end-start-radius: 1px; }
:host([data-esp-divider="none"]) ha-list-item-button[data-esp-group]::after { display: none; }
ha-list-item-button[data-esp-group]:not(.selected) ha-icon[slot="start"],
ha-list-item-button[data-esp-group]:not(.selected) ha-svg-icon[slot="start"] { color: var(--esp-own-icon-color, var(--sidebar-icon-color)); }
/* Four icons per row: 4 x (cell + 8 px margins) stays inside the list, which is 1 px narrower than the sidebar (its border). */
:host([expanded]) ha-list-item-button[data-esp-pin] { width: calc((var(--ha-sidebar-expanded-item-width, 248px) - 28px) / 4); --ha-row-item-padding-inline: 15px; }
:host([narrow][expanded]) ha-list-item-button[data-esp-pin] { width: calc((240px - var(--safe-area-inset-left, 0px) - 28px) / 4); --ha-row-item-padding-inline: 14px; }
:host([expanded]) ha-list-item-button[data-esp-pin] .item-text { max-width: 0; opacity: 0; }
/* The title's own text sets its direction, so a Latin name in a Hebrew UI is cut at its end (UX-009);
   it stays aligned to the header's side, as without the isolation ("start" would follow the text). */
.menu .title { overflow: hidden; text-overflow: ellipsis; unicode-bidi: plaintext; text-align: left; }
:host(:dir(rtl)) .menu .title { text-align: right; }
.esp-btn { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border: none; background: none; padding: 0;
  border-radius: 50%; cursor: pointer; color: var(--sidebar-icon-color, var(--secondary-text-color)); }
.esp-edit { margin-inline: auto 4px; }
.esp-all { margin-inline-start: auto; }
.esp-all:not([hidden]) + .esp-edit { margin-inline-start: 0; }
.esp-btn[hidden] { display: none; }
.esp-btn:hover { background: rgba(127,127,127,0.15); }
.esp-btn:focus-visible { outline: 2px solid var(--primary-color); }
.esp-btn svg { width: 20px; height: 20px; fill: currentColor; }
:host(:not([expanded])) .esp-btn { display: none; }
`;
let sidebarSheet = null;
let navSheet = null;

class Controller {
  constructor(sb) {
    this.sb = sb;
    this.data = null;
    this.editing = false;
    this.dirty = false;
    this.groupEls = new Map();
    this.rowGroups = new Map();
    this.groupNames = new Map();
    this.descIds = new Map();
    this.descEls = new Map();
    this.lastInGroup = new Set();
    this.unsub = null;
    this.subscribing = false;
    this.editor = null;
    this.collapseTimer = null;
    this.failed = false;
    // HA's native sidebar order (frontend user data), followed when it changes outside our editor.
    this.nativeUnsub = null;
    this.nativeSubscribing = false;
    this.nativeSig = undefined;
    this.writtenSig = null;
    // "Groups start collapsed": folding lives in this page only (null = the stored state is used).
    this.session = null;
    this.sessionInitial = false;
    this.seenData = false;
    // Pinned panels (bottom grid): HA's own rows rendered by the _renderFixedPanels patch.
    this.pinPanels = [];
    this.pinPaths = [];
    this.groupLooks = new Map();
    this.settings = { ...L.DEFAULT_SETTINGS };
    this.pal = null;
    this.keyedNavs = new WeakSet();
    // Until our layout arrives, show an empty list rather than flashing the flat one.
    this.holdUntil = Date.now() + HOLD_MS;
    this.holdTimer = setTimeout(() => this.refresh(), HOLD_MS);
  }

  get holding() {
    return !this.data && !this.failed && Date.now() < this.holdUntil;
  }

  get hass() {
    return this.sb.hass;
  }

  get lang() {
    return langOf(this.hass);
  }

  connect() {
    this.connectNative();
    if (this.unsub || this.subscribing || !this.hass?.connection) return;
    this.subscribing = true;
    this.hass.connection
      .subscribeMessage((msg) => this.onData(msg), { type: `${DOMAIN}/subscribe` })
      .then(
        (unsub) => {
          this.unsub = unsub;
          this.subscribing = false;
        },
        () => {
          this.subscribing = false;
          this.failed = true;
          this.refresh();
        },
      );
  }

  /** HA's own sidebar user data, through HA's public websocket command. Without it nothing is adopted. */
  connectNative() {
    if (this.nativeUnsub || this.nativeSubscribing || !this.hass?.connection) return;
    this.nativeSubscribing = true;
    this.hass.connection
      .subscribeMessage((msg) => this.onNative(msg?.value), { type: "frontend/subscribe_user_data", key: "sidebar" })
      .then(
        (unsub) => {
          this.nativeUnsub = unsub;
          this.nativeSubscribing = false;
        },
        () => {
          this.nativeSubscribing = false;
        },
      );
  }

  disconnect() {
    this.unsub?.();
    this.unsub = null;
    this.nativeUnsub?.();
    this.nativeUnsub = null;
    this.nativeSig = undefined;
    clearTimeout(this.adoptTimer);
  }

  onData(data) {
    clearTimeout(this.holdTimer);
    this.data = data;
    this.serverLayout = data.layout;
    // On a page load every group starts folded except those marked "starts open" (worked out at the
    // first render, when the visible panels are known); turned on later in this page, the current state is kept.
    if (L.cleanSettings(data.layout?.settings).start_collapsed) {
      if (this.session === null) {
        this.session = this.seenData ? [...(data.collapsed ?? [])] : Object.keys(data.layout?.groups ?? {});
        this.sessionInitial = !this.seenData;
      }
    } else {
      this.session = null;
      this.sessionInitial = false;
    }
    this.seenData = true;
    if (this.editor && this.editing)
      this.editor.set({ isAdmin: data.is_admin, own: data.own, hasDefault: !!data.default, sameAsDefault: this.sameAsDefault() });
    this.refresh();
  }

  sameAsDefault() {
    return !!this.data?.own && !!this.data.default && JSON.stringify(this.data.layout) === JSON.stringify(this.data.default);
  }

  /**
   * HA's panelOrder changed. The first value is only the baseline (a page load never re-sorts).
   * Our own writes are skipped by signature, and adopting a matching order is a no-op anyway, so a
   * save cannot loop. Every open browser of the user computes the same layout from the same inputs;
   * the save makes it stick for devices that open later.
   */
  onNative(value) {
    const order = Array.isArray(value?.panelOrder) ? value.panelOrder : null;
    const sig = JSON.stringify(order);
    const first = this.nativeSig === undefined;
    const prev = this.nativeSig;
    this.nativeSig = sig;
    const ours = sig === this.writtenSig;
    if (ours) this.writtenSig = null;
    if (first || ours || sig === prev || !order) return;
    // While editing, Done writes the editor's order over it.
    if (this.editing || !this.data?.layout) return;
    const layout = L.adoptOrder(this.data.layout, order);
    if (!layout) return;
    this.data = { ...this.data, layout };
    this.refresh();
    // Every open browser of the user sees the same change. After a short random wait the first save
    // has reached the others, which then find nothing left to adopt in the server's layout.
    clearTimeout(this.adoptTimer);
    this.adoptTimer = setTimeout(() => {
      if (this.nativeSig !== sig || this.editing) return;
      const next = L.adoptOrder(this.serverLayout, order);
      if (!next) return;
      const forks = !this.data?.own && !!this.data?.default;
      this.hass
        .callWS({ type: `${DOMAIN}/save`, layout: next })
        .then(() => forks && this.notifyForked(), () => {});
    }, Math.random() * ADOPT_SPREAD_MS);
  }

  refresh() {
    this.dirty = true;
    this.sb.requestUpdate();
  }

  /** The folded group ids in effect: this page's own while "start collapsed" is on, the stored ones otherwise. */
  get collapsed() {
    return this.session ?? this.data?.collapsed ?? [];
  }

  /** The layout to draw. Without HA's fixed-panel renderer (feature detection) pinned panels stay in the list. */
  viewLayout() {
    const layout = this.data?.layout;
    return layout && !gridSupported ? { ...layout, grid: [] } : layout;
  }

  render(panels, selected, orig) {
    if (!panels.length) return orig.call(this.sb, panels, selected);
    this.pinPanels = [];
    this.pinPaths = [];
    if (this.editing) return [this.editor];
    const byPath = new Map(panels.map((p) => [p.url_path, p]));
    const layout = this.viewLayout();
    const visible = [...byPath.keys()];
    this.settings = L.cleanSettings(layout?.settings);
    if (this.sessionInitial && this.session !== null) {
      this.session = L.initialCollapsed(layout, visible, this.settings.accordion);
      this.sessionInitial = false;
    }
    this.pinPaths = L.pinned(layout, visible);
    this.pinPanels = this.pinPaths.map((p) => byPath.get(p));
    const rows = L.arrange(layout, visible, this.collapsed, selected);
    this.rowGroups = new Map(rows.filter((r) => r.type === "panel").map((r) => [r.path, r.group]));
    this.groupNames = new Map(rows.filter((r) => r.type === "group").map((r) => [r.id, r.name]));
    this.groupLooks = new Map(rows.filter((r) => r.type === "group").map((r) => [r.id, this.look(r.color, r.icon_color, this.settings.header)]));
    this.lastInGroup = new Set(rows.filter((r) => r.type === "panel" && r.last).map((r) => r.path));
    // HA reflects `expanded` from `alwaysExpand` in updated(), i.e. after this render: read the property.
    const iconOnly = typeof this.sb.alwaysExpand === "boolean" ? !this.sb.alwaysExpand : !this.sb.hasAttribute("expanded");
    // HA sets the page direction on <html dir>; reading it avoids a style recalculation per render.
    const dir = document.documentElement.dir;
    const rtl = dir ? dir === "rtl" : getComputedStyle(this.sb).direction === "rtl";
    const used = new Set();
    const out = rows.map((r) => {
      if (r.type === "panel") return this.sb._renderPanel(byPath.get(r.path), r.path === selected);
      used.add(r.id);
      let el = this.groupEls.get(r.id);
      if (!el) {
        el = document.createElement("esp-group");
        this.groupEls.set(r.id, el);
      }
      el.onToggle = () => this.toggle(r.id);
      el.update(r, this.lang, iconOnly, rtl, this.groupLooks.get(r.id), this.settings.header);
      return el;
    });
    for (const id of [...this.groupEls.keys()]) if (!used.has(id)) this.groupEls.delete(id);
    return out;
  }

  /**
   * Pinned panels for the fixed (bottom) list: HA's own rows, so icons, selection, tooltips and HA's
   * keyboard handling are native. HA draws a row's tooltip only for the icon-only sidebar; in the
   * expanded one the pinned rows show icons only, so they are rendered as if icon-only.
   */
  renderPins(selected) {
    if (this.editing || !this.data || !this.pinPanels.length) return [];
    const sb = this.sb;
    let self = sb;
    if (sb.alwaysExpand) {
      try {
        this.tipView ??= Object.create(sb, { alwaysExpand: { value: false } });
        self = this.tipView;
      } catch (_err) {
        self = sb;
      }
    }
    return this.pinPanels.map((panel) => {
      try {
        return sb._renderPanel.call(self, panel, panel.url_path === selected);
      } catch (_err) {
        return sb._renderPanel(panel, panel.url_path === selected);
      }
    });
  }

  /**
   * Resolved theme colours for contrast checks, read once per theme (HA replaces `hass.themes` when the
   * theme or dark mode changes). A hidden probe in the sidebar resolves theme variables.
   */
  palette() {
    const themes = this.hass?.themes;
    if (this.pal && this.pal.themes === themes) return this.pal;
    const root = this.sb.shadowRoot;
    if (!root) return null;
    let probe = this.probe;
    if (!probe?.isConnected) {
      probe = this.probe = h("span", { class: "esp-probe", "aria-hidden": "true" });
      root.append(probe);
    }
    const read = (css) => {
      probe.style.color = "";
      probe.style.color = css;
      return L.parseRgb(getComputedStyle(probe).color);
    };
    const page = read("var(--primary-background-color, #fafafa)") ?? [250, 250, 250, 1];
    const pageBg = L.over(page, [255, 255, 255]);
    const side = read("var(--sidebar-background-color, var(--primary-background-color, #fafafa))") ?? page;
    const bg = L.over(side, pageBg);
    const text = L.over(read("var(--sidebar-text-color, var(--primary-text-color, #212121))") ?? [33, 33, 33, 1], bg);
    const opaque = (css, fallback) => L.over(read(css) ?? fallback, bg);
    // What a pill header draws on its own background (theme hooks first, as in GROUP_CSS).
    const headBg = read("var(--esp-group-header-background, transparent)");
    this.pal = {
      themes,
      read,
      bg,
      text,
      headerBg: headBg && headBg[3] > 0 ? L.over(headBg, bg) : null,
      headText: opaque("var(--esp-group-header-text-color, var(--sidebar-text-color, var(--primary-text-color, #212121)))", text),
      headIcon: opaque("var(--esp-group-header-icon-color, var(--sidebar-icon-color, var(--secondary-text-color, #727272)))", text),
      sub: opaque("var(--secondary-text-color, #727272)", text),
      sel: opaque("var(--sidebar-selected-text-color, var(--primary-color, #03a9f4))", text),
      selIcon: opaque("var(--sidebar-selected-icon-color, var(--primary-color, #03a9f4))", text),
      cache: new Map(),
    };
    return this.pal;
  }

  /** `#rrggbb` of a stored colour as this theme shows it (named colours resolved), or null. */
  hexOf(color) {
    const css = color ? L.colorCss(color) : null;
    const rgb = css ? this.palette()?.read(css) : null;
    return rgb ? `#${rgb.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}` : null;
  }

  /**
   * CSS colours for a group, adjusted to WCAG contrast on this theme's sidebar: header text 4.5:1;
   * icons and lines 3:1 (non-text). The colour moves toward the theme's text colour only as far as needed.
   */
  look(color, iconColor, header = "plain") {
    if (!color && !iconColor && header !== "pill") return null;
    const pal = this.palette();
    if (!pal) return null;
    const key = `${color}|${iconColor}|${header}`;
    if (pal.cache.has(key)) return pal.cache.get(key);
    const resolve = (value) => {
      const css = L.colorCss(value);
      const rgb = css ? pal.read(css) : null;
      return rgb && rgb[3] > 0 ? rgb : null;
    };
    const c = resolve(color);
    const ic = resolve(iconColor) ?? c;
    const pill = header === "pill";
    const tint = header === "tinted" && c ? L.mix(pal.bg, L.over(c, pal.bg), 0.14).map((v) => Math.round(v)) : pill ? L.pillBackground(pal, c) : null;
    const base = tint ?? pal.bg;
    const on = (fg, min) => L.rgbCss(L.readable(fg, base, pal.text, min));
    const out = {
      text: c ? on(c, 4.5) : pill ? on(pal.headText, 4.5) : null,
      icon: ic ? on(ic, 3) : pill ? on(pal.headIcon, 3) : null,
      member: resolve(iconColor) ? L.rgbCss(L.readable(resolve(iconColor), pal.bg, pal.text, 3)) : null,
      bg: tint ? L.rgbCss(tint) : null,
      line: c ? L.rgbCss(L.readable(c, pal.bg, pal.text, 3)) : null,
      sub: pill ? on(pal.sub, 4.5) : null,
      sel: pill ? on(pal.sel, 4.5) : null,
      selIcon: pill ? on(pal.selIcon, 3) : null,
    };
    pal.cache.set(key, out);
    return out;
  }

  /**
   * The visually hidden element that names a group for its panels (aria-describedby); one per group,
   * kept in the sidebar's shadow root so the id reference resolves. Returns its id.
   */
  describeGroup(root, group) {
    // Layout ids are free text: the element id is a counter, always a valid unique id.
    if (!this.descIds.has(group)) this.descIds.set(group, `esp-gdesc-${this.descIds.size + 1}`);
    const id = this.descIds.get(group);
    let el = this.descEls.get(group);
    if (!el || !el.isConnected) {
      el = document.createElement("span");
      el.className = "esp-sr";
      el.id = id;
      root.append(el);
      this.descEls.set(group, el);
    }
    const text = t(this.lang, "inGroup", { name: this.groupNames.get(group) ?? "" });
    if (el.textContent !== text) el.textContent = text;
    return id;
  }

  afterUpdate() {
    const root = this.sb.shadowRoot;
    if (!root) return;
    if (!sidebarSheet) {
      sidebarSheet = new CSSStyleSheet();
      sidebarSheet.replaceSync(SIDEBAR_CSS);
    }
    if (!root.adoptedStyleSheets.includes(sidebarSheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sidebarSheet];
    const divider = this.editing ? "line" : this.settings.divider;
    if (this.sb.getAttribute("data-esp-divider") !== divider) this.sb.setAttribute("data-esp-divider", divider);
    for (const item of root.querySelectorAll('ha-list-nav.before-spacer ha-list-item-button[id^="sidebar-panel-"]')) {
      const path = item.id.slice("sidebar-panel-".length);
      const group = this.editing ? null : this.rowGroups.get(path);
      // Write only on change: an attribute write per row per update costs a style pass each time.
      if (group) {
        if (item.getAttribute("data-esp-group") !== group) item.setAttribute("data-esp-group", group);
        const descId = this.describeGroup(root, group);
        if (item.getAttribute("aria-describedby") !== descId) item.setAttribute("aria-describedby", descId);
      } else {
        if (item.hasAttribute("data-esp-group")) item.removeAttribute("data-esp-group");
        if (item.hasAttribute("aria-describedby")) item.removeAttribute("aria-describedby");
      }
      const look = group ? this.groupLooks.get(group) : null;
      setVar(item, "--esp-own-line", look?.line);
      setVar(item, "--esp-own-icon-color", look?.member);
      const last = !!group && this.lastInGroup.has(path);
      if (item.hasAttribute("data-esp-last") !== last) item.toggleAttribute("data-esp-last", last);
    }
    // Drop the descriptions of groups no panel is in any more.
    const inUse = new Set(this.editing ? [] : this.rowGroups.values());
    for (const [id, el] of [...this.descEls]) {
      if (inUse.has(id) && el.isConnected) continue;
      el.remove();
      this.descEls.delete(id);
    }
    this.afterPins(root);
    for (const nav of root.querySelectorAll("ha-list-nav")) {
      // HA's list items unregister from disconnectedCallback, when the event can no longer reach the
      // list, so every row our renders replace stays in the list's `items` (a leak, and stale entries
      // for arrow-key navigation). Unregister the detached ones through the list's own event.
      if (Array.isArray(nav.items))
        for (const item of nav.items.filter((i) => !i.isConnected))
          nav.dispatchEvent(new CustomEvent("ha-list-item-unregister", { detail: { item } }));
      if (!nav.shadowRoot) continue;
      if (!navSheet) {
        navSheet = new CSSStyleSheet();
        // The editor's Done/Cancel bar is sticky; HA's inner list box would be its scroll container but
        // never scrolls. While editing, let the list element itself be the scroll container.
        // Pinned rows flow into a grid: the fixed list wraps rows while it holds any.
        navSheet.replaceSync(":host([data-esp-editing]) .base { overflow: visible; } :host([data-esp-pins]) .base { flex-flow: row wrap; }");
      }
      if (!nav.shadowRoot.adoptedStyleSheets.includes(navSheet)) nav.shadowRoot.adoptedStyleSheets = [...nav.shadowRoot.adoptedStyleSheets, navSheet];
      if (nav.classList.contains("before-spacer") && nav.hasAttribute("data-esp-editing") !== this.editing)
        nav.toggleAttribute("data-esp-editing", this.editing);
    }
    const menu = root.querySelector(".menu");
    if (menu && this.data) {
      const button = (cls, path, onClick) => {
        let btn = menu.querySelector(`.${cls}`);
        if (btn) return btn;
        btn = h("button", { class: `esp-btn ${cls}`, type: "button" }, svg(path));
        for (const type of ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend"])
          btn.addEventListener(type, (e) => e.stopPropagation());
        // HA's header handles Enter / Space itself and cancels them, so the button never got its click.
        // Only these two keys: HA's global shortcuts must still see every other key.
        for (const type of ["keydown", "keyup"])
          btn.addEventListener(type, (e) => {
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          });
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          onClick();
        });
        menu.append(btn);
        return btn;
      };
      const all = button("esp-all", ICONS.collapseAll, () => this.toggleAll());
      const edit = button("esp-edit", ICONS.pencil, () => this.startEdit());
      if (all.nextElementSibling !== edit) menu.insertBefore(all, edit);
      const ids = [...this.groupNames.keys()];
      const action = L.allAction(this.collapsed, ids, this.settings.accordion);
      all.hidden = this.editing || !this.settings.toggle_all || ids.length < 2 || !action;
      if (!all.hidden) {
        const open = action === "collapse";
        const label = t(this.lang, open ? "collapseAll" : "expandAll");
        if (all.getAttribute("aria-label") !== label) {
          all.setAttribute("aria-label", label);
          all.title = label;
          all.replaceChildren(svg(open ? ICONS.collapseAll : ICONS.expandAll));
        }
      }
      edit.hidden = this.editing;
      edit.setAttribute("aria-label", t(this.lang, "edit"));
      edit.title = t(this.lang, "edit");
    }
  }

  /** Pinned rows in HA's fixed list: mark them (grid cell size), name them, place their tooltips, keys. */
  afterPins(root) {
    const nav = root.querySelector("ha-list-nav.after-spacer");
    if (!nav) return;
    const pins = new Set(this.editing ? [] : this.pinPaths);
    const expanded = this.sb.hasAttribute("expanded");
    let descId = null;
    if (pins.size) {
      descId = "esp-pinned-desc";
      let desc = root.getElementById(descId);
      if (!desc) {
        desc = h("span", { class: "esp-sr", id: descId });
        root.append(desc);
      }
      const text = t(this.lang, "pinnedDesc");
      if (desc.textContent !== text) desc.textContent = text;
    }
    for (const item of nav.querySelectorAll('ha-list-item-button[id^="sidebar-panel-"]')) {
      const pin = pins.has(item.id.slice("sidebar-panel-".length));
      if (item.hasAttribute("data-esp-pin") !== pin) item.toggleAttribute("data-esp-pin", pin);
      if (pin && item.getAttribute("aria-describedby") !== descId) item.setAttribute("aria-describedby", descId);
    }
    // Icons sit in a grid when the sidebar is expanded: tooltips above them; in the rail, beside them.
    const placement = expanded ? "top" : "right";
    for (const tip of nav.querySelectorAll('ha-tooltip[for^="sidebar-panel-"]'))
      if (tip.getAttribute("placement") !== placement) tip.setAttribute("placement", placement);
    if (nav.hasAttribute("data-esp-pins") !== pins.size > 0) nav.toggleAttribute("data-esp-pins", pins.size > 0);
    if (!this.keyedNavs.has(nav)) {
      this.keyedNavs.add(nav);
      // Capture phase: runs before HA's own list keys (bubble listener on the same element).
      nav.addEventListener("keydown", (e) => this.pinKeys(nav, e), true);
    }
  }

  /**
   * Arrow keys in the expanded grid of pinned rows: Left / Right along the row (mirrored in RTL),
   * Up / Down by one grid row; Down from the last row goes on to the next HA row. The icon-only rail
   * is one column, where HA's own Up / Down already fit.
   */
  pinKeys(nav, e) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!this.sb.hasAttribute("expanded")) return;
    const items = Array.isArray(nav.items) ? nav.items : [];
    const path = e.composedPath();
    const index = items.findIndex((i) => path.includes(i));
    if (index < 0 || !items[index].hasAttribute("data-esp-pin")) return;
    const pins = items.filter((i) => i.hasAttribute("data-esp-pin"));
    const k = pins.indexOf(items[index]);
    let next = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const rtl = getComputedStyle(nav).direction === "rtl";
      next = pins[k + ((e.key === "ArrowRight") !== rtl ? 1 : -1)] ?? items[index];
    } else {
      const top = pins[0].offsetTop;
      const cols = Math.max(1, pins.filter((p) => p.offsetTop === top).length);
      if (e.key === "ArrowUp") next = pins[k - cols] ?? items[index];
      else next = pins[k + cols] ?? (Math.floor(k / cols) < Math.floor((pins.length - 1) / cols) ? pins[pins.length - 1] : items[items.indexOf(pins[pins.length - 1]) + 1] ?? items[index]);
    }
    e.preventDefault();
    e.stopPropagation();
    const target = items.indexOf(next);
    if (target >= 0 && next !== items[index]) nav.focusItemAtIndex(target);
  }

  /** Ids of the groups shown right now (folding applies to these). */
  shownGroups() {
    return [...this.groupNames.keys()];
  }

  /** Store the folded set: this page only while "start collapsed" is on, otherwise on the server (debounced). */
  setCollapsed(next) {
    if (this.session !== null) {
      this.session = next;
      this.refresh();
      return;
    }
    this.data = { ...this.data, collapsed: next };
    this.refresh();
    clearTimeout(this.collapseTimer);
    this.collapseTimer = setTimeout(() => {
      this.hass.callWS({ type: `${DOMAIN}/collapsed`, collapsed: this.data.collapsed }).catch(() => {});
    }, 300);
  }

  toggle(id) {
    this.setCollapsed(L.toggleCollapsed(this.collapsed, id, this.settings.accordion, this.shownGroups()));
  }

  toggleAll() {
    this.setCollapsed(L.toggleAll(this.collapsed, this.shownGroups(), this.settings.accordion));
  }

  /** Every panel the user could see, with HA's visible order first. */
  allPanels() {
    const hass = this.hass;
    const order = this.sb._panelOrder ?? [];
    const nativeHidden = new Set(this.sb._hiddenPanels ?? []);
    const def = defaultPanelPath(hass);
    const all = Object.values(hass.panels ?? {}).filter(
      (p) => !FIXED_PANELS.includes(p.url_path) && (p.url_path === def || (p.title && p.show_in_sidebar !== false)),
    );
    const visibleOrder = [...this.sb.shadowRoot.querySelectorAll('ha-list-nav.before-spacer ha-list-item-button[id^="sidebar-panel-"]')].map((el) =>
      el.id.slice("sidebar-panel-".length),
    );
    const position = new Map(visibleOrder.map((path, i) => [path, i]));
    const rank = (p) => position.get(p.url_path) ?? 1e6;
    all.sort((a, b) => rank(a) - rank(b) || panelTitle(hass, a).localeCompare(panelTitle(hass, b), hass.language));
    const hidden = new Set();
    const defaultInvisible = new Set();
    for (const p of all) {
      if (p.url_path === def) continue;
      if (nativeHidden.has(p.url_path)) hidden.add(p.url_path);
      else if (p.default_visible === false && !order.includes(p.url_path)) {
        hidden.add(p.url_path);
        defaultInvisible.add(p.url_path);
      }
    }
    const info = new Map();
    for (const p of all) {
      const el = this.sb.shadowRoot.getElementById(`sidebar-panel-${p.url_path}`);
      const title = el?.querySelector(".item-text")?.textContent?.trim() || panelTitle(hass, p);
      // The icon HA's own row shows (built-in panels draw an SVG path, not panel.icon).
      const iconPath = el?.querySelector('ha-svg-icon[slot="start"]')?.path || null;
      const icon =
        el?.querySelector('ha-icon[slot="start"]')?.icon ||
        PANEL_ICONS[p.url_path] ||
        p.icon ||
        (p.component_name === "lovelace" ? "mdi:view-dashboard" : "mdi:application-outline");
      info.set(p.url_path, { title, icon, iconPath });
    }
    return { paths: all.map((p) => p.url_path), hidden, defaultInvisible, info, locked: new Set([def]) };
  }

  startEdit() {
    if (!this.data) return;
    const { paths, hidden, defaultInvisible, info, locked } = this.allPanels();
    const tree = L.buildTree(this.data.layout, paths, gridSupported);
    const settings = L.cleanSettings(this.data.layout?.settings);
    // What the editor opened with: Done without a change from it saves nothing.
    this.edit = { paths, defaultInvisible, baseTree: tree, baseHidden: new Set(hidden), baseSettings: settings };
    if (!this.editor) this.editor = document.createElement("esp-editor");
    this.editing = true;
    this.editor.open({
      tree,
      settings,
      look: (color, iconColor) => this.look(color, iconColor),
      hexOf: (color) => this.hexOf(color),
      hiddenSet: hidden,
      info,
      lockedVisible: locked,
      hass: this.hass,
      lang: this.lang,
      isAdmin: this.data.is_admin,
      own: this.data.own,
      hasDefault: !!this.data.default,
      sameAsDefault: this.sameAsDefault(),
      actions: this.actions(),
    });
    this.refresh();
  }

  stopEdit() {
    this.editing = false;
    this.refresh();
    requestAnimationFrame(() => this.sb.shadowRoot?.querySelector(".esp-edit")?.focus());
  }

  actions() {
    const ed = () => this.editor;
    const lang = () => this.lang;
    const where = (tree, key) => {
      const at = L.locate(tree, key);
      const name = ed().name(key);
      if (!at) return "";
      if (at.group === L.PINS_ID) return t(lang(), "movedPinned", { name, pos: at.index + 1 });
      if (at.group) return t(lang(), "movedGroup", { name, group: ed().name(L.groupKey(at.group)), pos: at.index + 1 });
      const visible = tree.filter((n) => !n.missing);
      return t(lang(), "movedTop", { name, pos: visible.indexOf(at.node) + 1 });
    };
    // The editor now holds what was saved: Done without a further change closes without saving.
    const rebase = () => {
      this.edit.baseTree = ed().tree;
      this.edit.baseHidden = new Set(ed().hiddenSet);
      this.edit.baseSettings = ed().settings;
    };
    return {
      done: () => {
        const e = ed();
        if (e.focusInvalidName()) return;
        const kind = L.editKind(this.edit.baseTree, e.tree, this.edit.baseHidden, e.hiddenSet, this.edit.baseSettings, e.settings);
        if (kind === "none") return this.stopEdit();
        const onDefault = !this.data.own && !!this.data.default;
        // Hiding/showing is HA's own setting: a user on the default keeps following it.
        if (kind === "hidden-only" && onDefault) return this.saveHidden(e.hiddenSet);
        // A user on the admin default is told once, before the save, that it stops following the default.
        if (onDefault && !e.forkNoted) {
          e.set({ forkNoted: true, notice: t(lang(), "forkNote"), error: "", status: "" }, "done");
          return;
        }
        this.save(e.tree, e.hiddenSet);
      },
      cancel: () => this.stopEdit(),
      addGroup: () => {
        const id = L.newGroupId(ed().tree);
        ed().set({ tree: L.addGroup(ed().tree, id, L.uniqueName(ed().tree, t(lang(), "newGroup"))) }, `name:${id}`);
        ed().shadowRoot.querySelector(`[data-focus-key="name:${id}"]`)?.select();
      },
      rename: (id, input) => {
        const e = ed();
        const name = L.cleanName(input.value);
        if (name) {
          e.nameErrors.delete(id);
          e.tree = L.updateGroup(e.tree, id, { name });
        } else e.nameErrors.set(id, input.value);
        e.patchGroup(id);
      },
      setColor: (id, field, color) => {
        if ((field !== "color" && field !== "icon_color") || !L.validColor(color)) return;
        ed().tree = L.updateGroup(ed().tree, id, { [field]: color });
        ed().patchColors(id);
      },
      setting: (key, value) => {
        ed().settings = L.cleanSettings({ ...ed().settings, [key]: value });
        ed().toggleAttribute("start-collapsed", ed().settings.start_collapsed);
      },
      setStartOpen: (id, value) => {
        if (typeof value !== "boolean") return;
        ed().tree = L.updateGroup(ed().tree, id, { start_open: value });
        ed().patchGroup(id);
      },
      setIcon: (id, icon) => {
        if (icon !== null && !L.validIcon(icon)) return;
        ed().tree = L.updateGroup(ed().tree, id, { icon });
        ed().patchGroup(id);
      },
      ungroup: (id) => {
        const first = L.locate(ed().tree, L.groupKey(id))?.node.children.find((c) => !c.missing);
        ed().set({ tree: L.ungroup(ed().tree, id) }, first ? `handle:${L.panelKey(first.path)}` : "add");
      },
      toggleHidden: (path) => {
        const hidden = new Set(ed().hiddenSet);
        if (hidden.has(path)) hidden.delete(path);
        else hidden.add(path);
        ed().hiddenSet = hidden;
        ed().patchRow(path);
      },
      moveBy: (key, delta) => {
        const tree = L.moveBy(ed().tree, key, delta);
        ed().set({ tree }, `handle:${key}`);
        ed().announce(where(tree, key));
      },
      drop: (key, targetKey, zone) => {
        if (zone === "merge") {
          const id = L.newGroupId(ed().tree);
          const tree = L.merge(ed().tree, key, targetKey, id, L.uniqueName(ed().tree, t(lang(), "newGroup")));
          ed().set({ tree }, `name:${id}`);
          ed().shadowRoot.querySelector(`[data-focus-key="name:${id}"]`)?.select();
          ed().announce(t(lang(), "grouped", { a: ed().name(targetKey), b: ed().name(key) }));
          return;
        }
        const tree = L.move(ed().tree, key, targetKey, zone);
        ed().set({ tree }, `handle:${key}`);
        ed().announce(where(tree, key));
      },
      // Reset drops the user's layout; the editor stays open on the default (session edits dropped),
      // HA's native order is rewritten from the default, and Done then closes without saving.
      reset: async () => {
        const e = ed();
        try {
          await this.hass.callWS({ type: `${DOMAIN}/reset` });
          const tree = L.buildTree(this.data.default, this.edit.paths, gridSupported);
          const settings = L.cleanSettings(this.data.default?.settings);
          await this.writeNative(tree, this.edit.baseHidden);
          e.set({ tree, settings, hiddenSet: new Set(this.edit.baseHidden), confirming: null, notice: "", error: "", status: t(lang(), "resetDone") }, "done");
          rebase();
        } catch (err) {
          e.set({ confirming: null, error: this.failText(err) });
        }
      },
      // No default: drop the layout and HA's custom order (HA sorts by itself again); hidden panels stay.
      resetPlain: async () => {
        const e = ed();
        try {
          await this.hass.callWS({ type: `${DOMAIN}/reset` });
          await this.writePlainNative();
          this.stopEdit();
        } catch (err) {
          e.set({ confirming: null, error: this.failText(err) });
        }
      },
      setDefault: async () => {
        const e = ed();
        if (e.focusInvalidName()) return;
        if (!(await this.save(e.tree, e.hiddenSet, false))) return e.set({ confirming: null });
        try {
          await this.hass.callWS({ type: `${DOMAIN}/default/set`, layout: L.toLayout(e.tree, e.settings) });
          rebase();
          e.set({ confirming: null, notice: "", error: "", status: t(lang(), "setDefaultDone") }, "done");
        } catch (err) {
          e.set({ confirming: null, error: this.failText(err) });
        }
      },
      clearDefault: async () => {
        const e = ed();
        try {
          await this.hass.callWS({ type: `${DOMAIN}/default/set`, layout: null });
          e.set({ confirming: null, error: "", status: t(lang(), "clearDefaultDone") }, "done");
        } catch (err) {
          e.set({ confirming: null, error: this.failText(err) });
        }
      },
    };
  }

  /** A short localized message for a failed write: never a raw code, an id or the server's English text. */
  failText(err) {
    const kind = L.saveErrorKind(err);
    return t(this.lang, kind === "connection" ? "saveFailedConnection" : kind === "invalid" ? "saveFailedInvalid" : "saveFailed");
  }

  /** HA's native sidebar user data from a tree (order and hidden panels). */
  async writeNative(tree, hidden) {
    const current = (await this.hass.callWS({ type: "frontend/get_user_data", key: "sidebar" }))?.value ?? {};
    const value = L.nativeSidebar(current, tree, new Set(this.edit.paths), hidden, this.edit.defaultInvisible);
    // The subscription echoes this write back: it is ours, not a change to adopt.
    this.writtenSig = JSON.stringify(value.panelOrder);
    await this.hass.callWS({ type: "frontend/set_user_data", key: "sidebar", value });
  }

  /** HA's own sorting again: empty panelOrder, hidden panels and other keys untouched. */
  async writePlainNative() {
    const current = (await this.hass.callWS({ type: "frontend/get_user_data", key: "sidebar" }))?.value ?? {};
    this.writtenSig = JSON.stringify([]);
    await this.hass.callWS({ type: "frontend/set_user_data", key: "sidebar", value: { ...current, panelOrder: [] } });
  }

  /**
   * HA's own dialog reordered the sidebar of a user who follows the default, and adopting it made the
   * layout theirs (UX-001 / UX-002). Say so through HA's own toast, with Undo back to the default.
   */
  notifyForked() {
    const lang = this.lang;
    this.sb.dispatchEvent(
      new CustomEvent("hass-notification", {
        bubbles: true,
        composed: true,
        detail: { message: t(lang, "forkedByHa"), duration: 10000, dismissable: true, action: { text: t(lang, "undo"), action: () => this.undoFork() } },
      }),
    );
  }

  async undoFork() {
    try {
      await this.hass.callWS({ type: `${DOMAIN}/reset` });
      const { paths, hidden, defaultInvisible } = this.allPanels();
      const tree = L.buildTree(this.data?.default, paths);
      const current = (await this.hass.callWS({ type: "frontend/get_user_data", key: "sidebar" }))?.value ?? {};
      const value = L.nativeSidebar(current, tree, new Set(paths), hidden, defaultInvisible);
      this.writtenSig = JSON.stringify(value.panelOrder);
      await this.hass.callWS({ type: "frontend/set_user_data", key: "sidebar", value });
    } catch (_err) {
      // Nothing to undo on a failed connection; the toast is gone and the layout stays as saved.
    }
  }

  /** Only HA's hidden list; our layout is not saved, so the user stays on the default. */
  async saveHidden(hidden) {
    this.editor.set({ error: "" });
    try {
      const current = (await this.hass.callWS({ type: "frontend/get_user_data", key: "sidebar" }))?.value ?? {};
      const value = L.nativeHidden(current, new Set(this.edit.paths), hidden, this.edit.defaultInvisible);
      await this.hass.callWS({ type: "frontend/set_user_data", key: "sidebar", value });
    } catch (err) {
      this.editor.set({ error: this.failText(err) });
      return false;
    }
    this.stopEdit();
    return true;
  }

  async save(tree, hidden, close = true) {
    this.editor.set({ error: "" });
    try {
      await this.hass.callWS({ type: `${DOMAIN}/save`, layout: L.toLayout(tree, this.editor.settings) });
      await this.writeNative(tree, hidden);
    } catch (err) {
      this.editor.set({ error: this.failText(err) });
      return false;
    }
    if (close) this.stopEdit();
    return true;
  }
}

function controllerFor(sb) {
  let c = ctrls.get(sb);
  if (!c) {
    c = new Controller(sb);
    ctrls.set(sb, c);
  }
  c.connect();
  return c;
}

/* ------------------------------------------------------------------ patch */

function patch(cls) {
  const p = cls.prototype;
  if (p.__espPatched) return;
  // The list-based sidebar (HA 2026.6+). ha-sidebar imports both elements, so they are defined by now;
  // the older ha-md-list sidebar has the same render methods but different rows, so stay off there.
  const listSidebar = customElements.get("ha-list-nav") && customElements.get("ha-list-item-button");
  if (!listSidebar || typeof p._renderPanels !== "function" || typeof p._renderPanel !== "function" || typeof p.shouldUpdate !== "function") {
    window.__easySidebarPro = { status: "unsupported" };
    return;
  }
  p.__espPatched = true;
  const origRender = p._renderPanels;
  const origShould = p.shouldUpdate;
  const origUpdated = p.updated;
  const origConnected = p.connectedCallback;
  const origFixed = p._renderFixedPanels;
  gridSupported = typeof origFixed === "function";
  const origDisconnected = p.disconnectedCallback;

  p._renderPanels = function (panels, selected) {
    const c = this.hass ? controllerFor(this) : null;
    if (c?.holding && panels.length) return [];
    if (!c?.data) return origRender.call(this, panels, selected);
    return c.render(panels, selected, origRender);
  };
  // Pinned panels: HA's own rows at the top of the fixed (bottom) list, above Settings / Notifications.
  if (gridSupported)
    p._renderFixedPanels = function (selected) {
      const base = origFixed.call(this, selected);
      const pins = ctrls.get(this)?.renderPins(selected);
      return pins?.length ? [pins, base] : base;
    };
  p.shouldUpdate = function (changed) {
    const c = ctrls.get(this);
    if (c?.dirty) {
      c.dirty = false;
      return true;
    }
    // HA's own check ignores hass.themes, so colours adjusted for the previous theme (light / dark)
    // would stay until an unrelated update (BUG-015). The palette is read again on the next render.
    if (c?.pal && c.pal.themes !== this.hass?.themes) {
      c.pal = null;
      return true;
    }
    return origShould.call(this, changed);
  };
  p.updated = function (changed) {
    origUpdated?.call(this, changed);
    if (this.hass) controllerFor(this).afterUpdate();
  };
  p.connectedCallback = function () {
    origConnected?.call(this);
    if (this.hass) controllerFor(this);
  };
  p.disconnectedCallback = function () {
    origDisconnected?.call(this);
    ctrls.get(this)?.disconnect();
  };
  window.__easySidebarPro = { status: "active" };

  // A sidebar that rendered before this module loaded.
  const main = document.querySelector("home-assistant")?.shadowRoot?.querySelector("home-assistant-main");
  const sb = main?.shadowRoot?.querySelector("ha-sidebar");
  if (sb?.hass) controllerFor(sb).refresh();
}

customElements.whenDefined("ha-sidebar").then(() => patch(customElements.get("ha-sidebar")));
