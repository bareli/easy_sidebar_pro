// Easy Sidebar Pro: collapsible groups in the Home Assistant sidebar, edited in place.
// Patches ha-sidebar's own render methods so groups are part of HA's render cycle (no flicker).
import * as L from "./layout.js";

const DOMAIN = "easy_sidebar_pro";
const ctrls = new WeakMap();

const ICONS = {
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  chevron: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  drag: "M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z",
  eye: "M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z",
  eyeOff: "M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z",
  ungroup: "M20,6H12L10,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8A2,2 0 0,0 20,6M20,18H4V8H20V18M14.59,10L12,12.59L9.41,10L8,11.41L10.59,14L8,16.59L9.41,18L12,15.41L14.59,18L16,16.59L13.41,14L16,11.41L14.59,10Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
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
    groupIcon: "Icon of {name}",
    iconHelp: "Icon, for example mdi:home",
    iconInvalid: "Use the form mdi:name",
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
    saveFailedInvalid: "Could not save: a group name or icon is not valid.",
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
    groupIcon: "הסמל של {name}",
    iconHelp: "סמל, למשל mdi:home",
    iconInvalid: "יש לכתוב בצורה mdi:name",
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
    saveFailedInvalid: "לא ניתן לשמור: שם או סמל של קבוצה אינם תקינים.",
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

const panelTitle = (hass, panel) => hass.localize?.(`panel.${panel.title}`) || panel.title || panel.url_path;

/* ------------------------------------------------------------------ group header */

const GROUP_CSS = `
:host { display: block; outline: none; margin-block-end: 4px; }
.row {
  display: flex; align-items: center; gap: 12px; box-sizing: border-box;
  min-height: 40px; padding-block: 4px; padding-inline: 12px 8px; margin-inline: 4px;
  border-radius: var(--ha-border-radius-md, 8px); cursor: pointer;
  color: var(--sidebar-text-color, var(--primary-text-color));
  font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500);
}
.row:hover { background: var(--sidebar-hover-background-color, rgba(var(--rgb-primary-text-color, 0,0,0), 0.06)); }
.row:focus { outline: none; }
.row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
.icon { --mdc-icon-size: 24px; color: var(--sidebar-icon-color, var(--secondary-text-color)); flex: none; width: 24px; height: 24px; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); font-weight: normal; font-variant-numeric: tabular-nums; }
.chev { width: 20px; height: 20px; flex: none; fill: currentColor; color: var(--secondary-text-color); transition: transform 0.15s; }
:host([collapsed]) .chev { transform: rotate(-90deg); }
:host([collapsed][rtl]) .chev { transform: rotate(90deg); }
:host([selected]) .row { color: var(--sidebar-selected-text-color, var(--primary-color)); }
:host([selected]) .icon { color: var(--sidebar-selected-icon-color, var(--primary-color)); }
:host([icon-only]) .name, :host([icon-only]) .count, :host([icon-only]) .chev { display: none; }
:host([icon-only]) .row { padding-inline: 12px; justify-content: flex-start; }
:host([icon-only][collapsed]) .row { border-inline-start: 3px solid var(--divider-color); padding-inline-start: 9px; }
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

  update(row, lang, iconOnly, rtl) {
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

  /** opts: { tree, hiddenSet:Set, info:Map(path→{title,icon,iconPath}), lockedVisible:Set, lang, isAdmin, own, hasDefault, sameAsDefault, actions } */
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
      if (node.type === "group") list.append(this.groupBlock(node));
      else if (!node.missing) list.append(h("div", { class: "top", role: "listitem" }, this.panelRow(node, null)));
    }

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

    this._content.replaceChildren(bar, add, list, footer.childElementCount ? footer : "");

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
    return h("div", { class: "icon-edit" }, h("div", { class: "icon-line" }, preview, input), error, chips);
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
    const empty = hit?.closest?.("[data-empty]");
    if (empty) {
      // An empty group's "Drop items here": a panel goes into it; a group lands before or after it.
      const block = empty.closest(".group");
      if (!block || d.block.contains(empty)) return;
      const targetKey = L.groupKey(empty.dataset.empty);
      if (d.key.startsWith("g:")) {
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
    const dragGroup = d.key.startsWith("g:");
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
:host([expanded]) ha-list-item-button[data-esp-group] { margin-inline-start: 18px; width: calc(var(--ha-sidebar-expanded-item-width, 248px) - 14px); }
:host([narrow][expanded]) ha-list-item-button[data-esp-group] { width: calc(226px - var(--safe-area-inset-left, 0px)); }
:host([expanded]) ha-list-item-button[data-esp-group]::after { content: ""; position: absolute; inset-block: 0 -4px; inset-inline-start: -8px; width: 2px;
  background: var(--divider-color); pointer-events: none; }
:host([expanded]) ha-list-item-button[data-esp-last]::after { inset-block-end: 6px; border-end-end-radius: 1px; border-end-start-radius: 1px; }
.esp-edit { margin-inline: auto 4px; flex: none; width: 40px; height: 40px; display: grid; place-items: center; border: none; background: none;
  border-radius: 50%; cursor: pointer; color: var(--sidebar-icon-color, var(--secondary-text-color)); }
.esp-edit[hidden] { display: none; }
.esp-edit:hover { background: rgba(127,127,127,0.15); }
.esp-edit:focus-visible { outline: 2px solid var(--primary-color); }
.esp-edit svg { width: 20px; height: 20px; fill: currentColor; }
:host(:not([expanded])) .esp-edit { display: none; }
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

  render(panels, selected, orig) {
    if (!panels.length) return orig.call(this.sb, panels, selected);
    if (this.editing) return [this.editor];
    const byPath = new Map(panels.map((p) => [p.url_path, p]));
    const rows = L.arrange(this.data.layout, [...byPath.keys()], this.data.collapsed, selected);
    this.rowGroups = new Map(rows.filter((r) => r.type === "panel").map((r) => [r.path, r.group]));
    this.groupNames = new Map(rows.filter((r) => r.type === "group").map((r) => [r.id, r.name]));
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
      el.update(r, this.lang, iconOnly, rtl);
      return el;
    });
    for (const id of [...this.groupEls.keys()]) if (!used.has(id)) this.groupEls.delete(id);
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
    for (const nav of root.querySelectorAll("ha-list-nav")) {
      // HA's list items unregister from disconnectedCallback, when the event can no longer reach the
      // list, so every row our renders replace stays in the list's `items` (a leak, and stale entries
      // for arrow-key navigation). Unregister the detached ones through the list's own event.
      if (Array.isArray(nav.items))
        for (const item of nav.items.filter((i) => !i.isConnected))
          nav.dispatchEvent(new CustomEvent("ha-list-item-unregister", { detail: { item } }));
      // The editor's Done/Cancel bar is sticky; HA's inner list box would be its scroll container but
      // never scrolls. While editing, let the list element itself be the scroll container.
      if (nav.shadowRoot && nav.classList.contains("before-spacer")) {
        if (!navSheet) {
          navSheet = new CSSStyleSheet();
          navSheet.replaceSync(":host([data-esp-editing]) .base { overflow: visible; }");
        }
        if (!nav.shadowRoot.adoptedStyleSheets.includes(navSheet)) nav.shadowRoot.adoptedStyleSheets = [...nav.shadowRoot.adoptedStyleSheets, navSheet];
        if (nav.hasAttribute("data-esp-editing") !== this.editing) nav.toggleAttribute("data-esp-editing", this.editing);
      }
    }
    const menu = root.querySelector(".menu");
    if (menu && this.data) {
      let btn = menu.querySelector(".esp-edit");
      if (!btn) {
        btn = h("button", { class: "esp-edit", type: "button" }, svg(ICONS.pencil));
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
          this.startEdit();
        });
        menu.append(btn);
      }
      btn.hidden = this.editing;
      btn.setAttribute("aria-label", t(this.lang, "edit"));
      btn.title = t(this.lang, "edit");
    }
  }

  toggle(id) {
    const set = new Set(this.data.collapsed);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.data = { ...this.data, collapsed: [...set] };
    this.refresh();
    clearTimeout(this.collapseTimer);
    this.collapseTimer = setTimeout(() => {
      this.hass.callWS({ type: `${DOMAIN}/collapsed`, collapsed: this.data.collapsed }).catch(() => {});
    }, 300);
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
    const tree = L.buildTree(this.data.layout, paths);
    // What the editor opened with: Done without a change from it saves nothing.
    this.edit = { paths, defaultInvisible, baseTree: tree, baseHidden: new Set(hidden) };
    if (!this.editor) this.editor = document.createElement("esp-editor");
    this.editing = true;
    this.editor.open({
      tree,
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
      if (at.group) return t(lang(), "movedGroup", { name, group: ed().name(L.groupKey(at.group)), pos: at.index + 1 });
      const visible = tree.filter((n) => !n.missing);
      return t(lang(), "movedTop", { name, pos: visible.indexOf(at.node) + 1 });
    };
    // The editor now holds what was saved: Done without a further change closes without saving.
    const rebase = () => {
      this.edit.baseTree = ed().tree;
      this.edit.baseHidden = new Set(ed().hiddenSet);
    };
    return {
      done: () => {
        const e = ed();
        if (e.focusInvalidName()) return;
        const kind = L.editKind(this.edit.baseTree, e.tree, this.edit.baseHidden, e.hiddenSet);
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
          const tree = L.buildTree(this.data.default, this.edit.paths);
          await this.writeNative(tree, this.edit.baseHidden);
          e.set({ tree, hiddenSet: new Set(this.edit.baseHidden), confirming: null, notice: "", error: "", status: t(lang(), "resetDone") }, "done");
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
          await this.hass.callWS({ type: `${DOMAIN}/default/set`, layout: L.toLayout(e.tree) });
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
      await this.hass.callWS({ type: `${DOMAIN}/save`, layout: L.toLayout(tree) });
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
  const origDisconnected = p.disconnectedCallback;

  p._renderPanels = function (panels, selected) {
    const c = this.hass ? controllerFor(this) : null;
    if (c?.holding && panels.length) return [];
    if (!c?.data) return origRender.call(this, panels, selected);
    return c.render(panels, selected, origRender);
  };
  p.shouldUpdate = function (changed) {
    const c = ctrls.get(this);
    if (c?.dirty) {
      c.dirty = false;
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
