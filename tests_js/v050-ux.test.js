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

test("#60 the English address error names http or https", () => {
  assert.match(EN, /\n {4}linkUrlInvalid: "Enter a Home Assistant page \(starting with \/\) or a web address \(http or https\)",/);
});
